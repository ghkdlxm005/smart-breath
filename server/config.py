import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# DB는 실행 위치(CWD) 기준 — 한글/공백 경로 문제 방지
_DB_PATH = os.path.join(BASE_DIR, "smart_breath.db")


def _split_origins(raw: str):
    """콤마로 구분된 CORS 출처 문자열을 리스트로 변환."""
    if not raw or raw.strip() == "*":
        return "*"
    return [o.strip() for o in raw.split(",") if o.strip()]


class Config:
    # ─── Flask 기본 ───
    SECRET_KEY = os.getenv("SECRET_KEY", "smart-breath-dev-secret-key-change-in-production")

    # ─── DB (DATABASE_URL 로 SQLite / Postgres 전환) ───
    # Render/Heroku 는 postgres:// 를 주지만 SQLAlchemy 는 postgresql:// 를 요구.
    _raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{_DB_PATH}")
    if _raw_db_url.startswith("postgres://"):
        _raw_db_url = _raw_db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _raw_db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False

    # ─── 세션 쿠키 (기본 same-origin → Lax) ───
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"

    # ─── CORS (기본은 same-origin 배포이므로 로컬 개발 출처만 허용) ───
    CORS_ORIGINS = _split_origins(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

    # ─── ESP32 데모 기기 폴백 토큰 (기기별 토큰이 우선) ───
    DEVICE_TOKEN = os.getenv("DEVICE_TOKEN", "esp32-device-token-dev")

    # ─── Socket.IO (async_mode 는 환경별로 다름: 개발 threading, 배포 eventlet) ───
    SOCKETIO_ASYNC_MODE = os.getenv("SOCKETIO_ASYNC_MODE", "threading")
    SOCKETIO_CORS_ALLOWED_ORIGINS = _split_origins(os.getenv("CORS_ORIGINS", "*"))

    # ─── 정적 프론트엔드 빌드 서빙 경로 (Flask 가 React dist 를 같은 출처로 서빙) ───
    CLIENT_DIST_DIR = os.getenv(
        "CLIENT_DIST_DIR",
        os.path.abspath(os.path.join(BASE_DIR, "..", "client", "dist")),
    )

    # ─── 호흡 신호 임계값 (서버·클라이언트 공통 규약) ───
    # 이 값을 넘으면 흡기, -값 미만이면 호기, 그 사이는 idle 로 분류.
    # 한 사이클 = 호기 구간을 지나 다시 흡기 구간으로 올라오는 1회 전환.
    PHASE_THRESHOLD_PA = 20

    # ─── 훈련 점수 가중치 ───
    SCORE_WEIGHT_PRESSURE = 0.5   # 목표 압력 범위 내 비율
    SCORE_WEIGHT_RHYTHM = 0.3     # 호흡 리듬 일관성
    SCORE_WEIGHT_CYCLES = 0.2     # 완료 사이클 비율

    # ─── 서보모터 레벨별 각도 및 목표 차압 범위 (Pa) ───
    SERVO_LEVEL_CONFIG = {
        1: {"inhale_deg": 30,  "exhale_deg": 30,  "min_pa": 100, "max_pa": 200},
        2: {"inhale_deg": 60,  "exhale_deg": 50,  "min_pa": 150, "max_pa": 280},
        3: {"inhale_deg": 90,  "exhale_deg": 70,  "min_pa": 220, "max_pa": 380},
        4: {"inhale_deg": 120, "exhale_deg": 90,  "min_pa": 300, "max_pa": 450},
        5: {"inhale_deg": 150, "exhale_deg": 110, "min_pa": 400, "max_pa": 500},
    }


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
    # 배포 기본은 same-origin 이므로 Secure 쿠키 + Lax 로 충분.
    # 프론트/백엔드 도메인을 분리한다면 SESSION_COOKIE_SAMESITE=None,
    # SESSION_COOKIE_SECURE=true, CORS_ORIGINS 에 프론트 도메인을 지정할 것.
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "true").lower() == "true"

    @staticmethod
    def validate():
        """배포 환경에서 위험한 기본값을 조기 차단."""
        secret = os.getenv("SECRET_KEY")
        if not secret or secret == Config.SECRET_KEY:
            raise RuntimeError(
                "SECRET_KEY 환경변수를 반드시 설정하세요 (기본값 사용 금지)."
            )


# 환경에 따라 설정 선택
config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
