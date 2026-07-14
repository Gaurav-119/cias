from ..extensions import db
from .mixins import TimestampMixin


class Claim(db.Model, TimestampMixin):
    __tablename__ = "claims"

    id = db.Column(db.Integer, primary_key=True)
    claim_number = db.Column(db.String(40), unique=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"))
    policy_id = db.Column(db.Integer, db.ForeignKey("policies.id"))

    damage_type = db.Column(db.String(40))  # Minor | Major | Total Loss
    cause = db.Column(db.String(60))  # Collision | Natural Disaster | Theft
    incident_date = db.Column(db.Date)
    police_report = db.Column(db.String(80))
    witness_info = db.Column(db.String(255))
    description = db.Column(db.Text)

    estimated_cost = db.Column(db.Numeric(12, 2))
    final_amount = db.Column(db.Numeric(12, 2))
    fraud_flag = db.Column(db.Boolean, default=False)
    # pending | under_review | approved | rejected | paid
    status = db.Column(db.String(30), default="pending")

    owner = db.relationship("User", back_populates="claims")
    vehicle = db.relationship("Vehicle")
    policy = db.relationship("Policy")
    images = db.relationship(
        "StoredFile", backref="claim", lazy="dynamic",
        primaryjoin="Claim.id==StoredFile.claim_id",
    )
    ai_results = db.relationship("AIResult", backref="claim", lazy="dynamic")
    events = db.relationship(
        "ClaimEvent", backref="claim", lazy="dynamic",
        order_by="ClaimEvent.created_at",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "claim_number": self.claim_number,
            "user_id": self.user_id,
            "vehicle_id": self.vehicle_id,
            "policy_id": self.policy_id,
            "damage_type": self.damage_type,
            "cause": self.cause,
            "incident_date": self.incident_date.isoformat() if self.incident_date else None,
            "police_report": self.police_report,
            "witness_info": self.witness_info,
            "description": self.description,
            "estimated_cost": float(self.estimated_cost) if self.estimated_cost else None,
            "final_amount": float(self.final_amount) if self.final_amount else None,
            "fraud_flag": self.fraud_flag,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
