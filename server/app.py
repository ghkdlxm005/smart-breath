"""
스마트 호흡 훈련기 — Flask 서버 엔트리포인트
개발 실행: python app.py
배포 실행: gunicorn -k eventlet -w 1 wsgi:application  (wsgi.py 참고)

프론트/백엔드를 한 서비스로 배포한다. Flask 가 API + Socket.IO 를 제공하고,
빌드된 React 정적 파일(client/dist)도 같은 출처에서 서빙한다.
"""
import os

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_login import LoginManager

from extensions import db, socketio
from config import config


def create_app(env: str = "default") -> Flask:
    """애플리케이션 팩토리"""
    app = Flask(__name__)
    cfg = config[env]
    app.config.from_object(cfg)

    # 배포 환경에서 위험한 기본값(SECRET_KEY 등) 조기 차단
    if hasattr(cfg, "validate"):
        cfg.validate()

    # DB 디렉토리 자동 생성 (sqlite 파일 경로의 부모 폴더)
    db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if db_uri.startswith("sqlite:///"):
        db_path = db_uri[len("sqlite:///"):]
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

    # ─── 확장 초기화 ───
    db.init_app(app)

    # CORS: 명시적 출처 목록에만 자격증명 허용 (same-origin 배포 시 사실상 불필요)
    CORS(
        app,
        supports_credentials=True,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
    )

    socketio.init_app(
        app,
        cors_allowed_origins=app.config["SOCKETIO_CORS_ALLOWED_ORIGINS"],
        async_mode=app.config["SOCKETIO_ASYNC_MODE"],
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

    # ─── DB 테이블 자동 생성 + 데모 시딩 ───
    with app.app_context():
        db.create_all()
        _seed_demo_data(app)

    # ─── 헬스체크 ───
    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "service": "smart-breath-server"})

    # ─── 프론트엔드(SPA) 서빙 ───
    _register_spa(app)

    return app


def _register_spa(app: Flask):
    """빌드된 React 정적 파일을 같은 출처에서 서빙 (SPA 폴백 포함)."""
    dist_dir = app.config.get("CLIENT_DIST_DIR", "")

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_spa(path: str):
        # API/헬스/소켓 경로는 여기서 처리하지 않음
        if path.startswith("api/") or path.startswith("socket.io") or path == "health":
            return jsonify({"error": "not found"}), 404

        if not dist_dir or not os.path.isdir(dist_dir):
            return jsonify({
                "error": "프론트엔드 빌드가 없습니다. client 에서 `npm run build` 후 배포하세요.",
            }), 404

        target = os.path.join(dist_dir, path)
        if path and os.path.isfile(target):
            return send_from_directory(dist_dir, path)
        # SPA 라우팅: 그 외 모든 경로는 index.html
        return send_from_directory(dist_dir, "index.html")


def _seed_demo_data(app: Flask):
    """
    최초 실행 시 데모 데이터 생성 (이미 있으면 스킵)
    - 데모 계정: demo@smartbreath.local / demo1234
    - 데모 기기: esp32_demo (토큰은 DEVICE_TOKEN 값 — mock_device.py 기본값과 일치)
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
        auth_token=app.config.get("DEVICE_TOKEN"),
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
    socketio.run(
        application,
        host="0.0.0.0",
        port=port,
        debug=(env == "development"),
        allow_unsafe_werkzeug=True,
    )
