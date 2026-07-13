"""
Flask-SocketIO 이벤트 핸들러
클라이언트 ↔ 서버 실시간 통신

변경점:
- 세션 종료·점수 계산은 services.session_service.finalize_session 하나로 통일
  (점수는 항상 DB 원본 샘플 기준).
- 소켓 연결 해제(새로고침·모바일 백그라운드) 시 세션을 강제 종료하지 않는다.
  대신 새 세션 시작 시 이전 열린 세션을 정리한다.
"""
from datetime import datetime
from flask import request
from flask_login import current_user
from flask_socketio import emit, join_room

from extensions import socketio, db
from models import TrainingSession, Device
from services.score_engine import classify_phase
from services.session_service import finalize_session, close_stale_open_sessions


# 현재 진행 중인 세션 캐시 {sid: session_id} — 라이브 브로드캐스트 라우팅용
active_sessions: dict = {}


@socketio.on("connect")
def handle_connect():
    """클라이언트 연결"""
    print(f"[Socket.IO] 클라이언트 연결: {request.sid}")
    # 인증된 사용자는 즉시 개인 룸에 입장시켜 새로고침 후에도 measurement 를 수신
    if getattr(current_user, "is_authenticated", False):
        join_room(f"user_{current_user.id}")
    emit("connected", {"status": "ok", "sid": request.sid})


@socketio.on("disconnect")
def handle_disconnect():
    """
    클라이언트 연결 해제 — 세션을 강제 종료하지 않는다.
    (새로고침/일시적 네트워크 끊김으로 훈련이 조기 종료되던 문제 제거)
    세션은 명시적 end 또는 다음 세션 시작 시 정리된다.
    """
    active_sessions.pop(request.sid, None)
    print(f"[Socket.IO] 클라이언트 연결 해제: {request.sid}")


@socketio.on("start_session")
def handle_start_session(data: dict):
    """
    훈련 세션 시작
    data: { "level": int, "target_cycles": int (optional) }
    """
    if not getattr(current_user, "is_authenticated", False):
        emit("error", {"msg": "로그인이 필요합니다."})
        return

    level = int(data.get("level", 3))
    target_cycles = int(data.get("target_cycles", 30))
    user_id = current_user.id

    # 방치된 이전 세션 정리 (연결 해제로 남아있던 open 세션)
    close_stale_open_sessions(user_id)

    device = Device.query.filter_by(user_id=user_id).first()
    device_db_id = device.id if device else None

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
    """훈련 세션 종료 — 최종 점수 계산 후 결과 emit"""
    if not getattr(current_user, "is_authenticated", False):
        emit("error", {"msg": "로그인이 필요합니다."})
        return

    sid = request.sid
    session_id = active_sessions.pop(sid, None)

    if session_id is None:
        # 소켓 매핑이 없더라도 사용자의 열린 세션을 종료 (새로고침 후 종료 대응)
        session = (
            TrainingSession.query
            .filter_by(user_id=current_user.id)
            .filter(TrainingSession.ended_at.is_(None))
            .order_by(TrainingSession.started_at.desc())
            .first()
        )
    else:
        session = db.session.get(TrainingSession, session_id)

    if session is None or session.user_id != current_user.id:
        emit("error", {"msg": "진행 중인 세션이 없습니다."})
        return

    result = finalize_session(session)
    emit("session_ended", {"session_id": session.id, "result": result})
    print(f"[Socket.IO] 세션 종료: session_id={session.id}, score={result.get('score')}")


def broadcast_measurement(user_id: int, session_id: int, dp_pa: float, ts_ms: int):
    """
    ESP32로부터 받은 측정값을 해당 사용자 클라이언트에 실시간 push
    (routes/measurement.py 에서 호출)
    """
    socketio.emit(
        "measurement",
        {
            "ts_ms": ts_ms,
            "dp_pa": round(dp_pa, 1),
            "phase": classify_phase(dp_pa),
            "session_id": session_id,
        },
        room=f"user_{user_id}",
    )
