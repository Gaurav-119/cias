"""Add repair cost master tables and AI assessment columns."""
from alembic import op
import sqlalchemy as sa

revision = "20260701_repair_master"
down_revision = "20260630_role_enum"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if not inspector.has_table("repair_cost_master"):
        op.create_table(
            "repair_cost_master",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("panel_name", sa.String(120), nullable=False),
            sa.Column("damage_type", sa.String(80), nullable=False),
            sa.Column("severity", sa.String(20), nullable=False),
            sa.Column("min_cost", sa.Numeric(12, 2), nullable=False),
            sa.Column("max_cost", sa.Numeric(12, 2), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint(
                "panel_name", "damage_type", "severity", name="uq_repair_cost_identity"
            ),
        )
        op.create_index("ix_repair_cost_master_panel_name", "repair_cost_master", ["panel_name"])
        op.create_index("ix_repair_cost_master_damage_type", "repair_cost_master", ["damage_type"])

    if not inspector.has_table("claim_rules_config"):
        op.create_table(
            "claim_rules_config",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("minor_threshold", sa.Float(), nullable=False, server_default="0.08"),
            sa.Column("moderate_threshold", sa.Float(), nullable=False, server_default="0.25"),
            sa.Column("cashless_max_amount", sa.Numeric(12, 2), server_default="75000"),
            sa.Column("auto_review_min_confidence", sa.Float(), server_default="0.55"),
            sa.Column("idv_cap_percentage", sa.Float(), server_default="0.6"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    if inspector.has_table("ai_results"):
        cols = {c["name"] for c in inspector.get_columns("ai_results")}
        if "report" not in cols:
            op.add_column("ai_results", sa.Column("report", sa.JSON(), nullable=True))
        if "claim_recommendation" not in cols:
            op.add_column("ai_results", sa.Column("claim_recommendation", sa.String(80), nullable=True))


def downgrade():
    op.drop_table("claim_rules_config")
    op.drop_table("repair_cost_master")
