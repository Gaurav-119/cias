from datetime import datetime

from flask import Blueprint, g, jsonify, request

from ..api._helpers import (
    ALLOWED_DOCUMENT,
    allowed,
    save_upload,
    user_kyc_documents,
)
from ..extensions import db
from ..models import Role, Session, User
from ..services.audit import log_action
from ..services.validators import validate_indian_phone
from .utils import current_user, generate_token, login_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

VALID_ID_TYPES = {"aadhaar", "pan", "passport", "driving_license"}


def _parse_register_payload():
    if request.content_type and "multipart" in request.content_type:
        return request.form.to_dict()
    return request.get_json(silent=True) or {}


def _parse_dob(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def _save_register_documents(user_id: int):
    uploads = [
        ("identity_proof", "identity_proof"),
        ("passport_photo", "passport_photo"),
        ("address_proof", "address_proof"),
    ]
    saved = []
    for field_name, category in uploads:
        file_storage = request.files.get(field_name)
        if not file_storage or not file_storage.filename:
            continue
        if not allowed(file_storage.filename, ALLOWED_DOCUMENT):
            continue
        record = save_upload(
            file_storage,
            folder=f"users/{user_id}/kyc",
            category=category,
            owner_id=user_id,
        )
        saved.append(category)
    return saved


@auth_bp.post("/register")
def register():
    data = _parse_register_payload()
    required = ["full_name", "email", "password", "phone", "date_of_birth", "identity_proof_type", "identity_proof_number"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return jsonify(error=f"Missing fields: {', '.join(missing)}"), 400

    phone, phone_error = validate_indian_phone(data.get("phone"), required=True)
    if phone_error:
        return jsonify(error=phone_error), 400

    dob = _parse_dob(data.get("date_of_birth"))
    if not dob:
        return jsonify(error="Valid date of birth is required"), 400

    id_type = (data.get("identity_proof_type") or "").lower()
    if id_type not in VALID_ID_TYPES:
        return jsonify(error="identity_proof_type must be aadhaar, pan, passport, or driving_license"), 400

    if User.query.filter_by(email=data["email"].lower()).first():
        return jsonify(error="Email already registered"), 409

    if request.content_type and "multipart" in request.content_type:
        if not request.files.get("identity_proof"):
            return jsonify(error="Identity proof document is required"), 400
        if not request.files.get("passport_photo"):
            return jsonify(error="Passport-size photo is required"), 400

    role = Role.user
    requested_role = data.get("role")
    if requested_role in {"agent", "verifier", "admin"}:
        from .utils import decode_token

        token = request.headers.get("Authorization", "")[7:]
        payload = decode_token(token) if token else None
        if payload and payload.get("role") == "admin":
            role = Role(requested_role)

    user = User(
        full_name=data["full_name"],
        email=data["email"].lower(),
        phone=phone,
        address=data.get("address"),
        city=data.get("city"),
        state=data.get("state"),
        pincode=data.get("pincode") or data.get("zipCode"),
        date_of_birth=dob,
        identity_proof_type=id_type,
        identity_proof_number=(data.get("identity_proof_number") or "").strip(),
        kyc_status="submitted",
        role=role,
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    if request.content_type and "multipart" in request.content_type:
        _save_register_documents(user.id)

    token, jti, expires_at = generate_token(user)
    db.session.add(Session(
        user_id=user.id, jti=jti, ip=request.remote_addr,
        user_agent=request.headers.get("User-Agent"), expires_at=expires_at,
    ))
    db.session.commit()
    log_action(user.id, "register", "user", user.id)

    response_user = user.to_dict()
    response_user["kyc_documents"] = user_kyc_documents(user.id)
    return jsonify(access_token=token, user=response_user), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify(error="Invalid email or password"), 401
    if not user.is_active:
        return jsonify(error="Account disabled"), 403

    token, jti, expires_at = generate_token(user)
    db.session.add(Session(
        user_id=user.id, jti=jti, ip=request.remote_addr,
        user_agent=request.headers.get("User-Agent"), expires_at=expires_at,
    ))
    db.session.commit()
    log_action(user.id, "login", "user", user.id)

    return jsonify(access_token=token, user=user.to_dict())


@auth_bp.get("/me")
@login_required
def me():
    user = current_user()
    payload = user.to_dict()
    payload["kyc_documents"] = user_kyc_documents(user.id)
    return jsonify(user=payload)


@auth_bp.put("/me")
@login_required
def update_me():
    data = request.get_json(silent=True) or {}
    user = current_user()
    for field in ["full_name", "address", "city", "state", "pincode"]:
        if field in data:
            setattr(user, field, data[field])
    if "phone" in data:
        phone, phone_error = validate_indian_phone(data.get("phone"), required=bool(data.get("phone")))
        if phone_error:
            return jsonify(error=phone_error), 400
        user.phone = phone
    db.session.commit()
    return jsonify(user=user.to_dict())


@auth_bp.post("/logout")
@login_required
def logout():
    session = Session.query.filter_by(jti=g.jti).first()
    if session:
        session.revoked = True
        db.session.commit()
    return jsonify(message="Logged out")
