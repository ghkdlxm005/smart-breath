"""
훈련 세션 라우트: 시작 / 종료 / 조회 / 파형 데이터
"""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from extensions import db
from models import TrainingSession, MeasurementSample, Device

sessions_bp = Blueprint("sessions", __name__, url_prefix="/api/sessions")


@sessions_bp.route("/start", methods=["POST"])
@login_required
def start_session():
    """
    훈련 세션 시작 (REST 기반, Socket.IO start_session 이벤트의 HTTP 대안)
    """
    data = request.get_json(silent=True) or {}
    level = int(data.get("level", 3))
    target_cycles = int(data.get("target_cycles", 30))

    device = Device.query.filter_by(user_id=current_user.id).first()
    device_db_id = device.id if device else None

    session = TrainingSession(
        user_id=current_user.id,
        device_id=device_db_id,
        started_at=datetime.utcnow(),
        level=level,
        target_cycles=target_cycles,
    )
    db.session.add(session)
    db.session.commit()

    return jsonify({"session": session.to_dict()}), 201


@sessions_bp.route("/<int:session_id>/end", methods=["POST"])
@login_required
def end_session(session_id: int):
    """훈련 세션 종료 및 점수 계산"""
    session = TrainingSession.query.filter_by(
        id=session_id, user_id=current_user.id
    ).first_or_404()

    if session.ended_at:
        return jsonify({"error": "이미 종료된 세션입니다."}), 400

    # 점수 계산은 Socket.IO 종료 경로와 동일한 단일 진입점 사용 (항상 DB 샘플 기준)
    from services.session_service import finalize_session
    finalize_session(session)

    return jsonify({"session": session.to_dict()})


@sessions_bp.route("", methods=["GET"])
@login_required
def list_sessions():
    """세션 리스트 (페이지네이션, 날짜 필터)"""
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    from_dt = request.args.get("from")
    to_dt = request.args.get("to")

    query = TrainingSession.query.filter_by(user_id=current_user.id)

    if from_dt:
        try:
            query = query.filter(TrainingSession.started_at >= datetime.fromisoformat(from_dt))
        except ValueError:
            pass
    if to_dt:
        try:
            query = query.filter(TrainingSession.started_at <= datetime.fromisoformat(to_dt))
        except ValueError:
            pass

    query = query.order_by(TrainingSession.started_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "sessions": [s.to_dict() for s in paginated.items],
        "total": paginated.total,
        "page": page,
        "pages": paginated.pages,
    })


@sessions_bp.route("/<int:session_id>", methods=["GET"])
@login_required
def get_session(session_id: int):
    """단일 세션 상세"""
    session = TrainingSession.query.filter_by(
        id=session_id, user_id=current_user.id
    ).first_or_404()
    return jsonify({"session": session.to_dict()})


@sessions_bp.route("/<int:session_id>/samples", methods=["GET"])
@login_required
def get_session_samples(session_id: int):
    """세션 파형 데이터 (다운샘플링 지원)"""
    session = TrainingSession.query.filter_by(
        id=session_id, user_id=current_user.id
    ).first_or_404()

    # 다운샘플링: 최대 2000개 포인트
    max_points = int(request.args.get("max_points", 2000))

    samples = (
        MeasurementSample.query
        .filter_by(session_id=session_id)
        .order_by(MeasurementSample.ts_ms.asc())
        .all()
    )

    total = len(samples)
    if total > max_points:
        step = total // max_points
        samples = samples[::step][:max_points]

    return jsonify({
        "session_id": session_id,
        "total_raw_samples": total,
        "samples": [s.to_dict() for s in samples],
    })
