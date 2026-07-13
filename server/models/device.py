import secrets
from datetime import datetime
from extensions import db


class Device(db.Model):
    """ESP32 기기 정보"""
    __tablename__ = "devices"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    device_id = db.Column(db.String(100), unique=True, nullable=False)  # esp32_01 등
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    # 기기별 개별 인증 토큰 (페어링 시 발급, 측정/명령 요청에서 검증)
    auth_token = db.Column(db.String(128), nullable=True)
    mac_address = db.Column(db.String(50), nullable=True)
    firmware_version = db.Column(db.String(50), nullable=True)
    last_seen = db.Column(db.DateTime, nullable=True)
    battery_percent = db.Column(db.Integer, nullable=True)
    current_level = db.Column(db.Integer, default=1)        # 현재 설정된 저항 레벨 (1~5)
    is_active = db.Column(db.Integer, default=1)

    @staticmethod
    def generate_token() -> str:
        """기기용 무작위 인증 토큰 생성"""
        return secrets.token_urlsafe(32)

    # 관계 설정
    training_sessions = db.relationship("TrainingSession", backref="device", lazy="dynamic")

    def update_last_seen(self):
        """마지막 통신 시각 갱신"""
        self.last_seen = datetime.utcnow()

    def is_online(self) -> bool:
        """최근 30초 이내 통신 여부로 온라인 판단"""
        if not self.last_seen:
            return False
        delta = (datetime.utcnow() - self.last_seen).total_seconds()
        return delta < 30

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "device_id": self.device_id,
            "user_id": self.user_id,
            "mac_address": self.mac_address,
            "firmware_version": self.firmware_version,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "battery_percent": self.battery_percent,
            "current_level": self.current_level,
            "is_online": self.is_online(),
        }

    def __repr__(self):
        return f"<Device {self.device_id}>"
