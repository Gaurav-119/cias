from ..extensions import db
from .mixins import TimestampMixin


class VerificationSession(db.Model, TimestampMixin):
    __tablename__ = "verification_sessions"

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), index=True)
    verifier_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    status = db.Column(db.String(30), default="pending")  # pending|active|completed
    decision = db.Column(db.String(20))  # approved | rejected
    checklist = db.Column(db.JSON)
    remarks = db.Column(db.Text)
    started_at = db.Column(db.DateTime)
    ended_at = db.Column(db.DateTime)

    media = db.relationship("VerificationMedia", backref="session", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "vehicle_id": self.vehicle_id,
            "verifier_id": self.verifier_id,
            "status": self.status,
            "decision": self.decision,
            "checklist": self.checklist,
            "remarks": self.remarks,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
        }


class VerificationMedia(db.Model, TimestampMixin):
    __tablename__ = "verification_media"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("verification_sessions.id"))
    file_id = db.Column(db.Integer, db.ForeignKey("files.id"))
    kind = db.Column(db.String(20))  # recording | snapshot
