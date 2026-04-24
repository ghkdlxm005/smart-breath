"""
Flask-SocketIO 이벤트 핸들러
클라이언트 ↔ 서버 실시간 통신
"""
from datetime import datetime
from flask import request
from flask_login import current_user
from flask_socketio import emit, join_room, leave_room

from extensions import socketio, db
from models import TrainingSession, Device
from config import Config
from services.score_engine import calculate_score, classify_phase, compute_session_stats


# 현재 진행 중인 세션 캐시 {sid: session_id}
active_sessions: dict = {}
# 실시간 샘플 버퍼 {session_id: [dp_pa, ...]}
sample_buffer: dict = {}


@socketio.on("connect")
def handle_connect():
    """클라이언트 연결"""
    print(f"[Socket.IO] 클라이언트 연결: {request.sid}")
    emit("connected", {"status": "ok", "sid": request.sid})


@socketio.on("disconnect")
def handle_disconnect():
    """클라이언트 연결 해제 — 진행 중 세션 자동 종료"""
    sid = request.sid
    if sid in active_sessions:
        session_id = active_sessions.pop(sid)
        _finalize_session(session_id)
        print(f"[Socket.IO] 세션 {session_id} 자동 종료 (연결 해제)")
    if sid in sample_buffer:
        del sample_buffer[sid]
    print(f"[Socket.IO] 클라이언트 연결 해제: {sid}")


@socketio.on("start_session")
def handle_start_session(data: dict):
    """
    훈련 세션 시작
    data: { "level": int, "target_cycles": int (optional) }
    """
    if not current_user.is_authenticated:
        emit("error", {"msg": "로그인이 필요합니다."})
        return

    level = int(data.get("level", 3))
    target_cycles = int(data.get("target_cycles", 30))
    user_id = current_user.id

    # 기기 조회
    device = Device.query.filter_by(user_id=user_id).first()
    device_db_id = device.id if device else None

    # 새 세션 생성
    session = TrainingSession(
        user_id=user_id,
        device_id=device_db_id,
        started_at=datetime.utcnow(),
        level=level,
        target_cycles=target_cycles,
    )
    db.session.add(session)
    db.session.commit()

    active_sessions[request.sid] = session.id
    sample_buffer[session.id] = []

    # 사용자 전용 룸 입장 (멀티 탭 지원)
    join_room(f"user_{user_id}")

    emit("session_started", {
        "session_id": session.id,
        "level": level,
        "target_cycles": target_cycles,
        "started_at": session.started_at.isoformat(),
    })
    print(f"[Socket.IO] 세션 시작: user={user_id}, session_id={session.id}, level={level}")


@socketio.on("end_session")
def handle_end_session(_data=None):
    """
    훈련 세션 종료 — 최종 점수 계산 후 결과 emit
    """
    sid = request.sid
    if sid not in active_sessions:
        emit("error", {"msg": "진행 중인 세션이 없습니다."})
        return

    session_id = active_sessions.pop(sid)
    result = _finalize_session(session_id)

    emit("session_ended", {
        "session_id": session_id,
        "result": result,
    })
    print(f"[Socket.IO] 세션 종료: session_id={session_id}, score={result.get('score')}")


def broadcast_measurement(user_id: int, session_id: int, dp_pa: float, ts_ms: int):
    """
    ESP32로부터 받은 측정값을 해당 사용자 클라이언트에 실시간 push
    (routes/measurement.py 에서 호출)
    """
    phase = classify_phase(dp_pa)

    # 샘플 버퍼에 적재
    if session_id in sample_buffer:
        sample_buffer[session_id].append(dp_pa)
        # 30초 슬라이딩 윈도우 유지 (100Hz × 30s = 3000개)
        if len(sample_buffer[session_id]) > 3000:
            sample_buffer[session_id] = sample_buffer[session_id][-3000:]

    socketio.emit(
        "measurement",
        {
            "ts_ms": ts_ms,
            "dp_pa": round(dp_pa, 1),
            "phase": phase,
            "session_id": session_id,
        },
        room=f"user_{user_id}",
    )


def _finalize_session(session_id: int) -> dict:
    """세션을 종료하고 점수를 계산하여 DB에 저장"""
    session = db.session.get(TrainingSession, session_id)
    if not session:
        return {}

    session.ended_at = datetime.utcnow()

    # 샘플 버퍼에서 점수 계산
    samples = sample_buffer.pop(session_id, [])

    if samples and session.level:
        level_config = Config.SERVO_LEVEL_CONFIG.get(session.level, {})
        min_pa = level_config.get("min_pa", 100)
        max_pa = level_config.get("max_pa", 500)

        score, detail = calculate_score(
            samples, min_pa, max_pa,
            target_cycles=session.target_cycles or 30
        )
        stats = compute_session_stats(samples)

        session.score = score
        session.total_cycles = stats.get("total_cycles", 0)
        session.avg_peak_pressure = stats.get("avg_peak_pressure", 0)
        session.max_pressure = stats.get("max_pressure", 0)
        session.min_pressure = stats.get("min_pressure", 0)
    else:
        # DB에 저장된 샘플로 재계산
        from models import MeasurementSample
        db_samples = (
            MeasurementSample.query
            .filter_by(session_id=session_id)
            .order_by(MeasurementSample.ts_ms.asc())
            .all()
        )
        if db_samples and session.level:
            dp_values = [s.dp_pa for s in db_samples]
            level_config = Config.SERVO_LEVEL_CONFIG.get(session.level, {})
            score, _ = calculate_score(
                dp_values,
                level_config.get("min_pa", 100),
                level_config.get("max_pa", 500),
                session.target_cycles or 30
            )
            stats = compute_session_stats(dp_values)
            session.score = score
            session.total_cycles = stats.get("total_cycles", 0)
            session.avg_peak_pressure = stats.get("avg_peak_pressure", 0)
            session.max_pressure = stats.get("max_pressure", 0)
            session.min_pressure = stats.get("min_pressure", 0)

    db.session.commit()

    return {
        "session_id": session_id,
        "score": session.score,
        "total_cycles": session.total_cycles,
        "avg_peak_pressure": session.avg_peak_pressure,
        "duration_seconds": session.duration_seconds(),
    }
