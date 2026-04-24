import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    # Flask 기본 설정
    SECRET_KEY = os.getenv("SECRET_KEY", "smart-breath-dev-secret-key-change-in-production")

    # SQLite DB 경로
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(BASE_DIR, 'db', 'smart_breath.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False

    # Flask-Login 설정
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"

    # CORS 허용 출처 (개발 중 전체, 배포 시 명시)
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # ESP32 장치 인증 토큰 (환경변수로 관리)
    DEVICE_TOKEN = os.getenv("DEVICE_TOKEN", "esp32-device-token-dev")

    # Socket.IO 설정
    SOCKETIO_ASYNC_MODE = "eventlet"
    SOCKETIO_CORS_ALLOWED_ORIGINS = "*"

    # 훈련 점수 가중치
    SCORE_WEIGHT_PRESSURE = 0.5   # 목표 압력 범위 내 비율
    SCORE_WEIGHT_RHYTHM = 0.3     # 호흡 리듬 일관성
    SCORE_WEIGHT_CYCLES = 0.2     # 완료 사이클 비율

    # 서보모터 레벨별 각도 및 목표 차압 범위 (Pa)
    SERVO_LEVEL_CONFIG = {
        1: {"inhale_deg": 30,  "exhale_deg": 30,  "min_pa": 100, "max_pa": 200},
        2: {"inhale_deg": 60,  "exhale_deg": 50,  "min_pa": 150, "max_pa": 280},
        3: {"inhale_deg": 90,  "exhale_deg": 70,  "min_pa": 220, "max_pa": 380},
        4: {"inhale_deg": 120, "exhale_deg": 90,  "min_pa": 300, "max_pa": 450},
        5: {"inhale_deg": 150, "exhale_deg": 110, "min_pa": 400, "max_pa": 500},
    }


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = False


class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SECURE = True
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost")


# 환경에 따라 설정 선택
config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
