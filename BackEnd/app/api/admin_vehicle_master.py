from flask import Blueprint, Response, jsonify, request

from ..auth.utils import current_user, roles_required
from ..models import VehicleMasterAuditLog
from ..repositories.vehicle_master_repository import VehicleMasterRepository
from ..services import vehicle_master_service as svc

admin_vm_bp = Blueprint("admin_vehicle_master", __name__, url_prefix="/api/admin/vehicle-master")
REPO = VehicleMasterRepository()

ADMIN_ONLY = ("admin",)
READ_ROLES = ("admin", "surveyor", "claims_manager")


@admin_vm_bp.get("/export")
@roles_required(*ADMIN_ONLY)
def export_csv():
    csv_data = svc.export_vehicle_master_csv()
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=vehicle_master_export.csv"},
    )


@admin_vm_bp.get("/audit-logs")
@roles_required(*ADMIN_ONLY)
def audit_logs():
    logs = (
        VehicleMasterAuditLog.query.order_by(VehicleMasterAuditLog.created_at.desc())
        .limit(200)
        .all()
    )
    return jsonify(logs=[log.to_dict() for log in logs])


@admin_vm_bp.get("/depreciation-config")
@roles_required(*READ_ROLES)
def get_depreciation():
    return jsonify(config=svc.get_depreciation_config().to_dict())


@admin_vm_bp.put("/depreciation-config")
@roles_required(*ADMIN_ONLY)
def put_depreciation():
    row = svc.update_depreciation_config(
        current_user().id, request.get_json(silent=True) or {}
    )
    return jsonify(config=row.to_dict())


@admin_vm_bp.post("/import")
@roles_required(*ADMIN_ONLY)
def import_csv():
    file_storage = request.files.get("file")
    if not file_storage:
        return jsonify(error="CSV file required (field: file)"), 400
    result = svc.import_vehicle_master_csv(current_user().id, file_storage)
    return jsonify(result)


@admin_vm_bp.get("")
@roles_required(*READ_ROLES)
def list_records():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 25)), 1), 200)
    is_active = request.args.get("is_active")
    active_filter = None
    if is_active is not None:
        active_filter = str(is_active).lower() in {"1", "true", "yes"}
    items, total = REPO.search(
        q=request.args.get("q"),
        brand=request.args.get("brand"),
        model=request.args.get("model"),
        fuel_type=request.args.get("fuel_type"),
        is_active=active_filter,
        page=page,
        per_page=per_page,
    )
    return jsonify(
        items=[i.to_dict() for i in items],
        total=total,
        page=page,
        per_page=per_page,
    )


@admin_vm_bp.post("")
@roles_required(*ADMIN_ONLY)
def create_record():
    row, err = svc.create_vehicle_master(current_user().id, request.get_json(silent=True) or {})
    if err:
        return jsonify(error=err), 400
    return jsonify(vehicle_master=row.to_dict()), 201


@admin_vm_bp.get("/<int:record_id>")
@roles_required(*READ_ROLES)
def get_record(record_id):
    row = REPO.get_by_id(record_id)
    if not row:
        return jsonify(error="Not found"), 404
    return jsonify(vehicle_master=row.to_dict())


@admin_vm_bp.put("/<int:record_id>")
@roles_required(*ADMIN_ONLY)
def update_record(record_id):
    row = REPO.get_by_id(record_id)
    if not row:
        return jsonify(error="Not found"), 404
    updated, err = svc.update_vehicle_master(
        current_user().id, row, request.get_json(silent=True) or {}
    )
    if err:
        return jsonify(error=err), 400
    return jsonify(vehicle_master=updated.to_dict())


@admin_vm_bp.delete("/<int:record_id>")
@roles_required(*ADMIN_ONLY)
def deactivate_record(record_id):
    row = REPO.get_by_id(record_id)
    if not row:
        return jsonify(error="Not found"), 404
    svc.deactivate_vehicle_master(current_user().id, row)
    return jsonify(message="Vehicle deactivated", vehicle_master=row.to_dict())
