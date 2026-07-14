"""Bootstrap Vehicle Master catalogue on API startup if the table is empty."""
from __future__ import annotations

import csv
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import VehicleMaster
from ..repositories.vehicle_master_repository import VehicleMasterRepository
from .vehicle_master_service import validate_master_payload

_CATALOG = Path(__file__).resolve().parents[2] / "data" / "vehicle_master_catalog.csv"


def _ensure_schema() -> None:
  db.create_all()
  inspector = inspect(db.engine)
  if not inspector.has_table("vehicles"):
    return
  columns = {c["name"] for c in inspector.get_columns("vehicles")}
  vehicle_cols = {
    "vehicle_master_id": "INTEGER",
    "variant": "VARCHAR(120)",
    "transmission": "VARCHAR(40)",
    "ex_showroom_price": "NUMERIC(14,2)",
    "accessory_value": "NUMERIC(12,2) DEFAULT 0",
    "vehicle_age_months": "INTEGER",
    "vehicle_age_years": "NUMERIC(6,2)",
    "depreciation_percentage": "NUMERIC(5,2)",
    "depreciation_amount": "NUMERIC(14,2)",
    "calculated_idv": "NUMERIC(14,2)",
    "max_claim_amount": "NUMERIC(14,2)",
  }
  for col, typedef in vehicle_cols.items():
    if col not in columns:
      db.session.execute(text(f"ALTER TABLE vehicles ADD COLUMN {col} {typedef}"))
  db.session.commit()


def _import_catalog_from_csv() -> int:
  if not _CATALOG.exists():
    return 0
  repo = VehicleMasterRepository()
  count = 0
  with _CATALOG.open(encoding="utf-8-sig") as handle:
    reader = csv.DictReader(handle)
    for row in reader:
      payload, err = validate_master_payload(row)
      if err:
        continue
      if str(row.get("is_active", "true")).lower() in {"0", "false", "no"}:
        payload["is_active"] = False
      repo.upsert_identity(payload)
      count += 1
  db.session.commit()
  return count


def bootstrap_vehicle_master_catalog(app) -> None:
  """Idempotent: create tables/columns and seed catalogue when empty."""
  with app.app_context():
    try:
      _ensure_schema()
      # Serialize bootstrap across gunicorn workers.
      db.session.execute(text("SELECT pg_advisory_lock(842001)"))
      total = VehicleMaster.query.count()
      if total > 0:
        app.logger.info("Vehicle Master catalogue ready (%s records)", total)
        return
      imported = _import_catalog_from_csv()
      total = VehicleMaster.query.count()
      if total:
        app.logger.info("Vehicle Master catalogue imported (%s rows from CSV)", imported)
      else:
        app.logger.warning(
          "Vehicle Master catalogue is empty — add data via Admin or place CSV at %s",
          _CATALOG,
        )
    except IntegrityError:
      db.session.rollback()
      total = VehicleMaster.query.count()
      if total:
        app.logger.info("Vehicle Master catalogue ready (%s records)", total)
    except Exception as exc:  # noqa: BLE001
      db.session.rollback()
      app.logger.warning("Vehicle Master bootstrap skipped: %s", exc)
    finally:
      try:
        db.session.execute(text("SELECT pg_advisory_unlock(842001)"))
        db.session.commit()
      except Exception:  # noqa: BLE001
        db.session.rollback()
