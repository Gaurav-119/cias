"""Ensure PostgreSQL role enum includes every SQLAlchemy Role member."""
from __future__ import annotations

from sqlalchemy import text

from app.extensions import db
from app.models.user import Role

_PG_TYPE = "role"


def ensure_role_enum() -> None:
    """Idempotent: extend the DB enum when new Role values are added in code."""
    url = str(db.engine.url)
    if not url.startswith("postgresql"):
        return

    existing = {
        row[0]
        for row in db.session.execute(
            text(
                """
                SELECT e.enumlabel
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = :type_name
                """
            ),
            {"type_name": _PG_TYPE},
        )
    }
    if not existing:
        return

    for role in Role:
        if role.value in existing:
            continue
        db.session.execute(
            text(f"ALTER TYPE {_PG_TYPE} ADD VALUE IF NOT EXISTS '{role.value}'")
        )
        existing.add(role.value)

    db.session.commit()
