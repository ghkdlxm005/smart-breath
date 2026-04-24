"""
호흡 훈련 점수 계산 엔진
- 목표 압력 범위 내 유지율 (50%)
- 호흡 리듬 일관성 (30%)
- 완료 사이클 비율 (20%)
"""
import numpy as np
from typing import List, Tuple


def moving_average(data: List[float], n: int = 5) -> np.ndarray:
    """단순 이동평균 필터 (저역통과)"""
    if len(data) < n:
        return np.array(data)
    kernel = np.ones(n) / n
    return np.convolve(data, kernel, mode="same")


def detect_cycles(samples: List[float]) -> Tuple[int, List[float]]:
    """
    차압 부호 변화(제로 크로싱)로 호흡 사이클 카운트
    반환: (사이클 수, 각 사이클 지속시간 리스트)
    """
    if len(samples) < 5:
        return 0, []

    filtered = moving_average(samples, 5)
    cycles = 0
    cycle_lengths = []
    last_cross = 0

    for i in range(1, len(filtered)):
        # 음→양(호기→흡기) 전환: 1 사이클 완료
        if filtered[i - 1] < -10 and filtered[i] >= -10:
            cycles += 1
            if last_cross > 0:
                cycle_lengths.append(i - last_cross)
            last_cross = i

    return cycles, cycle_lengths


def classify_phase(dp_pa: float) -> str:
    """차압 값으로 호흡 단계 분류"""
    if dp_pa > 20:
        return "inhale"
    elif dp_pa < -20:
        return "exhale"
    return "idle"


def calculate_score(
    samples: List[float],
    min_pa: float,
    max_pa: float,
    target_cycles: int = 30,
) -> Tuple[int, dict]:
    """
    훈련 점수 계산 (0~100)

    Args:
        samples: 차압 샘플 리스트 (Pa)
        min_pa: 목표 최소 압력 (흡기 기준)
        max_pa: 목표 최대 압력
        target_cycles: 목표 호흡 사이클 수

    Returns:
        (점수, 상세 분석 dict)
    """
    if not samples or len(samples) < 10:
        return 0, {"error": "샘플 부족"}

    arr = np.array(samples)

    # ─── 1) 목표 압력 범위 내 흡기 샘플 비율 (가중치 50%) ───
    inhale_samples = arr[arr > 20]  # 흡기 구간만
    if len(inhale_samples) > 0:
        in_range = np.sum((inhale_samples >= min_pa) & (inhale_samples <= max_pa))
        pressure_ratio = float(in_range) / len(inhale_samples)
    else:
        pressure_ratio = 0.0

    # ─── 2) 호흡 리듬 일관성 (가중치 30%) ───
    total_cycles, cycle_lengths = detect_cycles(list(arr))
    if len(cycle_lengths) >= 2:
        std_cycles = float(np.std(cycle_lengths))
        mean_cycles = float(np.mean(cycle_lengths))
        # 변동계수(CV)를 리듬 점수로 변환: CV=0 → 100점, CV>=1 → 0점
        cv = std_cycles / (mean_cycles + 1e-6)
        rhythm_score = max(0.0, 1.0 - cv)
    else:
        rhythm_score = 0.5  # 사이클 부족 시 중간값

    # ─── 3) 완료 사이클 비율 (가중치 20%) ───
    cycle_ratio = min(1.0, total_cycles / max(target_cycles, 1))

    # ─── 최종 점수 합산 ───
    score = (
        0.5 * pressure_ratio * 100
        + 0.3 * rhythm_score * 100
        + 0.2 * cycle_ratio * 100
    )
    score = max(0, min(100, round(score)))

    detail = {
        "pressure_ratio": round(pressure_ratio * 100, 1),
        "rhythm_score": round(rhythm_score * 100, 1),
        "cycle_ratio": round(cycle_ratio * 100, 1),
        "total_cycles": total_cycles,
        "avg_pressure": round(float(np.mean(inhale_samples)) if len(inhale_samples) > 0 else 0, 1),
        "max_pressure": round(float(np.max(arr)), 1),
        "min_pressure": round(float(np.min(arr)), 1),
    }

    return score, detail


def compute_session_stats(samples_pa: List[float]) -> dict:
    """세션 전체 통계 산출"""
    if not samples_pa:
        return {}
    arr = np.array(samples_pa)
    inhale = arr[arr > 20]
    return {
        "avg_peak_pressure": round(float(np.mean(inhale)) if len(inhale) > 0 else 0, 1),
        "max_pressure": round(float(np.max(arr)), 1),
        "min_pressure": round(float(np.min(arr)), 1),
        "total_cycles": detect_cycles(list(arr))[0],
    }
