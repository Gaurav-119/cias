from flask import Blueprint, jsonify, request

from ..auth.utils import current_user, roles_required
from ..extensions import db
from ..models import (AuditLog, Claim, Payment, Policy, Role, User, Vehicle,
                      VerificationSession)
from ..services.audit import log_action, record_claim_event
from ._helpers import file_payload, user_kyc_documents, vehicle_document_files, vehicle_photo_files

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.get("/stats")
@roles_required("admin")
def stats():
    users = User.query.all()
    claims = Claim.query.all()
    payments = Payment.query.all()
    return jsonify(stats={
        "users": len(users),
        "agents": sum(1 for user in users if user.role == Role.agent),
        "verifiers": sum(1 for user in users if user.role == Role.verifier),
        "admins": sum(1 for user in users if user.role == Role.admin),
        "vehicles": Vehicle.query.count(),
        "policies": Policy.query.count(),
        "claims": len(claims),
        "pending_claims": sum(1 for claim in claims if claim.status == "pending"),
        "under_review_claims": sum(
            1 for claim in claims if claim.status == "under_review"
        ),
        "approved_claims": sum(1 for claim in claims if claim.status == "approved"),
        "rejected_claims": sum(1 for claim in claims if claim.status == "rejected"),
        "payments": len(payments),
        "revenue": round(
            sum(float(payment.amount or 0) for payment in payments if payment.status == "completed"),
            2,
        ),
    })


# ---- Users -------------------------------------------------------------
@admin_bp.get("/users")
@roles_required("admin")
def list_users():
    return jsonify(users=[u.to_dict() for u in User.query.all()])


@admin_bp.post("/users")
@roles_required("admin")
def create_user():
    data = request.get_json(silent=True) or {}
    if User.query.filter_by(email=(data.get("email") or "").lower()).first():
        return jsonify(error="Email already registered"), 409
    try:
        user = User(
            full_name=data.get("full_name", ""),
            email=(data.get("email") or "").lower(),
            phone=data.get("phone"),
            role=Role.from_value(data.get("role", Role.user.value)),
        )
    except ValueError:
        return jsonify(error=f"Invalid role — allowed: {', '.join(Role.values())}"), 400
    user.set_password(data.get("password", "changeme123"))
    db.session.add(user)
    db.session.commit()
    log_action(current_user().id, "admin_create_user", "user", user.id)
    return jsonify(user=user.to_dict()), 201


@admin_bp.put("/users/<int:user_id>")
@roles_required("admin")
def update_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify(error="User not found"), 404
    data = request.get_json(silent=True) or {}
    for field in ["full_name", "phone", "address", "city", "state", "pincode",
                  "is_active"]:
        if field in data:
            setattr(user, field, data[field])
    db.session.commit()
    return jsonify(user=user.to_dict())


@admin_bp.put("/users/<int:user_id>/role")
@roles_required("admin")
def update_role(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify(error="User not found"), 404
    data = request.get_json(silent=True) or {}
    try:
        user.role = Role.from_value(data.get("role"))
    except ValueError:
        return jsonify(error=f"Invalid role — allowed: {', '.join(Role.values())}"), 400
    db.session.commit()
    log_action(current_user().id, "admin_update_role", "user", user.id,
               meta={"role": user.role.value})
    return jsonify(user=user.to_dict())


@admin_bp.delete("/users/<int:user_id>")
@roles_required("admin")
def delete_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify(error="User not found"), 404
    db.session.delete(user)
    db.session.commit()
    log_action(current_user().id, "admin_delete_user", "user", user_id)
    return jsonify(message="User deleted")


# ---- Cars / Policies / Claims / Payments -------------------------------
@admin_bp.get("/cars")
@roles_required("admin")
def list_cars():
    return jsonify(cars=[v.to_dict() for v in Vehicle.query.all()])


@admin_bp.put("/cars/<int:vehicle_id>")
@roles_required("admin")
def update_car(vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle:
        return jsonify(error="Vehicle not found"), 404
    data = request.get_json(silent=True) or {}
    for field in ["make", "model", "year", "license_plate", "fuel_type",
                  "color", "status", "variant", "transmission",
                  "ex_showroom_price", "calculated_idv", "max_claim_amount"]:
        if field in data:
            setattr(vehicle, field, data[field])
    db.session.commit()
    return jsonify(vehicle=vehicle.to_dict())


@admin_bp.get("/policies")
@roles_required("admin")
def list_policies():
    return jsonify(policies=[p.to_dict() for p in Policy.query.all()])


@admin_bp.put("/policies/<int:policy_id>")
@roles_required("admin")
def update_policy(policy_id):
    policy = db.session.get(Policy, policy_id)
    if not policy:
        return jsonify(error="Policy not found"), 404
    data = request.get_json(silent=True) or {}
    for field in ["status", "total_premium", "idv", "policy_type"]:
        if field in data:
            setattr(policy, field, data[field])
    db.session.commit()
    return jsonify(policy=policy.to_dict())


@admin_bp.get("/claims")
@roles_required("admin")
def list_claims():
    return jsonify(claims=[c.to_dict() for c in Claim.query.all()])


@admin_bp.put("/claims/<int:claim_id>")
@roles_required("admin")
def update_claim(claim_id):
    claim = db.session.get(Claim, claim_id)
    if not claim:
        return jsonify(error="Claim not found"), 404
    data = request.get_json(silent=True) or {}
    status_changed = "status" in data and data["status"] != claim.status
    cap = None
    if claim.vehicle:
        cap = float(claim.vehicle.max_claim_amount or claim.vehicle.calculated_idv or 0) or None
    for field in ["status", "final_amount", "fraud_flag"]:
        if field in data:
            value = data[field]
            if field == "final_amount" and cap and value is not None:
                value = min(float(value), cap)
            setattr(claim, field, value)
    db.session.commit()
    if status_changed:
        note = data.get("note") or f"Status changed to {claim.status} by admin"
        record_claim_event(claim.id, claim.status, note, current_user().id)
    log_action(current_user().id, "admin_update_claim", "claim", claim.id,
               meta={"status": claim.status})
    return jsonify(claim=claim.to_dict())


@admin_bp.get("/payments")
@roles_required("admin")
def list_payments():
    return jsonify(payments=[p.to_dict() for p in Payment.query.all()])


@admin_bp.get("/audit-logs")
@roles_required("admin")
def list_audit():
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(200).all()
    return jsonify(logs=[log.to_dict() for log in logs])


# ---- Verifier queue / decisions ----------------------------------------
@admin_bp.get("/verification/stats")
@roles_required("admin", "verifier")
def verification_stats():
    sessions = VerificationSession.query.all()
    pending = Vehicle.query.filter(
        Vehicle.status.in_([
            "registered",
            "pending_verification",
            "pending_video_verification",
            "waiting_for_verifier",
        ])
    ).count()
    return jsonify(stats={
        "pending_verifications": pending,
        "approved": sum(1 for session in sessions if session.decision == "approved"),
        "rejected": sum(1 for session in sessions if session.decision == "rejected"),
        "completed_sessions": sum(
            1 for session in sessions if session.status == "completed"
        ),
    })


@admin_bp.get("/verification/pending")
@roles_required("admin", "verifier")
def pending_verifications():
    vehicles = Vehicle.query.filter(
        Vehicle.status.in_([
            "registered",
            "pending_verification",
            "pending_video_verification",
            "waiting_for_verifier",
        ])
    ).all()
    payload = []
    for vehicle in vehicles:
        data = vehicle.to_dict()
        owner = db.session.get(User, vehicle.user_id)
        data["owner"] = {
            "id": owner.id,
            "full_name": owner.full_name,
            "email": owner.email,
        } if owner else None
        payload.append(data)
    return jsonify(vehicles=payload)


@admin_bp.get("/verification/history")
@roles_required("admin", "verifier")
def verification_history():
    sessions = VerificationSession.query.order_by(
        VerificationSession.created_at.desc()
    ).limit(50).all()
    return jsonify(sessions=[session.to_dict() for session in sessions])


@admin_bp.get("/verification/<int:vehicle_id>")
@roles_required("admin", "verifier")
def verification_detail(vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle:
        return jsonify(error="Vehicle not found"), 404

    data = vehicle.to_dict()
    data["images"] = vehicle_photo_files(vehicle.id)
    data["documents"] = vehicle_document_files(vehicle.id)
    owner = db.session.get(User, vehicle.user_id)
    data["owner"] = {
        "id": owner.id,
        "full_name": owner.full_name,
        "email": owner.email,
        "phone": owner.phone,
        "address": owner.address,
        "city": owner.city,
        "state": owner.state,
        "pincode": owner.pincode,
        "date_of_birth": owner.date_of_birth.isoformat() if owner.date_of_birth else None,
        "identity_proof_type": owner.identity_proof_type,
        "identity_proof_number": owner.identity_proof_number,
        "kyc_status": owner.kyc_status,
        "kyc_documents": user_kyc_documents(owner.id),
    } if owner else None
    sessions = VerificationSession.query.filter_by(vehicle_id=vehicle.id).order_by(
        VerificationSession.created_at.desc()
    ).all()
    return jsonify(vehicle=data, sessions=[session.to_dict() for session in sessions])


@admin_bp.post("/verification/<int:vehicle_id>/decision")
@roles_required("admin", "verifier")
def verification_decision(vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle:
        return jsonify(error="Vehicle not found"), 404
    data = request.get_json(silent=True) or {}
    decision = data.get("decision")
    if decision not in {"approved", "rejected"}:
        return jsonify(error="decision must be approved or rejected"), 400

    vehicle.status = "verified" if decision == "approved" else "rejected"
    owner = db.session.get(User, vehicle.user_id)
    if owner:
        owner.kyc_status = "verified" if decision == "approved" else "rejected"
    session = VerificationSession(
        vehicle_id=vehicle.id,
        verifier_id=current_user().id,
        status="completed",
        decision=decision,
        checklist=data.get("checklist"),
        remarks=data.get("remarks"),
    )
    db.session.add(session)
    db.session.commit()
    log_action(current_user().id, "verification_decision", "vehicle", vehicle.id,
               meta={"decision": decision})
    return jsonify(vehicle=vehicle.to_dict(), session=session.to_dict())
