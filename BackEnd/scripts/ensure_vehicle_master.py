"""Ensure Vehicle Master tables and vehicle valuation columns exist."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import inspect, text

from app import create_app
from app.extensions import db


def ensure_vehicle_master():
    app = create_app()
    with app.app_context():
        db.create_all()

        inspector = inspect(db.engine)
        if inspector.has_table("vehicles"):
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

        print("Vehicle Master schema ensured.")


if __name__ == "__main__":
    ensure_vehicle_master()
