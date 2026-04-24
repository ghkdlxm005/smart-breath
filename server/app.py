"""
스마트 호흡 훈련기 — Flask 서버 엔트리포인트
실행: python app.py
"""
import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_login import LoginManager

from extensions import db, socketio
from config import config


def create_app(env: str = "default") -> Flask:
    """애플리케이션 팩토리"""
    app = Flask(__name__)
    app.config.from_object(config[env])

    # DB 디렉토리 자동 생성 (sqlite 파일 경로의 부모 폴더)
    db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if db_uri.startswith("sqlite:///"):
        db_path = db_uri[len("sqlite:///"):]
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

    # ─── 확장 초기화 ───
    db.init_app(app)
    CORS(app, supports_credentials=True, origins="*")

    # eventlet 대신 threading 모드 사용 (Python 3.13 호환)
    socketio.init_app(
        app,
        cors_allowed_origins="*",
        async_mode="threading",
        logger=False,
        engineio_logger=False,
    )

    # ─── Flask-Login ───
    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id: str):
        from models import User
        return db.session.get(User, int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({"error": "로그인이 필요합니다."}), 401

    # ─── 블루프린트 등록 ───
    from routes.auth import auth_bp
    from routes.sessions import sessions_bp
    from routes.measurement import measurement_bp
    from routes.analytics import analytics_bp
    from routes.device import device_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(sessions_bp)
    app.register_blueprint(measurement_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(device_bp)

    # ─── Socket.IO 이벤트 핸들러 등록 ───
    import services.socket_handlers  # noqa: F401 (side-effect import)

    # ─── DB 테이블 자동 생성 ───
    with app.app_context():
        db.create_all()
        _seed_demo_data(app)

    # ─── 헬스체크 ───
    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "service": "smart-breath-server"})

    return app


def _seed_demo_data(app: Flask):
    """
    최초 실행 시 데모 데이터 생성 (이미 있으면 스킵)
    - 데모 계정: demo@smartbreath.local / demo1234
    - 데모 기기: esp32_demo
    """
    from models import User, Device

    if User.query.filter_by(email="demo@smartbreath.local").first():
        return  # 이미 시딩됨

    demo_user = User(
        email="demo@smartbreath.local",
        name="데모 사용자",
        gender="M",
        height_cm=175.0,
        weight_kg=70.0,
        is_smoker=0,
        baseline_peak_pressure=250.0,
        target_daily_sessions=3,
    )
    demo_user.set_password("demo1234")
    db.session.add(demo_user)
    db.session.flush()

    demo_device = Device(
        device_id="esp32_demo",
        user_id=demo_user.id,
        mac_address="AA:BB:CC:DD:EE:FF",
        firmware_version="1.0.0",
        current_level=2,
    )
    db.session.add(demo_device)
    db.session.commit()
    print("[Seed] 데모 계정 생성: demo@smartbreath.local / demo1234")


if __name__ == "__main__":
    env = os.getenv("FLASK_ENV", "development")
    application = create_app(env)

    port = int(os.getenv("PORT", 5000))
    print(f"[서버 시작] http://0.0.0.0:{port}  (환경: {env})")
    socketio.run(application, host="0.0.0.0", port=port, debug=(env == "development"))
