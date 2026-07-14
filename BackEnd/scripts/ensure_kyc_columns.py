"""Add KYC columns to users table if missing (safe to run multiple times).

Run from the BackEnd folder:
    python scripts/ensure_kyc_columns.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Allow `from app import ...` when executed as a script.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import inspect, text

from app import create_app
from app.extensions import db


def ensure_kyc_columns():
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        columns = {col["name"] for col in inspector.get_columns("users")}
        statements = []
        if "date_of_birth" not in columns:
            statements.append("ALTER TABLE users ADD COLUMN date_of_birth DATE")
        if "identity_proof_type" not in columns:
            statements.append("ALTER TABLE users ADD COLUMN identity_proof_type VARCHAR(30)")
        if "identity_proof_number" not in columns:
            statements.append("ALTER TABLE users ADD COLUMN identity_proof_number VARCHAR(40)")
        if "kyc_status" not in columns:
            statements.append("ALTER TABLE users ADD COLUMN kyc_status VARCHAR(20) DEFAULT 'submitted'")
        for stmt in statements:
            db.session.execute(text(stmt))
        if statements:
            db.session.commit()
            print("Applied:")
            for stmt in statements:
                print(f"- {stmt}")
        else:
            print("KYC columns already present.")


if __name__ == "__main__":
    ensure_kyc_columns()
