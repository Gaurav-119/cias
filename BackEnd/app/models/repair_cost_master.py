"""Admin-configurable repair cost catalogue and claim assessment rules."""
from ..extensions import db
from .mixins import TimestampMixin


class RepairCostMaster(db.Model, TimestampMixin):
    __tablename__ = "repair_cost_master"

    id = db.Column(db.Integer, primary_key=True)
    vehicle_brand = db.Column(db.String(80), nullable=False, default="*", index=True)
    vehicle_model = db.Column(db.String(80), nullable=False, default="*", index=True)
    panel_name = db.Column(db.String(120), nullable=False, index=True)
    damage_type = db.Column(db.String(80), nullable=False, index=True)
    severity = db.Column(db.String(30), nullable=False)  # Minor | Moderate | Severe | Inspection Required
    min_cost = db.Column(db.Numeric(12, 2), nullable=False)
    max_cost = db.Column(db.Numeric(12, 2), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    __table_args__ = (
        db.UniqueConstraint(
            "vehicle_brand", "vehicle_model", "panel_name", "damage_type", "severity",
            name="uq_repair_cost_identity",
        ),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "vehicle_brand": self.vehicle_brand,
            "vehicle_model": self.vehicle_model,
            "panel_name": self.panel_name,
            "damage_type": self.damage_type,
            "severity": self.severity,
            "min_cost": float(self.min_cost),
            "max_cost": float(self.max_cost),
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ClaimRulesConfig(db.Model, TimestampMixin):
    """Singleton-style claim rules (severity thresholds, cashless, etc.)."""

    __tablename__ = "claim_rules_config"

    id = db.Column(db.Integer, primary_key=True)
    minor_threshold = db.Column(db.Float, default=0.08, nullable=False)
    moderate_threshold = db.Column(db.Float, default=0.25, nullable=False)
    cashless_max_amount = db.Column(db.Numeric(12, 2), default=75000)
    auto_review_min_confidence = db.Column(db.Float, default=0.55)
    idv_cap_percentage = db.Column(db.Float, default=0.6)
    deductible_percentage = db.Column(db.Float, default=0.02)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "minor_threshold": self.minor_threshold,
            "moderate_threshold": self.moderate_threshold,
            "cashless_max_amount": float(self.cashless_max_amount or 0),
            "auto_review_min_confidence": self.auto_review_min_confidence,
            "idv_cap_percentage": self.idv_cap_percentage,
            "deductible_percentage": self.deductible_percentage,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
