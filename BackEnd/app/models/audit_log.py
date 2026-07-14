from ..extensions import db
from .mixins import TimestampMixin


class AuditLog(db.Model, TimestampMixin):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    action = db.Column(db.String(80), nullable=False)
    entity = db.Column(db.String(60))
    entity_id = db.Column(db.String(60))
    meta = db.Column(db.JSON)
    ip = db.Column(db.String(60))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "actor_id": self.actor_id,
            "action": self.action,
            "entity": self.entity,
            "entity_id": self.entity_id,
            "meta": self.meta,
            "ip": self.ip,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
