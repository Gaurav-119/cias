from ..extensions import db
from .mixins import TimestampMixin


class Session(db.Model, TimestampMixin):
    """Issued-JWT tracking so tokens can be listed / revoked server side."""

    __tablename__ = "sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    jti = db.Column(db.String(64), unique=True, index=True)
    ip = db.Column(db.String(60))
    user_agent = db.Column(db.String(255))
    expires_at = db.Column(db.DateTime)
    revoked = db.Column(db.Boolean, default=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "ip": self.ip,
            "user_agent": self.user_agent,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "revoked": self.revoked,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
