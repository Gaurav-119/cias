from ..extensions import db
from .mixins import TimestampMixin


class Provider(db.Model, TimestampMixin):
    """Insurance company managed by Agents."""

    __tablename__ = "providers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    sector = db.Column(db.String(80))  # public | private
    active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "sector": self.sector,
                "active": self.active}


class Pricing(db.Model, TimestampMixin):
    """Premium range per policy type (Third Party / Comprehensive / Own Damage)."""

    __tablename__ = "pricing"

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey("providers.id"))
    policy_type = db.Column(db.String(40), nullable=False)
    price_min = db.Column(db.Numeric(12, 2), nullable=False)
    price_max = db.Column(db.Numeric(12, 2), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "provider_id": self.provider_id,
            "policy_type": self.policy_type,
            "price_min": float(self.price_min),
            "price_max": float(self.price_max),
        }


class Addon(db.Model, TimestampMixin):
    """Add-on cover e.g. Zero Depreciation, Engine Protection."""

    __tablename__ = "addons"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    price = db.Column(db.Numeric(12, 2), nullable=False)
    active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "price": float(self.price),
                "active": self.active}


class VehicleBasePrice(db.Model, TimestampMixin):
    """Catalog base price (B) used for IDV computation."""

    __tablename__ = "vehicle_base_prices"

    id = db.Column(db.Integer, primary_key=True)
    make = db.Column(db.String(80), nullable=False)
    model = db.Column(db.String(80), nullable=False)
    variant = db.Column(db.String(80))
    fuel_type = db.Column(db.String(30))
    transmission = db.Column(db.String(30))
    base_price = db.Column(db.Numeric(12, 2), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "make": self.make,
            "model": self.model,
            "variant": self.variant,
            "fuel_type": self.fuel_type,
            "transmission": self.transmission,
            "base_price": float(self.base_price),
        }
