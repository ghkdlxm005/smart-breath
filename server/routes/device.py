"""
기기 관리 라우트
- GET  /api/devices        : 내 기기 목록
- POST /api/devices/pair   : 새 기기 페어링
- POST /api/devices/{id}/test : 수동 서보 테스트
- DELETE /api/devices/{id} : 기기 제거
"""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from extensions import db
from models import Device
from config import Config

device_bp = Blueprint("device", __name__, url_prefix="/api/devices")


@device_bp.route("", methods=["GET"])
@login_required
def list_devices():
    """내 기기 목록"""
    devices = Device.query.filter_by(user_id=current_user.id).all()
    return jsonify({"devices": [d.to_dict() for d in devices]})


@device_bp.route("/pair", methods=["POST"])
@login_required
def pair_device():
    """
    새 기기 페어링.
    - 미등록 기기: 새로 등록하고 기기 전용 토큰을 1회 발급.
    - 내 기기: 그대로 반환 (필요 시 토큰 재발급 옵션).
    - 다른 사용자 기기: 소유권 무단 이전 금지 (403).
    발급된 auth_token 은 이 응답에서만 노출되며, ESP32 펌웨어에 저장해 사용한다.
    """
    data = request.get_json(silent=True) or {}
    device_id_str = data.get("device_id", "").strip()

    if not device_id_str:
        return jsonify({"error": "device_id가 필요합니다."}), 400

    existing = Device.query.filter_by(device_id=device_id_str).first()
    if existing:
        if existing.user_id and existing.user_id != current_user.id:
            # 이미 다른 사용자가 소유 중 — 탈취 방지
            return jsonify({"error": "이미 다른 계정에 등록된 기기입니다."}), 403

        # 미소유(user_id=None) 기기이거나 내 기기 → 연결/재확인
        existing.user_id = current_user.id
        rotate = bool(data.get("rotate_token"))
        token = None
        if rotate or not existing.auth_token:
            token = Device.generate_token()
            existing.auth_token = token
        db.session.commit()
        resp = {"message": "기기 페어링 완료", "device": existing.to_dict()}
        if token:
            resp["auth_token"] = token  # 1회성 노출
        return jsonify(resp)

    token = Device.generate_token()
    device = Device(
        device_id=device_id_str,
        user_id=current_user.id,
        auth_token=token,
        mac_address=data.get("mac_address"),
        firmware_version=data.get("firmware_version"),
        current_level=1,
    )
    db.session.add(device)
    db.session.commit()

    return jsonify({
        "message": "기기 페어링 완료",
        "device": device.to_dict(),
        "auth_token": token,  # 1회성 노출 — ESP32 에 저장할 것
    }), 201


@device_bp.route("/<int:device_db_id>/test", methods=["POST"])
@login_required
def test_device(device_db_id: int):
    """수동 서보 테스트 (레벨 즉시 적용)"""
    device = Device.query.filter_by(
        id=device_db_id, user_id=current_user.id
    ).first_or_404()

    data = request.get_json(silent=True) or {}
    level = int(data.get("level", device.current_level or 1))

    if not (1 <= level <= 5):
        return jsonify({"error": "레벨은 1~5 사이여야 합니다."}), 400

    device.current_level = level
    db.session.commit()

    level_config = Config.SERVO_LEVEL_CONFIG.get(level, {})
    return jsonify({
        "message": f"레벨 {level} 서보 테스트 명령 전송",
        "device_id": device.device_id,
        "level": level,
        "servo_inhale_deg": level_config.get("inhale_deg"),
        "servo_exhale_deg": level_config.get("exhale_deg"),
    })


@device_bp.route("/<int:device_db_id>", methods=["DELETE"])
@login_required
def remove_device(device_db_id: int):
    """기기 제거"""
    device = Device.query.filter_by(
        id=device_db_id, user_id=current_user.id
    ).first_or_404()

    db.session.delete(device)
    db.session.commit()
    return jsonify({"message": "기기가 제거되었습니다."})
