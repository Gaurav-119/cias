from __future__ import annotations

import uuid
from datetime import datetime
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

from ..extensions import db
from ..models import Session, User


def generate_token(user: User) -> tuple[str, str, datetime]:
    """Return (token, jti, expires_at)."""
    jti = uuid.uuid4().hex
    expires_at = datetime.utcnow() + current_app.config["JWT_ACCESS_TTL"]
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "jti": jti,
        "iat": datetime.utcnow(),
        "exp": expires_at,
    }
    token = jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")
    return token, jti, expires_at


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(
            token, current_app.config["JWT_SECRET"], algorithms=["HS256"]
        )
    except jwt.PyJWTError:
        return None


def _extract_token() -> str | None:
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:]
    return None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify(error="Authorization token required"), 401
        payload = decode_token(token)
        if not payload:
            return jsonify(error="Invalid or expired token"), 401

        session = Session.query.filter_by(jti=payload.get("jti")).first()
        if session and session.revoked:
            return jsonify(error="Session revoked"), 401

        user = db.session.get(User, int(payload["sub"]))
        if not user or not user.is_active:
            return jsonify(error="User not found or inactive"), 401

        g.current_user = user
        g.jti = payload.get("jti")
        return fn(*args, **kwargs)

    return wrapper


def roles_required(*roles):
    """RBAC decorator. Usage: @roles_required('admin', 'agent')."""

    allowed = {r.value if hasattr(r, "value") else r for r in roles}

    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            if g.current_user.role.value not in allowed:
                return jsonify(error="Insufficient permissions"), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def current_user() -> User:
    return g.current_user
