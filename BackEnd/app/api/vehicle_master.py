from flask import Blueprint, jsonify, request

from ..auth.utils import current_user, login_required, roles_required
from ..repositories.vehicle_master_repository import VehicleMasterRepository
from ..services.vehicle_master_service import lookup_and_calculate

vehicle_master_bp = Blueprint("vehicle_master", __name__, url_prefix="/api/vehicle-master")
REPO = VehicleMasterRepository()

READ_ROLES = ("admin", "surveyor", "claims_manager", "agent", "verifier")


@vehicle_master_bp.get("/brands")
@login_required
def brands():
    from ..repositories.vehicle_master_repository import VehicleMasterRepository
    return jsonify(VehicleMasterRepository().list_brand_options())


@vehicle_master_bp.get("/models")
@login_required
def models():
    brand = (request.args.get("brand") or "").strip()
    if not brand:
        return jsonify(error="brand is required"), 400
    return jsonify(models=REPO.list_models(brand))


@vehicle_master_bp.get("/fuel-types")
@login_required
def fuel_types():
    brand = (request.args.get("brand") or "").strip()
    model = (request.args.get("model") or "").strip()
    if not brand or not model:
        return jsonify(error="brand and model are required"), 400
    return jsonify(fuel_types=REPO.list_fuel_types(brand, model))


@vehicle_master_bp.get("/transmissions")
@login_required
def transmissions():
    brand = (request.args.get("brand") or "").strip()
    model = (request.args.get("model") or "").strip()
    fuel_type = (request.args.get("fuel_type") or "").strip()
    if not brand or not model or not fuel_type:
        return jsonify(error="brand, model and fuel_type are required"), 400
    return jsonify(transmissions=REPO.list_transmissions(brand, model, fuel_type))


@vehicle_master_bp.get("/variants")
@login_required
def variants():
    brand = (request.args.get("brand") or "").strip()
    model = (request.args.get("model") or "").strip()
    if not brand or not model:
        return jsonify(error="brand and model are required"), 400
    rows = REPO.list_variants(
        brand,
        model,
        fuel_type=(request.args.get("fuel_type") or "").strip() or None,
        transmission=(request.args.get("transmission") or "").strip() or None,
    )
    return jsonify(variants=[r.to_dict() for r in rows])


@vehicle_master_bp.get("/<int:master_id>")
@login_required
def get_master(master_id):
    row = REPO.get_by_id(master_id, active_only=current_user().role.value == "user")
    if not row:
        return jsonify(error="Not found"), 404
    if current_user().role.value == "user" and not row.is_active:
        return jsonify(error="Not found"), 404
    return jsonify(vehicle_master=row.to_dict())


@vehicle_master_bp.post("/calculate-idv")
@login_required
def calculate():
    data = request.get_json(silent=True) or {}
    master_id = data.get("vehicle_master_id") or data.get("master_id")
    year = data.get("manufacturing_year") or data.get("year")
    if not master_id or not year:
        return jsonify(error="vehicle_master_id and manufacturing_year are required"), 400
    rc_date = None
    if data.get("rc_date"):
        from datetime import datetime
        try:
            rc_date = datetime.fromisoformat(data["rc_date"]).date()
        except ValueError:
            rc_date = None
    result, err = lookup_and_calculate(
        int(master_id),
        int(year),
        accessory_value=float(data.get("accessory_value") or 0),
        rc_date=rc_date,
    )
    if err:
        return jsonify(error=err), 400
    return jsonify(result)
