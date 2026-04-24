from datetime import datetime
from extensions import db


class TrainingSession(db.Model):
    """훈련 세션 (1회 훈련 = 1 row)"""
    __tablename__ = "training_sessions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    device_id = db.Column(db.Integer, db.ForeignKey("devices.id"), nullable=True)
    started_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
    level = db.Column(db.Integer, nullable=True)             # 저항 레벨 1~5
    total_cycles = db.Column(db.Integer, nullable=True)      # 총 호흡 사이클 수
    avg_peak_pressure = db.Column(db.Float, nullable=True)   # 평균 최대 흡기압 (Pa)
    max_pressure = db.Column(db.Float, nullable=True)        # 최대 압력 (Pa)
    min_pressure = db.Column(db.Float, nullable=True)        # 최소 압력 (Pa)
    score = db.Column(db.Integer, nullable=True)             # 훈련 점수 0~100
    notes = db.Column(db.Text, nullable=True)                # AI 코멘트 등
    target_cycles = db.Column(db.Integer, default=30)        # 목표 사이클 수

    # 관계 설정
    samples = db.relationship(
        "MeasurementSample", backref="session",
        lazy="dynamic", cascade="all, delete-orphan"
    )

    def duration_seconds(self) -> float:
        """훈련 지속 시간 (초)"""
        if self.ended_at and self.started_at:
            return (self.ended_at - self.started_at).total_seconds()
        return 0.0

    def to_dict(self, include_samples=False) -> dict:
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "device_id": self.device_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "duration_seconds": self.duration_seconds(),
            "level": self.level,
            "total_cycles": self.total_cycles,
            "avg_peak_pressure": self.avg_peak_pressure,
            "max_pressure": self.max_pressure,
            "min_pressure": self.min_pressure,
            "score": self.score,
            "notes": self.notes,
            "target_cycles": self.target_cycles,
        }
        if include_samples:
            data["samples"] = [s.to_dict() for s in self.samples.order_by(
                MeasurementSample.ts_ms.asc()
            ).all()]
        return data

    def __repr__(self):
        return f"<TrainingSession id={self.id} user_id={self.user_id}>"


class MeasurementSample(db.Model):
    """개별 차압 샘플 (100Hz 고해상도 파형 저장)"""
    __tablename__ = "measurement_samples"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    session_id = db.Column(
        db.Integer, db.ForeignKey("training_sessions.id"), nullable=False
    )
    ts_ms = db.Column(db.BigInteger, nullable=False)  # Unix timestamp (밀리초)
    dp_pa = db.Column(db.Float, nullable=False)        # 차압 (Pa), + = 흡기, - = 호기
    phase = db.Column(db.String(10), nullable=True)    # 'inhale' | 'exhale' | 'idle'

    __table_args__ = (
        db.Index("idx_samples_session", "session_id", "ts_ms"),
    )

    def to_dict(self) -> dict:
        return {
            "ts_ms": self.ts_ms,
            "dp_pa": self.dp_pa,
            "phase": self.phase,
        }


class Recommendation(db.Model):
    """AI 강도 추천 이력"""
    __tablename__ = "recommendations"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    recommended_level = db.Column(db.Integer, nullable=False)
    reasoning_json = db.Column(db.Text, nullable=True)  # JSON: features + 설명
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        import json
        reasoning = {}
        if self.reasoning_json:
            try:
                reasoning = json.loads(self.reasoning_json)
            except Exception:
                reasoning = {}
        return {
            "id": self.id,
            "user_id": self.user_id,
            "recommended_level": self.recommended_level,
            "reasoning": reasoning,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
