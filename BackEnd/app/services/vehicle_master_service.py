"""Business logic for Vehicle Master CRUD, import/export, and audit."""
from __future__ import annotations

import csv
import io
from typing import Any

from flask import request

from ..extensions import db
from ..models import DepreciationConfig, VehicleMaster, VehicleMasterAuditLog
from ..repositories.vehicle_master_repository import VehicleMasterRepository
from .idv_service import calculate_idv

REPO = VehicleMasterRepository()

CSV_COLUMNS = [
    "brand", "model", "variant", "fuel_type", "transmission", "body_type", "segment",
    "manufacturing_start_year", "manufacturing_end_year", "engine_cc",
    "ex_showroom_price", "currency", "is_active",
]


def _client_ip() -> str | None:
    return request.remote_addr if request else None


def log_vehicle_master_audit(
    admin_user_id: int,
    operation: str,
    *,
    vehicle_master_id: int | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
) -> VehicleMasterAuditLog:
    entry = VehicleMasterAuditLog(
        admin_user_id=admin_user_id,
        operation=operation,
        vehicle_master_id=vehicle_master_id,
        old_value=old_value,
        new_value=new_value,
        ip_address=_client_ip(),
    )
    db.session.add(entry)
    return entry


def _parse_bool(value, default=True) -> bool:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes", "on"}


def validate_master_payload(data: dict, *, partial: bool = False) -> tuple[dict | None, str | None]:
    required = ["brand", "model", "variant", "fuel_type", "transmission",
                "manufacturing_start_year", "ex_showroom_price"]
    if not partial:
        missing = [f for f in required if not data.get(f)]
        if missing:
            return None, f"Missing fields: {', '.join(missing)}"

    try:
        price = float(data.get("ex_showroom_price", 0))
        if price <= 0:
            return None, "ex_showroom_price must be positive"
    except (TypeError, ValueError):
        return None, "Invalid ex_showroom_price"

    start_year = int(data.get("manufacturing_start_year", 0))
    end_year = data.get("manufacturing_end_year")
    end_year = int(end_year) if end_year not in (None, "", 0) else None
    if end_year and end_year < start_year:
        return None, "manufacturing_end_year cannot be before start year"

    normalized = {
        "brand": (data.get("brand") or "").strip(),
        "model": (data.get("model") or "").strip(),
        "variant": (data.get("variant") or "").strip(),
        "fuel_type": (data.get("fuel_type") or "").strip(),
        "transmission": (data.get("transmission") or "").strip(),
        "body_type": (data.get("body_type") or "").strip() or None,
        "segment": (data.get("segment") or "").strip() or None,
        "manufacturing_start_year": start_year,
        "manufacturing_end_year": end_year,
        "engine_cc": int(data["engine_cc"]) if data.get("engine_cc") else None,
        "ex_showroom_price": price,
        "currency": (data.get("currency") or "INR").strip().upper(),
        "is_active": _parse_bool(data.get("is_active"), True),
    }
    return normalized, None


def create_vehicle_master(admin_user_id: int, data: dict) -> tuple[VehicleMaster | None, str | None]:
    payload, err = validate_master_payload(data)
    if err:
        return None, err
    row, _ = REPO.upsert_identity(payload)
    log_vehicle_master_audit(admin_user_id, "CREATE", vehicle_master_id=row.id, new_value=row.to_dict())
    db.session.commit()
    return row, None


def update_vehicle_master(
    admin_user_id: int, row: VehicleMaster, data: dict
) -> tuple[VehicleMaster | None, str | None]:
    payload, err = validate_master_payload({**row.to_dict(), **data}, partial=True)
    if err:
        return None, err
    old = row.to_dict()
    REPO.update(row, payload)
    log_vehicle_master_audit(admin_user_id, "UPDATE", vehicle_master_id=row.id, old_value=old, new_value=row.to_dict())
    db.session.commit()
    return row, None


def deactivate_vehicle_master(admin_user_id: int, row: VehicleMaster) -> VehicleMaster:
    old = row.to_dict()
    REPO.deactivate(row)
    log_vehicle_master_audit(admin_user_id, "DELETE", vehicle_master_id=row.id, old_value=old, new_value=row.to_dict())
    db.session.commit()
    return row


def import_vehicle_master_csv(admin_user_id: int, file_storage) -> dict:
    text = file_storage.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    created = updated = skipped = 0
    errors: list[str] = []

    for i, row in enumerate(reader, start=2):
        payload, err = validate_master_payload(row)
        if err:
            errors.append(f"Row {i}: {err}")
            skipped += 1
            continue
        if str(row.get("is_active", "true")).lower() in {"0", "false", "no"}:
            payload["is_active"] = False
        _, is_new = REPO.upsert_identity(payload)
        if is_new:
            created += 1
        else:
            updated += 1

    log_vehicle_master_audit(
        admin_user_id,
        "IMPORT",
        new_value={"created": created, "updated": updated, "skipped": skipped, "errors": errors[:20]},
    )
    db.session.commit()
    return {"created": created, "updated": updated, "skipped": skipped, "errors": errors}


def export_vehicle_master_csv() -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS)
    writer.writeheader()
    for row in VehicleMaster.query.order_by(
        VehicleMaster.brand, VehicleMaster.model, VehicleMaster.variant
    ).all():
        writer.writerow({
            "brand": row.brand,
            "model": row.model,
            "variant": row.variant,
            "fuel_type": row.fuel_type,
            "transmission": row.transmission,
            "body_type": row.body_type or "",
            "segment": row.segment or "",
            "manufacturing_start_year": row.manufacturing_start_year,
            "manufacturing_end_year": row.manufacturing_end_year or "",
            "engine_cc": row.engine_cc or "",
            "ex_showroom_price": float(row.ex_showroom_price),
            "currency": row.currency,
            "is_active": row.is_active,
        })
    return buf.getvalue()


def lookup_and_calculate(
    master_id: int,
    manufacturing_year: int,
    *,
    accessory_value: float = 0.0,
    rc_date=None,
) -> tuple[dict | None, str | None]:
    row = REPO.get_by_id(master_id, active_only=True)
    if not row:
        return None, "Vehicle master record not found"
    if manufacturing_year < row.manufacturing_start_year:
        return None, f"Manufacturing year must be {row.manufacturing_start_year} or later"
    if row.manufacturing_end_year and manufacturing_year > row.manufacturing_end_year:
        return None, f"Manufacturing year cannot exceed {row.manufacturing_end_year}"

    idv = calculate_idv(
        float(row.ex_showroom_price),
        manufacturing_year=manufacturing_year,
        rc_date=rc_date,
        accessory_value=accessory_value,
    )
    return {"vehicle_master": row.to_dict(), "valuation": idv}, None


def get_depreciation_config() -> DepreciationConfig:
    row = DepreciationConfig.query.first()
    if not row:
        row = DepreciationConfig()
        db.session.add(row)
        db.session.commit()
    return row


def update_depreciation_config(admin_user_id: int, data: dict) -> DepreciationConfig:
    row = get_depreciation_config()
    old = row.to_dict()
    lo = float(data.get("over_10_years_min_pct", row.over_10_years_min_pct or 40))
    hi = float(data.get("over_10_years_max_pct", row.over_10_years_max_pct or 50))
    applied = float(data.get("over_10_years_applied_pct", row.over_10_years_applied_pct or 50))
    applied = max(lo, min(hi, applied))
    row.over_10_years_min_pct = lo
    row.over_10_years_max_pct = hi
    row.over_10_years_applied_pct = applied
    log_vehicle_master_audit(
        admin_user_id, "UPDATE", new_value={"depreciation_config": row.to_dict(), "old": old}
    )
    db.session.commit()
    return row
