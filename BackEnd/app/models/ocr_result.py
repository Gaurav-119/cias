from ..extensions import db
from .mixins import TimestampMixin


class OCRResult(db.Model, TimestampMixin):
    __tablename__ = "ocr_results"

    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey("files.id"))
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"))

    text = db.Column(db.Text)
    fields = db.Column(db.JSON)  # parsed fields e.g. {"plate": "MH12AB1234"}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "file_id": self.file_id,
            "vehicle_id": self.vehicle_id,
            "text": self.text,
            "fields": self.fields,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
