from ..extensions import db
from .mixins import TimestampMixin


class StoredFile(db.Model, TimestampMixin):
    """Metadata for an object kept in the storage layer.

    The binary lives in Local/MinIO/S3 - only this row lives in PostgreSQL.
    """

    __tablename__ = "files"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    category = db.Column(db.String(40), index=True)  # vehicle_image, damage_image, ...
    bucket = db.Column(db.String(120), nullable=False)
    object_key = db.Column(db.String(400), nullable=False)
    provider = db.Column(db.String(20), nullable=False)
    content_type = db.Column(db.String(120))
    size = db.Column(db.Integer)
    original_name = db.Column(db.String(255))

    # Optional links to owning entities
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"))
    claim_id = db.Column(db.Integer, db.ForeignKey("claims.id"))

    def to_dict(self, url: str | None = None) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "object_key": self.object_key,
            "provider": self.provider,
            "content_type": self.content_type,
            "size": self.size,
            "original_name": self.original_name,
            "url": url,
        }
