from flask import Blueprint, jsonify, request

from ..auth.utils import current_user, roles_required
from ..extensions import db
from ..models import ClaimRulesConfig, RepairCostMaster
from ..repositories.repair_cost_repository import RepairCostRepository, get_claim_rules

admin_repair_bp = Blueprint("admin_repair_master", __name__, url_prefix="/api/admin/repair-master")
REPO = RepairCostRepository()


@admin_repair_bp.get("")
@roles_required("admin", "surveyor", "claims_manager")
def list_records():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 50)), 1), 200)
    items, total = REPO.search(q=request.args.get("q"), page=page, per_page=per_page)
    return jsonify(items=[i.to_dict() for i in items], total=total, page=page, per_page=per_page)


@admin_repair_bp.post("")
@roles_required("admin")
def create_record():
    data = request.get_json(silent=True) or {}
    required = ("panel_name", "damage_type", "severity", "min_cost", "max_cost")
    if not all(data.get(k) is not None for k in required):
        return jsonify(error="panel_name, damage_type, severity, min_cost, max_cost required"), 400
    row = REPO.upsert({
        "vehicle_brand": data.get("vehicle_brand") or "*",
        "vehicle_model": data.get("vehicle_model") or "*",
        "panel_name": data["panel_name"],
        "damage_type": data["damage_type"],
        "severity": data["severity"],
        "min_cost": data["min_cost"],
        "max_cost": data["max_cost"],
        "is_active": data.get("is_active", True),
    })
    db.session.commit()
    return jsonify(item=row.to_dict()), 201


@admin_repair_bp.put("/<int:record_id>")
@roles_required("admin")
def update_record(record_id):
    row = db.session.get(RepairCostMaster, record_id)
    if not row:
        return jsonify(error="Not found"), 404
    data = request.get_json(silent=True) or {}
    for key in ("panel_name", "damage_type", "severity", "min_cost", "max_cost", "is_active",
                "vehicle_brand", "vehicle_model"):
        if key in data:
            setattr(row, key, data[key])
    db.session.commit()
    return jsonify(item=row.to_dict())


@admin_repair_bp.delete("/<int:record_id>")
@roles_required("admin")
def delete_record(record_id):
    row = db.session.get(RepairCostMaster, record_id)
    if not row:
        return jsonify(error="Not found"), 404
    row.is_active = False
    db.session.commit()
    return jsonify(ok=True)


@admin_repair_bp.get("/claim-rules")
@roles_required("admin", "surveyor", "claims_manager")
def get_rules():
    return jsonify(config=get_claim_rules().to_dict())


@admin_repair_bp.put("/claim-rules")
@roles_required("admin")
def put_rules():
    row = get_claim_rules()
    data = request.get_json(silent=True) or {}
    for key in (
        "minor_threshold", "moderate_threshold", "cashless_max_amount",
        "auto_review_min_confidence", "idv_cap_percentage", "deductible_percentage",
    ):
        if key in data and data[key] is not None:
            setattr(row, key, data[key])
    db.session.commit()
    return jsonify(config=row.to_dict())
