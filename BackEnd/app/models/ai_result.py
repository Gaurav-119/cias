from ..extensions import db
from .mixins import TimestampMixin


class AIResult(db.Model, TimestampMixin):
    __tablename__ = "ai_results"

    id = db.Column(db.Integer, primary_key=True)
    claim_id = db.Column(db.Integer, db.ForeignKey("claims.id"), index=True)

    severity = db.Column(db.String(30))
    severity_score = db.Column(db.Float)
    total_cost = db.Column(db.Numeric(12, 2))
    valid = db.Column(db.Boolean, default=False)
    fraud_flag = db.Column(db.Boolean, default=False)
    detections = db.Column(db.JSON)
    raw = db.Column(db.JSON)
    report = db.Column(db.JSON)
    claim_recommendation = db.Column(db.String(80))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "claim_id": self.claim_id,
            "severity": self.severity,
            "severity_score": self.severity_score,
            "total_cost": float(self.total_cost) if self.total_cost else None,
            "valid": self.valid,
            "fraud_flag": self.fraud_flag,
            "detections": self.detections,
            "report": self.report,
            "claim_recommendation": self.claim_recommendation,
            "raw": self.raw,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
