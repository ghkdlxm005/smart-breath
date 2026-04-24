"""
측정 데이터 라우트 (ESP32 전용)
- POST /api/measurement : 배치 업로드
- GET  /api/device/{device_id}/command : 서보 제어 명령 폴링
"""
import time
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app

from extensions import db
from models import Device, TrainingSession, MeasurementSample
from services.score_engine import classify_phase

measurement_bp = Blueprint("measurement", __name__, url_prefix="/api")


def _verify_device_token() -> bool:
    """ESP32 장치 토큰 검증 (Authorization: Bearer <token>)"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return False
    token = auth_header[7:]
    return token == current_app.config.get("DEVICE_TOKEN", "")


@measurement_bp.route("/measurement", methods=["POST"])
def upload_measurement():
    """
    ESP32 배치 측정 데이터 업로드

    Body:
    {
      "device_id": "esp32_01",
      "session_id": "sess_20260418_093012",  (선택 — 없으면 활성 세션 자동 조회)
      "samples": [
        {"ts_ms": 1729000000123, "dp_pa": 142.3},
        ...
      ]
    }
    """
    if not _verify_device_token():
        return jsonify({"error": "장치 인증 실패"}), 401

    data = request.get_json(silent=True) or {}
    device_id_str = data.get("device_id")
    samples_raw = data.get("samples", [])

    if not device_id_str or not samples_raw:
        return jsonify({"error": "device_id 와 samples 필드가 필요합니다."}), 400

    # 기기 조회 및 마지막 통신 갱신
    device = Device.query.filter_by(device_id=device_id_str).first()
    if not device:
        return jsonify({"error": f"등록되지 않은 기기: {device_id_str}"}), 404

    device.update_last_seen()
    if data.get("battery_percent") is not None:
        device.battery_percent = int(data["battery_percent"])

    # 활성 세션 조회 (해당 기기 + 종료되지 않은 세션)
    active_session = (
        TrainingSession.query
        .filter_by(device_id=device.id)
        .filter(TrainingSession.ended_at.is_(None))
        .order_by(TrainingSession.started_at.desc())
        .first()
    )

    if not active_session:
        db.session.commit()
        return jsonify({"status": "no_active_session", "saved": 0}), 200

    # 샘플 저장 및 실시간 브로드캐스트
    from services.socket_handlers import broadcast_measurement

    batch = []
    for s in samples_raw:
        ts_ms = s.get("ts_ms") or int(time.time() * 1000)
        dp_pa = float(s.get("dp_pa", 0))
        phase = classify_phase(dp_pa)

        sample = MeasurementSample(
            session_id=active_session.id,
            ts_ms=ts_ms,
            dp_pa=dp_pa,
            phase=phase,
        )
        batch.append(sample)

        # 10Hz로 다운샘플링하여 브로드캐스트 (배치 첫 번째 샘플만)
        if len(batch) == 1 or len(batch) % 10 == 0:
            broadcast_measurement(
                active_session.user_id, active_session.id, dp_pa, ts_ms
            )

    db.session.bulk_save_objects(batch)
    db.session.commit()

    return jsonify({"status": "ok", "saved": len(batch), "session_id": active_session.id})


@measurement_bp.route("/device/<string:device_id>/command", methods=["GET"])
def get_device_command(device_id: str):
    """
    서보 제어 명령 폴링 (ESP32 → 서버, 1초 주기)
    Response: { "cmd": "set_level", "level": 3, "servo_inhale_deg": 90, ... }
    """
    if not _verify_device_token():
        return jsonify({"error": "장치 인증 실패"}), 401

    device = Device.query.filter_by(device_id=device_id).first()
    if not device:
        return jsonify({"error": "등록되지 않은 기기"}), 404

    device.update_last_seen()
    db.session.commit()

    level = device.current_level or 1
    from config import Config
    level_config = Config.SERVO_LEVEL_CONFIG.get(level, Config.SERVO_LEVEL_CONFIG[1])

    return jsonify({
        "cmd": "set_level",
        "level": level,
        "servo_inhale_deg": level_config["inhale_deg"],
        "servo_exhale_deg": level_config["exhale_deg"],
        "timestamp": int(time.time()),
    })
