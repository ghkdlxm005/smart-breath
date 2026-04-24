"""Flask 확장 객체를 앱 바깥에서 초기화 (순환 임포트 방지)"""
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_socketio import SocketIO

db = SQLAlchemy()
login_manager = LoginManager()
socketio = SocketIO()
