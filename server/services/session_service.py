"""
훈련 세션 종료·점수 산정 단일 진입점.

기존에는 REST 종료(routes/sessions.py)와 Socket.IO 종료(socket_handlers.py)가
각각 다른 데이터 소스(메모리 버퍼 vs DB)로 점수를 계산해 같은 세션에 서로 다른
점수가 나올 수 있었다. 이제 두 경로 모두 이 모듈을 호출하며, 점수는 항상
DB에 저장된 원본 샘플(단일 진실 공급원)로 계산한다.
"""
from datetime import datetime

from extensions import db
from models import TrainingSession, MeasurementSample
from config import Config
from services.score_engine import calculate_score, compute_session_stats


def finalize_session(session: "TrainingSession") -> dict:
    """
    세션을 종료 처리하고 DB 샘플 기준으로 점수를 계산해 저장한다.
    이미 종료된 세션이면 저장된 결과를 그대로 반환한다.
    """
    if session is None:
        return {}

    if session.ended_at is None:
        session.ended_at = datetime.utcnow()

    dp_values = [
        s.dp_pa
        for s in (
            MeasurementSample.query
            .filter_by(session_id=session.id)
            .order_by(MeasurementSample.ts_ms.asc())
            .all()
        )
    ]

    if dp_values and session.level:
        level_config = Config.SERVO_LEVEL_CONFIG.get(session.level, {})
        score, _ = calculate_score(
            dp_values,
            level_config.get("min_pa", 100),
            level_config.get("max_pa", 500),
            session.target_cycles or 30,
        )
        stats = compute_session_stats(dp_values)
        session.score = score
        session.total_cycles = stats.get("total_cycles", 0)
        session.avg_peak_pressure = stats.get("avg_peak_pressure", 0)
        session.max_pressure = stats.get("max_pressure", 0)
        session.min_pressure = stats.get("min_pressure", 0)

    db.session.commit()

    return {
        "session_id": session.id,
        "score": session.score,
        "total_cycles": session.total_cycles,
        "avg_peak_pressure": session.avg_peak_pressure,
        "min_pressure": session.min_pressure,
        "duration_seconds": session.duration_seconds(),
    }


def close_stale_open_sessions(user_id: int, keep_session_id: int | None = None):
    """
    새 세션을 시작할 때, 같은 사용자의 종료되지 않은(ended_at IS NULL) 이전 세션을
    정리한다. 소켓 연결 해제로 세션이 방치되던 문제를 여기서 흡수한다.
    """
    open_sessions = (
        TrainingSession.query
        .filter_by(user_id=user_id)
        .filter(TrainingSession.ended_at.is_(None))
        .all()
    )
    for s in open_sessions:
        if keep_session_id is not None and s.id == keep_session_id:
            continue
        finalize_session(s)
