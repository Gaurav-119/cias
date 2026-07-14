from datetime import date, timedelta

from flask import Blueprint, Response, jsonify, request

from ..auth.utils import current_user, login_required
from ..extensions import db
from ..models import (Addon, Policy, Pricing, Provider, StoredFile, Vehicle,
                      VehicleBasePrice)
from ..services import premium as prem
from ..services.audit import log_action
from ..services.pdf import build_policy_certificate
from ..services.policy_document import build_policy_schedule_data
from ..storage import get_storage

policies_bp = Blueprint("policies", __name__, url_prefix="/api/policies")


def _can_view(policy):
    return (
        policy.user_id == current_user().id
        or current_user().role.value in {"admin", "agent"}
    )


def _certificate_data(policy) -> dict:
    return build_policy_schedule_data(policy)


@policies_bp.get("/catalog")
@login_required
def catalog():
    """Catalog used by the policy-selection page."""
    return jsonify(
        providers=[p.to_dict() for p in Provider.query.filter_by(active=True)],
        pricing=[p.to_dict() for p in Pricing.query.all()],
        addons=[a.to_dict() for a in Addon.query.filter_by(active=True)],
    )


@policies_bp.post("/quote")
@login_required
def quote():
    """Return IDV + premium breakdown without persisting anything."""
    data = request.get_json(silent=True) or {}
    vehicle = db.session.get(Vehicle, data.get("vehicle_id"))
    if not vehicle:
        return jsonify(error="Vehicle not found"), 404

    policy_type = data.get("policy_type", "comprehensive")
    provider_id = data.get("provider_id")
    tenure = int(data.get("tenure_years", 1))
    addon_ids = data.get("addon_ids", [])

    pricing = Pricing.query.filter_by(
        provider_id=provider_id, policy_type=policy_type
    ).first()
    if not pricing:
        pricing = Pricing.query.filter_by(policy_type=policy_type).first()
    if not pricing:
        return jsonify(error="No pricing configured for this policy type"), 400

    # Base price from Vehicle Master ex-showroom or stored IDV on vehicle.
    base_price = data.get("base_price")
    if not base_price:
        if vehicle.ex_showroom_price:
            base_price = float(vehicle.ex_showroom_price)
        elif vehicle.calculated_idv:
            base_price = float(vehicle.calculated_idv)
        else:
            bp = VehicleBasePrice.query.filter_by(
                make=vehicle.make, model=vehicle.model
            ).first()
            base_price = float(bp.base_price) if bp else prem.REFERENCE_PRICE

    addons = Addon.query.filter(Addon.id.in_(addon_ids)).all() if addon_ids else []
    result = prem.quote(
        base_price=base_price,
        price_min=pricing.price_min,
        price_max=pricing.price_max,
        policy_type=policy_type,
        rc_date=vehicle.rc_date,
        tenure=tenure,
        addon_prices=[a.price for a in addons],
    )
    if vehicle.calculated_idv:
        result["idv"] = int(vehicle.calculated_idv)
        result["max_claim_amount"] = float(vehicle.max_claim_amount or vehicle.calculated_idv)
    result["ex_showroom_price"] = float(vehicle.ex_showroom_price) if vehicle.ex_showroom_price else None
    result["addons"] = [a.to_dict() for a in addons]
    result["policy_type"] = policy_type
    return jsonify(quote=result)


@policies_bp.get("")
@login_required
def list_policies():
    policies = Policy.query.filter_by(user_id=current_user().id).all()
    return jsonify(policies=[p.to_dict() for p in policies])


@policies_bp.post("")
@login_required
def create_policy():
    data = request.get_json(silent=True) or {}
    vehicle = db.session.get(Vehicle, data.get("vehicle_id"))
    if not vehicle or vehicle.user_id != current_user().id:
        return jsonify(error="Vehicle not found"), 404

    tenure = int(data.get("tenure_years", 1))
    idv = data.get("idv") or (float(vehicle.calculated_idv) if vehicle.calculated_idv else None)
    policy = Policy(
        user_id=current_user().id,
        vehicle_id=vehicle.id,
        provider_id=data.get("provider_id"),
        policy_type=data.get("policy_type", "comprehensive"),
        tenure_years=tenure,
        idv=idv,
        base_premium=data.get("base_premium"),
        addon_premium=data.get("addon_premium"),
        total_premium=data.get("total_premium"),
        gst=data.get("gst"),
        addons=data.get("addons", []),
        start_date=date.today(),
        end_date=date.today() + timedelta(days=365 * tenure),
        status="pending",
    )
    db.session.add(policy)
    db.session.commit()

    policy.policy_number = prem.generate_policy_number(policy.id, policy.created_at)
    db.session.commit()
    log_action(current_user().id, "create_policy", "policy", policy.id)
    return jsonify(policy=policy.to_dict()), 201


@policies_bp.get("/<int:policy_id>")
@login_required
def get_policy(policy_id):
    policy = db.session.get(Policy, policy_id)
    if not policy:
        return jsonify(error="Policy not found"), 404
    if not _can_view(policy):
        return jsonify(error="Forbidden"), 403
    data = policy.to_dict()
    data["provider_name"] = policy.provider.name if policy.provider else None
    data["vehicle"] = policy.vehicle.to_dict() if policy.vehicle else None
    return jsonify(policy=data)


@policies_bp.get("/<int:policy_id>/certificate")
@login_required
def policy_certificate(policy_id):
    """Enriched data for the on-screen / printable certificate page."""
    policy = db.session.get(Policy, policy_id)
    if not policy:
        return jsonify(error="Policy not found"), 404
    if not _can_view(policy):
        return jsonify(error="Forbidden"), 403
    return jsonify(certificate=_certificate_data(policy))


@policies_bp.get("/<int:policy_id>/certificate.pdf")
@login_required
def policy_certificate_pdf(policy_id):
    """Generate the policy certificate PDF, archive it via the storage layer
    (so the report is not tied to any local machine) and stream it back."""
    policy = db.session.get(Policy, policy_id)
    if not policy:
        return jsonify(error="Policy not found"), 404
    if not _can_view(policy):
        return jsonify(error="Forbidden"), 403

    pdf_bytes = build_policy_certificate(_certificate_data(policy))

    # Archive the generated report (best-effort; never blocks the download).
    try:
        storage = get_storage()
        stored = storage.save(
            pdf_bytes,
            folder=f"reports/policies/{policy.id}",
            filename=f"{policy.policy_number or policy.id}.pdf",
            content_type="application/pdf",
        )
        db.session.add(StoredFile(
            owner_id=policy.user_id, category="report",
            bucket=stored.bucket, object_key=stored.object_key,
            provider=stored.provider, content_type=stored.content_type,
            size=stored.size,
            original_name=f"{policy.policy_number or policy.id}.pdf",
        ))
        db.session.commit()
    except Exception:  # noqa: BLE001
        db.session.rollback()

    filename = f"ClaimNova-{policy.policy_number or policy.id}.pdf"
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
