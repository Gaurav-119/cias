from ..extensions import db
from .mixins import TimestampMixin


class Payment(db.Model, TimestampMixin):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    policy_id = db.Column(db.Integer, db.ForeignKey("policies.id"))

    amount = db.Column(db.Numeric(12, 2), nullable=False)
    currency = db.Column(db.String(8), default="INR")
    method = db.Column(db.String(30), default="stripe")  # stripe | record
    status = db.Column(db.String(30), default="pending")  # pending | completed | failed
    transaction_ref = db.Column(db.String(120))
    stripe_payment_intent_id = db.Column(db.String(120), index=True)
    stripe_transaction_id = db.Column(db.String(120))
    payment_method = db.Column(db.String(60))
    description = db.Column(db.String(255))

    user = db.relationship("User")
    policy = db.relationship("Policy")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "policy_id": self.policy_id,
            "amount": float(self.amount) if self.amount else None,
            "currency": self.currency,
            "method": self.method,
            "status": self.status,
            "transaction_ref": self.transaction_ref,
            "stripe_payment_intent_id": self.stripe_payment_intent_id,
            "stripe_transaction_id": self.stripe_transaction_id,
            "payment_method": self.payment_method,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
