"""Add Stripe payment columns to payments table if missing."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import inspect, text

from app import create_app
from app.extensions import db

COLUMNS = {
    "stripe_payment_intent_id": "VARCHAR(120)",
    "stripe_transaction_id": "VARCHAR(120)",
    "payment_method": "VARCHAR(60)",
}


def ensure_payment_columns():
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        if "payments" not in inspector.get_table_names():
            print("payments table does not exist yet — will be created on startup.")
            return
        existing = {col["name"] for col in inspector.get_columns("payments")}
        statements = [
            f"ALTER TABLE payments ADD COLUMN {name} {dtype}"
            for name, dtype in COLUMNS.items()
            if name not in existing
        ]
        for stmt in statements:
            db.session.execute(text(stmt))
        if statements:
            db.session.commit()
            print("Applied payment column updates:")
            for stmt in statements:
                print(f"- {stmt}")
        else:
            print("Payment columns already present.")


if __name__ == "__main__":
    ensure_payment_columns()
