from ..extensions import db
from .mixins import TimestampMixin


class VehicleMaster(db.Model, TimestampMixin):
    """Authoritative Indian passenger vehicle catalogue with ex-showroom prices (INR)."""

    __tablename__ = "vehicle_master"

    id = db.Column(db.Integer, primary_key=True)
    brand = db.Column(db.String(80), nullable=False, index=True)
    model = db.Column(db.String(120), nullable=False, index=True)
    variant = db.Column(db.String(120), nullable=False, index=True)
    fuel_type = db.Column(db.String(40), nullable=False, index=True)
    transmission = db.Column(db.String(40), nullable=False, index=True)
    body_type = db.Column(db.String(60))
    segment = db.Column(db.String(60))
    manufacturing_start_year = db.Column(db.Integer, nullable=False)
    manufacturing_end_year = db.Column(db.Integer)
    engine_cc = db.Column(db.Integer)
    ex_showroom_price = db.Column(db.Numeric(14, 2), nullable=False)
    currency = db.Column(db.String(8), default="INR", nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)

    __table_args__ = (
        db.UniqueConstraint(
            "brand", "model", "variant", "fuel_type", "transmission",
            name="uq_vehicle_master_identity",
        ),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "brand": self.brand,
            "model": self.model,
            "variant": self.variant,
            "fuel_type": self.fuel_type,
            "transmission": self.transmission,
            "body_type": self.body_type,
            "segment": self.segment,
            "manufacturing_start_year": self.manufacturing_start_year,
            "manufacturing_end_year": self.manufacturing_end_year,
            "engine_cc": self.engine_cc,
            "ex_showroom_price": float(self.ex_showroom_price),
            "currency": self.currency,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class VehicleMasterAuditLog(db.Model, TimestampMixin):
    """Immutable audit trail for Vehicle Master changes."""

    __tablename__ = "vehicle_master_audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    admin_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    operation = db.Column(db.String(20), nullable=False)  # CREATE|UPDATE|DELETE|IMPORT
    vehicle_master_id = db.Column(db.Integer, db.ForeignKey("vehicle_master.id"))
    old_value = db.Column(db.JSON)
    new_value = db.Column(db.JSON)
    ip_address = db.Column(db.String(60))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "admin_user_id": self.admin_user_id,
            "operation": self.operation,
            "vehicle_master_id": self.vehicle_master_id,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DepreciationConfig(db.Model, TimestampMixin):
    """Singleton-style depreciation settings (admin configurable)."""

    __tablename__ = "depreciation_config"

    id = db.Column(db.Integer, primary_key=True)
    over_10_years_min_pct = db.Column(db.Numeric(5, 2), default=40.0)
    over_10_years_max_pct = db.Column(db.Numeric(5, 2), default=50.0)
    over_10_years_applied_pct = db.Column(db.Numeric(5, 2), default=50.0)

    def to_dict(self) -> dict:
        return {
            "over_10_years_min_pct": float(self.over_10_years_min_pct or 40),
            "over_10_years_max_pct": float(self.over_10_years_max_pct or 50),
            "over_10_years_applied_pct": float(self.over_10_years_applied_pct or 50),
        }
