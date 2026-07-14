from datetime import datetime

from flask import Blueprint, jsonify, request

from ..auth.utils import current_user, login_required
from ..extensions import db
from ..models import Vehicle
from ..repositories.vehicle_master_repository import VehicleMasterRepository
from ..services.audit import log_action
from ..services.vehicle_master_service import lookup_and_calculate
from ._helpers import (
    ALLOWED_DOCUMENT,
    ALLOWED_IMAGE,
    VEHICLE_DOC_CATEGORIES,
    allowed,
    file_payload,
    save_upload,
    vehicle_document_files,
    vehicle_has_required_documents,
    vehicle_photo_files,
)

vehicles_bp = Blueprint("vehicles", __name__, url_prefix="/api/vehicles")
MASTER_REPO = VehicleMasterRepository()


def _apply_master_valuation(vehicle: Vehicle, data: dict) -> tuple[str | None, int]:
    master_id = data.get("vehicle_master_id")
    year = data.get("year") or data.get("manufacturing_year")
    if not master_id:
        return "vehicle_master_id is required — select brand, model and variant from catalogue", 400
    if not year:
        return "Manufacturing year is required", 400

    rc_date = None
    if data.get("rc_date"):
        try:
            rc_date = datetime.fromisoformat(data["rc_date"]).date()
        except ValueError:
            rc_date = None

    accessory_value = float(data.get("accessory_value") or 0)
    result, err = lookup_and_calculate(
        int(master_id), int(year), accessory_value=accessory_value, rc_date=rc_date
    )
    if err:
        return err, 400

    master = result["vehicle_master"]
    val = result["valuation"]

    vehicle.vehicle_master_id = master["id"]
    vehicle.make = master["brand"]
    vehicle.model = master["model"]
    vehicle.variant = master["variant"]
    vehicle.fuel_type = master["fuel_type"]
    vehicle.transmission = master["transmission"]
    vehicle.year = int(year)
    vehicle.ex_showroom_price = master["ex_showroom_price"]
    vehicle.accessory_value = accessory_value
    vehicle.market_value = val["final_idv"]
    vehicle.vehicle_age_months = val["vehicle_age_months"]
    vehicle.vehicle_age_years = val["vehicle_age_years"]
    vehicle.depreciation_percentage = val["depreciation_percentage"]
    vehicle.depreciation_amount = val["depreciation_amount"]
    vehicle.calculated_idv = val["final_idv"]
    vehicle.max_claim_amount = val["max_claim_amount"]
    return None, 0


@vehicles_bp.get("/brands")
@login_required
def catalog_brands():
    """Active brands from Vehicle Master (id + name)."""
    return jsonify(MASTER_REPO.list_brand_options())


@vehicles_bp.get("/models")
@login_required
def catalog_models():
    """Active models for a brand (id + name). Query: brand_id=<id>"""
    brand_id = request.args.get("brand_id")
    if not brand_id:
        return jsonify(error="brand_id is required"), 400
    try:
        bid = int(brand_id)
    except (TypeError, ValueError):
        return jsonify(error="brand_id must be an integer"), 400
    if not MASTER_REPO.resolve_brand_name(bid):
        return jsonify(error="Brand not found"), 404
    return jsonify(MASTER_REPO.list_model_options(bid))


@vehicles_bp.get("")
@login_required
def list_vehicles():
    vehicles = Vehicle.query.filter_by(user_id=current_user().id).all()
    out = []
    for v in vehicles:
        data = v.to_dict()
        data["images"] = vehicle_photo_files(v.id)
        data["documents"] = vehicle_document_files(v.id)
        out.append(data)
    return jsonify(vehicles=out)


@vehicles_bp.post("")
@login_required
def create_vehicle():
    data = request.get_json(silent=True) or {}

    if data.get("market_value") and not data.get("vehicle_master_id"):
        return jsonify(error="Manual vehicle value entry is not allowed. Select from Vehicle Master."), 400

    if not data.get("license_plate"):
        return jsonify(error="license_plate is required"), 400

    brand_id = data.get("brand_id")
    model_id = data.get("model_id")
    if brand_id is not None and model_id is not None:
        try:
            bid, mid = int(brand_id), int(model_id)
        except (TypeError, ValueError):
            return jsonify(error="brand_id and model_id must be integers"), 400
        if not MASTER_REPO.model_belongs_to_brand(bid, mid):
            return jsonify(error="Selected model does not belong to the selected brand"), 400

    rc_date = None
    if data.get("rc_date"):
        try:
            rc_date = datetime.fromisoformat(data["rc_date"]).date()
        except ValueError:
            rc_date = None

    vehicle = Vehicle(
        user_id=current_user().id,
        license_plate=(data.get("license_plate") or "").upper(),
        color=data.get("color"),
        chassis_number=data.get("chassis_number"),
        rc_date=rc_date,
        status="registered",
        make="",
        model="",
    )

    err_msg, status = _apply_master_valuation(vehicle, data)
    if err_msg:
        return jsonify(error=err_msg), status

    db.session.add(vehicle)
    db.session.commit()
    log_action(current_user().id, "create_vehicle", "vehicle", vehicle.id)
    return jsonify(vehicle=vehicle.to_dict()), 201


@vehicles_bp.post("/calculate-idv")
@login_required
def preview_idv():
    data = request.get_json(silent=True) or {}
    master_id = data.get("vehicle_master_id")
    year = data.get("year") or data.get("manufacturing_year")
    if not master_id or not year:
        return jsonify(error="vehicle_master_id and year are required"), 400
    rc_date = None
    if data.get("rc_date"):
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


@vehicles_bp.get("/<int:vehicle_id>")
@login_required
def get_vehicle(vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle:
        return jsonify(error="Vehicle not found"), 404
    if vehicle.user_id != current_user().id and current_user().role.value not in {
        "admin", "verifier", "agent", "surveyor", "claims_manager"
    }:
        return jsonify(error="Forbidden"), 403
    data = vehicle.to_dict()
    data["images"] = vehicle_photo_files(vehicle.id)
    data["documents"] = vehicle_document_files(vehicle.id)
    return jsonify(vehicle=data)


@vehicles_bp.post("/<int:vehicle_id>/images")
@login_required
def upload_vehicle_images(vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle or vehicle.user_id != current_user().id:
        return jsonify(error="Vehicle not found"), 404

    files = request.files.getlist("images") or request.files.getlist("image")
    if not files:
        return jsonify(error="No images provided"), 400

    saved = []
    for f in files:
        if not f.filename or not allowed(f.filename, ALLOWED_IMAGE):
            continue
        record = save_upload(
            f, folder=f"vehicles/{vehicle.id}", category="vehicle_image",
            owner_id=current_user().id, vehicle_id=vehicle.id,
        )
        saved.append(file_payload(record))

    log_action(current_user().id, "upload_vehicle_images", "vehicle", vehicle.id,
               meta={"count": len(saved)})
    return jsonify(images=saved), 201


@vehicles_bp.post("/<int:vehicle_id>/documents")
@login_required
def upload_vehicle_documents(vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle or vehicle.user_id != current_user().id:
        return jsonify(error="Vehicle not found"), 404

    saved = {}
    for category in VEHICLE_DOC_CATEGORIES:
        file_storage = request.files.get(category)
        if not file_storage or not file_storage.filename:
            continue
        if not allowed(file_storage.filename, ALLOWED_DOCUMENT):
            continue
        record = save_upload(
            file_storage,
            folder=f"vehicles/{vehicle.id}/documents",
            category=category,
            owner_id=current_user().id,
            vehicle_id=vehicle.id,
        )
        saved[category] = file_payload(record)

    if not saved:
        return jsonify(error="No valid documents provided"), 400

    log_action(
        current_user().id,
        "upload_vehicle_documents",
        "vehicle",
        vehicle.id,
        meta={"categories": list(saved.keys())},
    )
    return jsonify(documents=saved), 201


@vehicles_bp.post("/<int:vehicle_id>/submit-for-verification")
@login_required
def submit_for_verification(vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle or vehicle.user_id != current_user().id:
        return jsonify(error="Vehicle not found"), 404
    if len(vehicle_photo_files(vehicle.id)) < 3:
        return jsonify(error="Upload at least 3 vehicle images before submission"), 400
    if not vehicle_has_required_documents(vehicle.id):
        return jsonify(error="Upload RC and driving license before submission"), 400

    vehicle.status = "waiting_for_verifier"
    db.session.commit()
    log_action(
        current_user().id,
        "submit_vehicle_for_verification",
        "vehicle",
        vehicle.id,
        meta={"status": vehicle.status},
    )
    return jsonify(vehicle=vehicle.to_dict(), message="Vehicle added to verifier queue")
