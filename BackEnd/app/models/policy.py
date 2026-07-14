from ..extensions import db
from .mixins import TimestampMixin


class Policy(db.Model, TimestampMixin):
    __tablename__ = "policies"

    id = db.Column(db.Integer, primary_key=True)
    policy_number = db.Column(db.String(40), unique=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=False)
    provider_id = db.Column(db.Integer, db.ForeignKey("providers.id"))

    policy_type = db.Column(db.String(40))  # third_party | comprehensive | own_damage
    tenure_years = db.Column(db.Integer, default=1)
    idv = db.Column(db.Numeric(12, 2))
    base_premium = db.Column(db.Numeric(12, 2))
    addon_premium = db.Column(db.Numeric(12, 2))
    total_premium = db.Column(db.Numeric(12, 2))
    gst = db.Column(db.Numeric(12, 2))
    addons = db.Column(db.JSON, default=list)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    status = db.Column(db.String(30), default="pending")  # pending | active | expired

    owner = db.relationship("User", back_populates="policies")
    vehicle = db.relationship("Vehicle")
    provider = db.relationship("Provider")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "policy_number": self.policy_number,
            "user_id": self.user_id,
            "vehicle_id": self.vehicle_id,
            "provider_id": self.provider_id,
            "policy_type": self.policy_type,
            "tenure_years": self.tenure_years,
            "idv": float(self.idv) if self.idv else None,
            "base_premium": float(self.base_premium) if self.base_premium else None,
            "addon_premium": float(self.addon_premium) if self.addon_premium else None,
            "total_premium": float(self.total_premium) if self.total_premium else None,
            "gst": float(self.gst) if self.gst else None,
            "addons": self.addons or [],
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
