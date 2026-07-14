"""Add surveyor and claims_manager to PostgreSQL role enum.

Revision ID: 20260630_role_enum
Revises:
Create Date: 2026-06-30

"""
from alembic import op
import sqlalchemy as sa

revision = "20260630_role_enum"
down_revision = None
branch_labels = None
depends_on = None

# Must stay in sync with app.models.user.Role
NEW_ROLE_VALUES = ("surveyor", "claims_manager")


def upgrade():
    conn = op.get_bind()
    exists = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role')")
    ).scalar()
    if not exists:
        return
    for value in NEW_ROLE_VALUES:
        conn.execute(sa.text(f"ALTER TYPE role ADD VALUE IF NOT EXISTS '{value}'"))


def downgrade():
    # PostgreSQL cannot drop individual enum labels without recreating the type.
    pass
