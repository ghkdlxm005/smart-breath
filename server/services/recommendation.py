"""
개인 데이터 기반 훈련 강도 추천 서비스
- 규칙 기반 + ML 하이브리드 (현재는 규칙 기반, 30명 이상 시 ML 확장 가능)
"""
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional


def extract_features(user_id: int, db_session) -> Optional[dict]:
    """
    최근 14일 훈련 데이터에서 추천 알고리즘용 특징값 추출

    Args:
        user_id: 사용자 ID
        db_session: SQLAlchemy 세션

    Returns:
        특징값 dict 또는 None (데이터 부족 시)
    """
    from models import TrainingSession

    cutoff_14d = datetime.utcnow() - timedelta(days=14)
    cutoff_7d = datetime.utcnow() - timedelta(days=7)

    sessions_14d = (
        db_session.query(TrainingSession)
        .filter(
            TrainingSession.user_id == user_id,
            TrainingSession.ended_at.isnot(None),
            TrainingSession.started_at >= cutoff_14d,
        )
        .order_by(TrainingSession.started_at.asc())
        .all()
    )

    if not sessions_14d:
        return None

    # pandas DataFrame으로 변환
    rows = [
        {
            "started_at": s.started_at,
            "score": s.score or 0,
            "avg_peak_pressure": s.avg_peak_pressure or 0,
            "total_cycles": s.total_cycles or 0,
        }
        for s in sessions_14d
    ]
    df = pd.DataFrame(rows)
    df["day"] = (df["started_at"] - df["started_at"].min()).dt.days

    # 최근 7일 세션 필터
    sessions_7d = [s for s in sessions_14d if s.started_at >= cutoff_7d]

    # ─── 특징값 계산 ───
    scores_7d = [s.score or 0 for s in sessions_7d]
    pressures_7d = [s.avg_peak_pressure or 0 for s in sessions_7d]

    avg_score_7d = float(np.mean(scores_7d)) if scores_7d else 0.0
    std_score_7d = float(np.std(scores_7d)) if len(scores_7d) > 1 else 0.0

    # 14일 선형회귀 기울기 (점수 개선 추세)
    trend_slope = 0.0
    if len(df) >= 3:
        try:
            x = df["day"].values.reshape(-1, 1)
            y = df["score"].values
            # numpy 최소제곱법
            A = np.vstack([x.flatten(), np.ones(len(x))]).T
            result = np.linalg.lstsq(A, y, rcond=None)
            trend_slope = float(result[0][0]) if len(result[0]) > 0 else 0.0
        except Exception:
            trend_slope = 0.0

    # 주간 훈련 빈도 (최근 7일)
    sessions_per_week = len(sessions_7d)

    # 호흡 리듬 일관성 (사이클 수 역수로 대리 지표)
    cycle_values = [s.total_cycles or 0 for s in sessions_7d if (s.total_cycles or 0) > 0]
    if len(cycle_values) >= 2:
        rhythm_consistency = 1.0 / (float(np.std(cycle_values)) + 1.0)
    else:
        rhythm_consistency = 0.5

    avg_peak_7d = float(np.mean(pressures_7d)) if pressures_7d else 0.0

    # 사용자 기초 폐활량
    from models import User
    user = db_session.get(User, user_id)
    baseline = user.baseline_peak_pressure or 0.0 if user else 0.0

    features = {
        "avg_peak_pressure_7d": round(avg_peak_7d, 1),
        "trend_slope_14d": round(trend_slope, 3),
        "score_mean_7d": round(avg_score_7d, 1),
        "score_std_7d": round(std_score_7d, 1),
        "sessions_per_week": sessions_per_week,
        "rhythm_consistency": round(rhythm_consistency, 3),
        "baseline_lung_capacity": round(baseline, 1),
    }
    return features


def recommend_level(features: dict, current_level: int) -> tuple:
    """
    규칙 기반 강도 추천 알고리즘

    Args:
        features: extract_features()의 반환값
        current_level: 현재 저항 레벨 (1~5)

    Returns:
        (추천 레벨, 점수, 이유 리스트)
    """
    score = 0
    reasons = []

    score_mean = features.get("score_mean_7d", 0)
    score_std = features.get("score_std_7d", 999)
    trend = features.get("trend_slope_14d", 0)
    freq = features.get("sessions_per_week", 0)

    # ─── 규칙 1: 최근 점수 기반 ───
    if score_mean >= 85 and score_std < 10:
        score += 2
        reasons.append({
            "type": "success",
            "text": f"최근 7일 평균 점수 {score_mean:.0f}점 (안정적)"
        })
    elif score_mean >= 75:
        score += 1
        reasons.append({
            "type": "success",
            "text": f"최근 7일 평균 점수 {score_mean:.0f}점"
        })
    elif score_mean < 60:
        score -= 1
        reasons.append({
            "type": "warning",
            "text": f"최근 7일 평균 점수 {score_mean:.0f}점 (낮음)"
        })
    else:
        reasons.append({
            "type": "info",
            "text": f"최근 7일 평균 점수 {score_mean:.0f}점"
        })

    # ─── 규칙 2: 개선 추세 ───
    if trend > 5:
        score += 1
        reasons.append({
            "type": "success",
            "text": "최대 흡기압 2주 연속 상승"
        })
    elif trend < -3:
        score -= 1
        reasons.append({
            "type": "warning",
            "text": "점수 하락 추세 감지"
        })
    else:
        reasons.append({
            "type": "info",
            "text": "점수 추세 안정"
        })

    # ─── 규칙 3: 훈련 빈도 ───
    if freq >= 4:
        reasons.append({
            "type": "success",
            "text": f"훈련 빈도 주 {freq}회 유지"
        })
    elif freq < 3:
        score = min(score, 0)  # 빈도 부족 시 강도 상향 불가
        reasons.append({
            "type": "warning",
            "text": f"훈련 빈도 주 {freq}회 (부족)"
        })
    else:
        reasons.append({
            "type": "info",
            "text": f"훈련 빈도 주 {freq}회"
        })

    # ─── 규칙 4: 리듬 안정성 ───
    rhythm = features.get("rhythm_consistency", 0.5)
    if rhythm < 0.3:
        reasons.append({
            "type": "warning",
            "text": "호흡 안정성 변동 큼 — 현재 강도 유지 권장"
        })
        score = min(score, 0)

    # ─── 최종 레벨 계산 ───
    if score >= 2:
        delta = 1
    elif score <= -2:
        delta = -1
    else:
        delta = 0

    recommended = max(1, min(5, current_level + delta))

    return recommended, score, reasons


def get_recommendation(user_id: int, db_session) -> dict:
    """
    사용자에게 강도 추천 결과 반환

    Returns:
        {
            "recommended_level": int,
            "current_level": int,
            "reasons": list,
            "features": dict,
            "has_enough_data": bool
        }
    """
    from models import Device

    # 현재 레벨 조회 (첫 번째 기기 기준)
    device = (
        db_session.query(Device)
        .filter(Device.user_id == user_id)
        .first()
    )
    current_level = device.current_level if device else 1

    features = extract_features(user_id, db_session)

    if not features:
        # 데이터 부족: 기본값 반환
        return {
            "recommended_level": current_level,
            "current_level": current_level,
            "reasons": [{"type": "info", "text": "훈련 데이터가 부족합니다. 최소 1회 이상 훈련 후 추천이 가능합니다."}],
            "features": {},
            "has_enough_data": False,
        }

    rec_level, score, reasons = recommend_level(features, current_level)

    return {
        "recommended_level": rec_level,
        "current_level": current_level,
        "score_delta": score,
        "reasons": reasons,
        "features": features,
        "has_enough_data": True,
    }


def save_recommendation(user_id: int, rec_level: int, reasons: list, features: dict, db_session):
    """추천 결과를 DB에 저장"""
    from models import Recommendation
    reasoning = {"reasons": reasons, "features": features}
    rec = Recommendation(
        user_id=user_id,
        recommended_level=rec_level,
        reasoning_json=json.dumps(reasoning, ensure_ascii=False),
    )
    db_session.add(rec)
    db_session.commit()
    return rec
