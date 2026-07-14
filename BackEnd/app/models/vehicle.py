from ..extensions import db
from .mixins import TimestampMixin


class Vehicle(db.Model, TimestampMixin):
    __tablename__ = "vehicles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    vehicle_master_id = db.Column(db.Integer, db.ForeignKey("vehicle_master.id"), index=True)

    make = db.Column(db.String(80), nullable=False)
    model = db.Column(db.String(80), nullable=False)
    variant = db.Column(db.String(120))
    year = db.Column(db.Integer)
    license_plate = db.Column(db.String(30), index=True)
    fuel_type = db.Column(db.String(30))
    transmission = db.Column(db.String(40))
    color = db.Column(db.String(40))
    chassis_number = db.Column(db.String(60))
    market_value = db.Column(db.Numeric(12, 2))  # legacy; new flow uses ex_showroom_price
    ex_showroom_price = db.Column(db.Numeric(14, 2))
    accessory_value = db.Column(db.Numeric(12, 2), default=0)
    vehicle_age_months = db.Column(db.Integer)
    vehicle_age_years = db.Column(db.Numeric(6, 2))
    depreciation_percentage = db.Column(db.Numeric(5, 2))
    depreciation_amount = db.Column(db.Numeric(14, 2))
    calculated_idv = db.Column(db.Numeric(14, 2))
    max_claim_amount = db.Column(db.Numeric(14, 2))
    rc_date = db.Column(db.Date)
    # registered | pending_verification | verified | rejected
    status = db.Column(db.String(30), default="registered")

    owner = db.relationship("User", back_populates="vehicles")
    vehicle_master = db.relationship("VehicleMaster")
    images = db.relationship(
        "StoredFile", backref="vehicle", lazy="dynamic",
        primaryjoin="Vehicle.id==StoredFile.vehicle_id",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "vehicle_master_id": self.vehicle_master_id,
            "make": self.make,
            "model": self.model,
            "variant": self.variant,
            "year": self.year,
            "license_plate": self.license_plate,
            "fuel_type": self.fuel_type,
            "transmission": self.transmission,
            "color": self.color,
            "chassis_number": self.chassis_number,
            "market_value": float(self.market_value) if self.market_value else None,
            "ex_showroom_price": float(self.ex_showroom_price) if self.ex_showroom_price else None,
            "accessory_value": float(self.accessory_value) if self.accessory_value else 0,
            "vehicle_age_months": self.vehicle_age_months,
            "vehicle_age_years": float(self.vehicle_age_years) if self.vehicle_age_years else None,
            "depreciation_percentage": float(self.depreciation_percentage) if self.depreciation_percentage else None,
            "depreciation_amount": float(self.depreciation_amount) if self.depreciation_amount else None,
            "calculated_idv": float(self.calculated_idv) if self.calculated_idv else None,
            "max_claim_amount": float(self.max_claim_amount) if self.max_claim_amount else None,
            "rc_date": self.rc_date.isoformat() if self.rc_date else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
