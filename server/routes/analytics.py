"""
분석 / 추천 라우트
- GET  /api/analytics/summary
- GET  /api/recommendation/current
- POST /api/recommendation/apply
"""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
import numpy as np

from extensions import db
from models import TrainingSession, Device
from services.recommendation import get_recommendation, save_recommendation
from config import Config

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/api/analytics/summary", methods=["GET"])
@login_required
def analytics_summary():
    """
    기간별 훈련 분석 요약
    ?period=7d | 30d | 90d | 180d
    """
    period_str = request.args.get("period", "7d")
    period_days_map = {"7d": 7, "30d": 30, "90d": 90, "180d": 180}
    days = period_days_map.get(period_str, 7)
    cutoff = datetime.utcnow() - timedelta(days=days)

    sessions = (
        TrainingSession.query
        .filter(
            TrainingSession.user_id == current_user.id,
            TrainingSession.ended_at.isnot(None),
            TrainingSession.started_at >= cutoff,
        )
        .order_by(TrainingSession.started_at.asc())
        .all()
    )

    if not sessions:
        return jsonify({
            "period": period_str,
            "total_sessions": 0,
            "trend": [],
            "charts": {},
        })

    # ─── 트렌드 데이터 (날짜별 집계) ───
    from collections import defaultdict
    daily: dict = defaultdict(list)
    for s in sessions:
        day_key = s.started_at.strftime("%Y-%m-%d")
        daily[day_key].append({
            "score": s.score or 0,
            "avg_peak_pressure": s.avg_peak_pressure or 0,
            "duration": s.duration_seconds(),
        })

    trend = []
    for day_key in sorted(daily.keys()):
        entries = daily[day_key]
        trend.append({
            "date": day_key,
            "session_count": len(entries),
            "avg_score": round(float(np.mean([e["score"] for e in entries])), 1),
            "avg_peak_pressure": round(float(np.mean([e["avg_peak_pressure"] for e in entries])), 1),
            "total_duration_min": round(sum(e["duration"] for e in entries) / 60, 1),
        })

    # ─── 전체 통계 ───
    scores = [s.score for s in sessions if s.score is not None]
    pressures = [s.avg_peak_pressure for s in sessions if s.avg_peak_pressure is not None]
    durations = [s.duration_seconds() for s in sessions if s.ended_at]

    total_cycles_all = sum(s.total_cycles or 0 for s in sessions)

    # 레이더 차트용 능력치 (0~100 정규화)
    def normalize(val, min_v, max_v):
        if max_v == min_v:
            return 50
        return round(min(100, max(0, (val - min_v) / (max_v - min_v) * 100)), 1)

    radar = {
        "inhale_power": normalize(float(np.mean(pressures)) if pressures else 0, 0, 500),
        "exhale_power": normalize(float(np.mean(pressures)) if pressures else 0, 0, 400),
        "endurance": normalize(float(np.mean(durations)) if durations else 0, 0, 1800),
        "stability": normalize(float(np.std(scores)) if len(scores) > 1 else 0, 50, 0),  # 역수
        "rhythm": normalize(total_cycles_all / max(len(sessions), 1), 0, 60),
    }

    # 주간 훈련 빈도 (바차트)
    weekly_freq: dict = defaultdict(int)
    for s in sessions:
        week_key = s.started_at.strftime("%Y-W%W")
        weekly_freq[week_key] += 1

    weekly_chart = [
        {"week": k, "count": v}
        for k, v in sorted(weekly_freq.items())
    ]

    # 백분위 (더미 — 실사용 시 전체 유저 통계로 대체)
    avg_score = float(np.mean(scores)) if scores else 0
    percentile = min(99, max(1, int(avg_score)))

    return jsonify({
        "period": period_str,
        "total_sessions": len(sessions),
        "avg_score": round(avg_score, 1),
        "avg_peak_pressure": round(float(np.mean(pressures)) if pressures else 0, 1),
        "total_training_min": round(sum(durations) / 60, 1) if durations else 0,
        "percentile": percentile,
        "trend": trend,
        "radar": radar,
        "weekly_chart": weekly_chart,
    })


@analytics_bp.route("/api/recommendation/current", methods=["GET"])
@login_required
def current_recommendation():
    """현재 AI 강도 추천 조회"""
    result = get_recommendation(current_user.id, db.session)
    return jsonify(result)


@analytics_bp.route("/api/recommendation/apply", methods=["POST"])
@login_required
def apply_recommendation():
    """추천 레벨을 기기에 적용 + 추천 이력 저장"""
    data = request.get_json(silent=True) or {}
    level = int(data.get("level", 3))

    if not (1 <= level <= 5):
        return jsonify({"error": "레벨은 1~5 사이여야 합니다."}), 400

    # 기기 레벨 업데이트
    device = Device.query.filter_by(user_id=current_user.id).first()
    if device:
        device.current_level = level
        db.session.commit()

    # 추천 이력 저장
    rec_data = get_recommendation(current_user.id, db.session)
    save_recommendation(
        current_user.id, level,
        rec_data.get("reasons", []),
        rec_data.get("features", {}),
        db.session,
    )

    level_config = Config.SERVO_LEVEL_CONFIG.get(level, {})
    return jsonify({
        "message": f"레벨 {level} 적용 완료",
        "level": level,
        "servo_inhale_deg": level_config.get("inhale_deg"),
        "servo_exhale_deg": level_config.get("exhale_deg"),
        "target_pressure_range": {
            "min": level_config.get("min_pa"),
            "max": level_config.get("max_pa"),
        },
    })
