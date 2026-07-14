from ..extensions import db
from .mixins import TimestampMixin


class ClaimEvent(db.Model, TimestampMixin):
    """Append-only status history powering the claim tracking timeline."""

    __tablename__ = "claim_events"

    id = db.Column(db.Integer, primary_key=True)
    claim_id = db.Column(db.Integer, db.ForeignKey("claims.id"), index=True)
    status = db.Column(db.String(30), nullable=False)
    note = db.Column(db.String(255))
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "claim_id": self.claim_id,
            "status": self.status,
            "note": self.note,
            "actor_id": self.actor_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
