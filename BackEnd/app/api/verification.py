"""Live video verification session APIs (bank-style KYC flow)."""
from __future__ import annotations

from datetime import datetime

from flask import Blueprint, jsonify, request

from ..auth.utils import current_user, login_required, roles_required
from ..extensions import db
from ..models import StoredFile, User, Vehicle, VerificationMedia, VerificationSession
from ..services.audit import log_action
from ..services.video_signaling import clear_room, fetch_since, publish
from ._helpers import ALLOWED_IMAGE, ALLOWED_MEDIA, allowed, file_payload, save_upload

verification_bp = Blueprint("verification", __name__, url_prefix="/api/verification")


def _session_dict(session: VerificationSession) -> dict:
    data = session.to_dict()
    media = []
    for item in session.media:
        stored = db.session.get(StoredFile, item.file_id) if item.file_id else None
        if stored:
            media.append({
                "id": item.id,
                "kind": item.kind,
                "file": file_payload(stored),
            })
    data["media"] = media
    return data


def _can_access_vehicle(vehicle: Vehicle, user: User) -> bool:
    if user.role.value in {"admin", "verifier"}:
        return True
    return vehicle.user_id == user.id


def _can_access_session(session: VerificationSession, user: User) -> bool:
    vehicle = db.session.get(Vehicle, session.vehicle_id)
    if not vehicle:
        return False
    return _can_access_vehicle(vehicle, user)


@verification_bp.post("/sessions/start")
@login_required
def start_session():
    data = request.get_json(silent=True) or {}
    vehicle_id = data.get("vehicle_id")
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle:
        return jsonify(error="Vehicle not found"), 404
    if not _can_access_vehicle(vehicle, current_user()):
        return jsonify(error="Forbidden"), 403

    role = current_user().role.value
    if role not in {"admin", "verifier", "user"}:
        return jsonify(error="Forbidden"), 403

    active = VerificationSession.query.filter_by(
        vehicle_id=vehicle.id, status="active"
    ).first()
    if active:
        if role in {"admin", "verifier"} and not active.verifier_id:
            active.verifier_id = current_user().id
            db.session.commit()
        return jsonify(session=_session_dict(active))

    session = VerificationSession(
        vehicle_id=vehicle.id,
        verifier_id=current_user().id if role in {"admin", "verifier"} else None,
        status="active",
        started_at=datetime.utcnow(),
    )
    vehicle.status = "pending_video_verification"
    db.session.add(session)
    db.session.commit()
    publish(session.id, current_user().id, role, "join", {"message": "session_started"})
    log_action(
        current_user().id,
        "start_video_session",
        "verification_session",
        session.id,
        meta={"vehicle_id": vehicle.id},
    )
    return jsonify(session=_session_dict(session)), 201


@verification_bp.get("/vehicles/<int:vehicle_id>/active-session")
@login_required
def active_session(vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle:
        return jsonify(error="Vehicle not found"), 404
    if not _can_access_vehicle(vehicle, current_user()):
        return jsonify(error="Forbidden"), 403

    session = VerificationSession.query.filter_by(
        vehicle_id=vehicle.id, status="active"
    ).order_by(VerificationSession.created_at.desc()).first()
    return jsonify(session=_session_dict(session) if session else None)


@verification_bp.get("/sessions/<int:session_id>")
@login_required
def get_session(session_id):
    session = db.session.get(VerificationSession, session_id)
    if not session:
        return jsonify(error="Session not found"), 404
    if not _can_access_session(session, current_user()):
        return jsonify(error="Forbidden"), 403
    return jsonify(session=_session_dict(session))


@verification_bp.post("/sessions/<int:session_id>/signals")
@login_required
def post_signal(session_id):
    session = db.session.get(VerificationSession, session_id)
    if not session or session.status != "active":
        return jsonify(error="Session not found or not active"), 404
    if not _can_access_session(session, current_user()):
        return jsonify(error="Forbidden"), 403

    data = request.get_json(silent=True) or {}
    msg_type = data.get("type")
    if not msg_type:
        return jsonify(error="type is required"), 400

    message = publish(
        session.id,
        current_user().id,
        current_user().role.value,
        msg_type,
        data.get("payload") or {},
    )
    return jsonify(message=message), 201


@verification_bp.get("/sessions/<int:session_id>/signals")
@login_required
def list_signals(session_id):
    session = db.session.get(VerificationSession, session_id)
    if not session:
        return jsonify(error="Session not found"), 404
    if not _can_access_session(session, current_user()):
        return jsonify(error="Forbidden"), 403

    after_id = int(request.args.get("after", 0))
    return jsonify(messages=fetch_since(session.id, after_id))


@verification_bp.post("/sessions/<int:session_id>/snapshot")
@login_required
def upload_snapshot(session_id):
    session = db.session.get(VerificationSession, session_id)
    if not session:
        return jsonify(error="Session not found"), 404
    if not _can_access_session(session, current_user()):
        return jsonify(error="Forbidden"), 403

    file_storage = request.files.get("file") or request.files.get("snapshot")
    if not file_storage or not allowed(file_storage.filename, ALLOWED_IMAGE):
        return jsonify(error="Valid image file required"), 400

    record = save_upload(
        file_storage,
        folder=f"verification/{session.id}/snapshots",
        category="verification_snapshot",
        owner_id=current_user().id,
        vehicle_id=session.vehicle_id,
    )
    media = VerificationMedia(session_id=session.id, file_id=record.id, kind="snapshot")
    db.session.add(media)
    db.session.commit()
    return jsonify(media={
        "id": media.id,
        "kind": media.kind,
        "file": file_payload(record),
    }), 201


@verification_bp.post("/sessions/<int:session_id>/recording")
@login_required
def upload_recording(session_id):
    session = db.session.get(VerificationSession, session_id)
    if not session:
        return jsonify(error="Session not found"), 404
    if not _can_access_session(session, current_user()):
        return jsonify(error="Forbidden"), 403

    file_storage = request.files.get("file") or request.files.get("recording")
    if not file_storage or not allowed(file_storage.filename, ALLOWED_MEDIA):
        return jsonify(error="Valid recording file required"), 400

    record = save_upload(
        file_storage,
        folder=f"verification/{session.id}/recordings",
        category="verification_recording",
        owner_id=current_user().id,
        vehicle_id=session.vehicle_id,
    )
    media = VerificationMedia(session_id=session.id, file_id=record.id, kind="recording")
    db.session.add(media)
    db.session.commit()
    return jsonify(media={
        "id": media.id,
        "kind": media.kind,
        "file": file_payload(record),
    }), 201


@verification_bp.post("/sessions/<int:session_id>/end")
@login_required
def end_session(session_id):
    session = db.session.get(VerificationSession, session_id)
    if not session or session.status != "active":
        return jsonify(error="Session not found or not active"), 404
    if not _can_access_session(session, current_user()):
        return jsonify(error="Forbidden"), 403

    session.ended_at = datetime.utcnow()
    publish(session.id, current_user().id, current_user().role.value, "leave", {})
    log_action(current_user().id, "end_video_session", "verification_session", session.id)
    return jsonify(session=_session_dict(session))


@verification_bp.post("/sessions/<int:session_id>/decision")
@roles_required("admin", "verifier")
def session_decision(session_id):
    session = db.session.get(VerificationSession, session_id)
    if not session:
        return jsonify(error="Session not found"), 404

    vehicle = db.session.get(Vehicle, session.vehicle_id)
    if not vehicle:
        return jsonify(error="Vehicle not found"), 404

    data = request.get_json(silent=True) or {}
    decision = data.get("decision")
    if decision not in {"approved", "rejected"}:
        return jsonify(error="decision must be approved or rejected"), 400

    session.status = "completed"
    session.decision = decision
    session.verifier_id = current_user().id
    session.checklist = data.get("checklist")
    session.remarks = data.get("remarks")
    session.ended_at = session.ended_at or datetime.utcnow()

    vehicle.status = "verified" if decision == "approved" else "rejected"
    owner = db.session.get(User, vehicle.user_id)
    if owner and decision == "approved":
        owner.kyc_status = "verified"
    elif owner and decision == "rejected":
        owner.kyc_status = "rejected"
    db.session.commit()
    clear_room(session.id)
    log_action(
        current_user().id,
        "verification_decision",
        "vehicle",
        vehicle.id,
        meta={"decision": decision, "session_id": session.id},
    )
    return jsonify(vehicle=vehicle.to_dict(), session=_session_dict(session))
