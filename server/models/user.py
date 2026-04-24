from datetime import datetime
from flask_login import UserMixin
from extensions import db
import bcrypt


class User(UserMixin, db.Model):
    """사용자 계정 및 기본 신체 정보"""
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    birth_date = db.Column(db.Date, nullable=True)
    gender = db.Column(db.String(1), nullable=True)          # 'M' | 'F' | 'O'
    height_cm = db.Column(db.Float, nullable=True)
    weight_kg = db.Column(db.Float, nullable=True)
    is_smoker = db.Column(db.Integer, default=0)             # 0: 비흡연, 1: 흡연
    baseline_peak_pressure = db.Column(db.Float, nullable=True)  # 온보딩 기준 흡기압 (Pa)
    target_daily_sessions = db.Column(db.Integer, default=3)
    is_admin = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 관계 설정
    devices = db.relationship("Device", backref="user", lazy="dynamic")
    training_sessions = db.relationship("TrainingSession", backref="user", lazy="dynamic")
    recommendations = db.relationship("Recommendation", backref="user", lazy="dynamic")

    def set_password(self, password: str):
        """비밀번호를 bcrypt로 해시하여 저장"""
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, password: str) -> bool:
        """비밀번호 검증"""
        return bcrypt.checkpw(
            password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    def to_dict(self, include_sensitive=False) -> dict:
        """직렬화 (API 응답용)"""
        data = {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "birth_date": self.birth_date.isoformat() if self.birth_date else None,
            "gender": self.gender,
            "height_cm": self.height_cm,
            "weight_kg": self.weight_kg,
            "is_smoker": bool(self.is_smoker),
            "baseline_peak_pressure": self.baseline_peak_pressure,
            "target_daily_sessions": self.target_daily_sessions,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        return data

    def __repr__(self):
        return f"<User {self.email}>"
