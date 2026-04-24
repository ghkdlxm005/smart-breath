"""
인증 라우트: 회원가입 / 로그인 / 로그아웃 / 내 정보
"""
from datetime import date
from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user

from extensions import db
from models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/signup", methods=["POST"])
def signup():
    """회원가입 (기본 신체정보 포함)"""
    data = request.get_json(silent=True) or {}

    # 필수 항목 검사
    required = ["email", "password", "name"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} 필드가 필요합니다."}), 400

    email = data["email"].strip().lower()

    # 이메일 중복 확인
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "이미 사용 중인 이메일입니다."}), 409

    # 생년월일 파싱
    birth_date = None
    if data.get("birth_date"):
        try:
            birth_date = date.fromisoformat(data["birth_date"])
        except ValueError:
            return jsonify({"error": "birth_date 형식이 잘못되었습니다. (YYYY-MM-DD)"}), 400

    user = User(
        email=email,
        name=data["name"].strip(),
        birth_date=birth_date,
        gender=data.get("gender"),
        height_cm=data.get("height_cm"),
        weight_kg=data.get("weight_kg"),
        is_smoker=1 if data.get("is_smoker") else 0,
        target_daily_sessions=data.get("target_daily_sessions", 3),
    )
    user.set_password(data["password"])

    db.session.add(user)
    db.session.commit()

    login_user(user, remember=True)
    return jsonify({"message": "회원가입 성공", "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """로그인"""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "이메일과 비밀번호를 입력하세요."}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "이메일 또는 비밀번호가 잘못되었습니다."}), 401

    login_user(user, remember=True)
    return jsonify({"message": "로그인 성공", "user": user.to_dict()})


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    """로그아웃"""
    logout_user()
    return jsonify({"message": "로그아웃 성공"})


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    """현재 로그인 사용자 정보"""
    return jsonify({"user": current_user.to_dict()})


@auth_bp.route("/me", methods=["PATCH"])
@login_required
def update_me():
    """프로필 수정"""
    data = request.get_json(silent=True) or {}
    user = current_user

    updatable = [
        "name", "height_cm", "weight_kg", "is_smoker",
        "target_daily_sessions", "gender", "baseline_peak_pressure"
    ]
    for field in updatable:
        if field in data:
            if field == "is_smoker":
                setattr(user, field, 1 if data[field] else 0)
            else:
                setattr(user, field, data[field])

    if "birth_date" in data and data["birth_date"]:
        try:
            user.birth_date = date.fromisoformat(data["birth_date"])
        except ValueError:
            return jsonify({"error": "birth_date 형식이 잘못되었습니다."}), 400

    if "password" in data and data["password"]:
        user.set_password(data["password"])

    db.session.commit()
    return jsonify({"message": "프로필 업데이트 완료", "user": user.to_dict()})


@auth_bp.route("/me", methods=["DELETE"])
@login_required
def delete_account():
    """계정 삭제"""
    user = current_user
    logout_user()
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "계정이 삭제되었습니다."})
