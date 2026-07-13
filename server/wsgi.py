"""
배포용 WSGI 진입점.
gunicorn -k eventlet -w 1 wsgi:application

eventlet 워커는 표준 라이브러리 monkey_patch 가 앱 import 보다 먼저 실행돼야
소켓/스레드가 협조적(coroutine)으로 동작한다.
"""
import os

# eventlet 워커일 때만 monkey_patch (개발 threading 모드에서는 건너뜀)
if os.getenv("SOCKETIO_ASYNC_MODE", "eventlet") == "eventlet":
    import eventlet
    eventlet.monkey_patch()

from app import create_app  # noqa: E402

application = create_app(os.getenv("FLASK_ENV", "production"))
