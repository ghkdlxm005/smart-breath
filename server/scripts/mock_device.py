#!/usr/bin/env python3
"""
ESP32 Mock 시뮬레이터
실제 하드웨어 없이 전체 플로우 테스트 가능

사용법:
  python server/scripts/mock_device.py --host http://localhost:5000 \
    --device-id esp32_demo --token esp32-device-token-dev --level 3

동작:
  1. 30초 훈련 세션 데이터를 사인파 + 노이즈로 생성
  2. 1초마다 100개 샘플을 POST /api/measurement 로 배치 전송
  3. 서보 명령을 GET /api/device/{id}/command 로 1초마다 폴링
"""
import argparse
import math
import random
import time
import requests
import sys

# ─── 기본 파라미터 ───
DEFAULT_HOST = "http://localhost:5000"
DEFAULT_DEVICE_ID = "esp32_demo"
DEFAULT_TOKEN = "esp32-device-token-dev"
DEFAULT_LEVEL = 3
SAMPLE_RATE_HZ = 100     # ESP32 샘플링 주파수
BATCH_INTERVAL_SEC = 1   # 배치 전송 주기
SESSION_DURATION_SEC = 60  # 시뮬레이션 세션 길이

# 레벨별 차압 목표 (Pa)
LEVEL_CONFIG = {
    1: {"min_pa": 100, "max_pa": 200, "peak": 150},
    2: {"min_pa": 150, "max_pa": 280, "peak": 215},
    3: {"min_pa": 220, "max_pa": 380, "peak": 300},
    4: {"min_pa": 300, "max_pa": 450, "peak": 375},
    5: {"min_pa": 400, "max_pa": 500, "peak": 450},
}


def generate_breath_samples(
    n_samples: int,
    start_ts_ms: int,
    level: int,
    time_offset: float = 0.0,      # 누적 시간 오프셋 (초) — 배치 간 연속성 보장
    breath_rate_hz: float = 0.25,  # 15회/분 (주기 4초 → 2초 흡기 + 2초 호기)
) -> list:
    """
    사인파 기반 호흡 신호 생성
    + 값: 흡기(들숨), - 값: 호기(날숨)

    Args:
        n_samples: 생성할 샘플 수
        start_ts_ms: 시작 타임스탬프 (밀리초)
        level: 저항 레벨
        time_offset: 시뮬레이션 시작부터 누적된 시간 (초)
        breath_rate_hz: 호흡 주파수 (Hz)

    Returns:
        샘플 리스트 [{"ts_ms": ..., "dp_pa": ...}, ...]
    """
    cfg = LEVEL_CONFIG.get(level, LEVEL_CONFIG[3])
    peak = cfg["peak"]

    samples = []
    t_step = 1.0 / SAMPLE_RATE_HZ

    for i in range(n_samples):
        # 누적 시간으로 계산 → 배치가 바뀌어도 사인파가 이어짐
        t = time_offset + i * t_step
        # 사인파: 양(흡기) 최대 peak, 음(호기) 최소 -peak
        raw = peak * math.sin(2 * math.pi * breath_rate_hz * t)
        # 노이즈 추가 (±12 Pa)
        noise = random.gauss(0, 12)
        dp_pa = round(raw + noise, 1)

        samples.append({
            "ts_ms": start_ts_ms + int(i * t_step * 1000),
            "dp_pa": dp_pa,
        })

    return samples


def poll_command(host: str, device_id: str, headers: dict) -> dict:
    """서보 제어 명령 폴링"""
    try:
        resp = requests.get(
            f"{host}/api/device/{device_id}/command",
            headers=headers,
            timeout=3,
        )
        if resp.status_code == 200:
            return resp.json()
    except requests.RequestException as e:
        print(f"  [폴링 오류] {e}")
    return {}


def send_batch(
    host: str,
    device_id: str,
    headers: dict,
    samples: list,
    session_id: str | None = None,
) -> bool:
    """측정 배치 전송"""
    payload = {
        "device_id": device_id,
        "samples": samples,
        "battery_percent": random.randint(70, 100),
    }
    if session_id:
        payload["session_id"] = session_id

    try:
        resp = requests.post(
            f"{host}/api/measurement",
            json=payload,
            headers=headers,
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"  ✅ 배치 전송 완료: {data.get('saved', 0)}개 저장"
                  f" (세션 #{data.get('session_id', 'N/A')})")
            return True
        else:
            print(f"  ❌ 전송 실패 ({resp.status_code}): {resp.text}")
    except requests.RequestException as e:
        print(f"  ❌ 요청 오류: {e}")
    return False


def run_simulation(
    host: str,
    device_id: str,
    token: str,
    level: int,
    duration_sec: int,
):
    """메인 시뮬레이션 루프"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    print(f"\n{'='*55}")
    print(f"  스마트 호흡 훈련기 — ESP32 Mock 시뮬레이터")
    print(f"{'='*55}")
    print(f"  서버   : {host}")
    print(f"  기기 ID: {device_id}")
    print(f"  레벨   : {level}  ({LEVEL_CONFIG[level]['min_pa']}~{LEVEL_CONFIG[level]['max_pa']} Pa)")
    print(f"  시간   : {duration_sec}초")
    print(f"{'='*55}\n")

    # 서버 연결 확인
    try:
        resp = requests.get(f"{host}/health", timeout=3)
        if resp.status_code != 200:
            print("❌ 서버 응답 없음. 서버가 실행 중인지 확인하세요.")
            sys.exit(1)
        print(f"✅ 서버 연결 확인: {resp.json()}\n")
    except requests.RequestException:
        print(f"❌ 서버({host})에 연결할 수 없습니다. 서버를 먼저 실행하세요.")
        sys.exit(1)

    start_time = time.time()
    elapsed = 0
    batch_count = 0

    while elapsed < duration_sec:
        batch_start_ts_ms = int(time.time() * 1000)

        # 누적 시간 오프셋: 배치 간 사인파 연속성 유지
        time_offset = batch_count * BATCH_INTERVAL_SEC

        # 이번 배치 샘플 생성 (100개)
        samples = generate_breath_samples(
            n_samples=SAMPLE_RATE_HZ,
            start_ts_ms=batch_start_ts_ms,
            level=level,
            time_offset=time_offset,
        )

        batch_count += 1
        elapsed = int(time.time() - start_time)
        print(f"[{elapsed:3d}s] 배치 #{batch_count} 전송 중 ({SAMPLE_RATE_HZ}개 샘플)...")

        # 측정 데이터 전송
        send_batch(host, device_id, headers, samples)

        # 서보 명령 폴링 (1초마다)
        cmd = poll_command(host, device_id, headers)
        if cmd.get("cmd") == "set_level":
            new_level = cmd.get("level", level)
            if new_level != level:
                print(f"  🔄 레벨 변경: {level} → {new_level}")
                level = new_level

        # 남은 시간 계산 후 대기
        elapsed_in_batch = time.time() - (batch_start_ts_ms / 1000)
        sleep_time = max(0, BATCH_INTERVAL_SEC - elapsed_in_batch)
        time.sleep(sleep_time)

    print(f"\n✅ 시뮬레이션 완료! 총 {batch_count}배치 ({batch_count * SAMPLE_RATE_HZ}개 샘플) 전송\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ESP32 Mock 시뮬레이터")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Flask 서버 URL")
    parser.add_argument("--device-id", default=DEFAULT_DEVICE_ID, help="기기 ID")
    parser.add_argument("--token", default=DEFAULT_TOKEN, help="장치 인증 토큰")
    parser.add_argument("--level", type=int, default=DEFAULT_LEVEL, choices=range(1, 6), help="저항 레벨 (1~5)")
    parser.add_argument("--duration", type=int, default=SESSION_DURATION_SEC, help="시뮬레이션 시간 (초)")
    args = parser.parse_args()

    run_simulation(
        host=args.host,
        device_id=args.device_id,
        token=args.token,
        level=args.level,
        duration_sec=args.duration,
    )
