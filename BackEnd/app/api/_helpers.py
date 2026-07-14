from __future__ import annotations

from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import StoredFile
from ..storage import get_storage

ALLOWED_IMAGE = {"png", "jpg", "jpeg", "gif", "webp"}
ALLOWED_MEDIA = ALLOWED_IMAGE | {"mp4", "webm", "mov", "pdf"}
ALLOWED_DOCUMENT = ALLOWED_IMAGE | {"pdf"}

USER_KYC_CATEGORIES = ("identity_proof", "passport_photo", "address_proof")
VEHICLE_DOC_CATEGORIES = (
    "rc_document",
    "driving_license",
    "insurance_certificate",
    "pollution_certificate",
)


def allowed(filename: str, allowed_set=ALLOWED_IMAGE) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_set


def save_upload(file_storage, *, folder, category, owner_id=None,
                vehicle_id=None, claim_id=None) -> StoredFile:
    """Persist an uploaded file via the storage abstraction and record a row.

    The binary goes to Local/MinIO/S3; only the object key/metadata lands in
    PostgreSQL.
    """
    storage = get_storage()
    data = file_storage.read()
    filename = secure_filename(file_storage.filename or "upload")
    stored = storage.save(
        data,
        folder=folder,
        filename=filename,
        content_type=file_storage.mimetype or "application/octet-stream",
    )
    record = StoredFile(
        owner_id=owner_id,
        category=category,
        bucket=stored.bucket,
        object_key=stored.object_key,
        provider=stored.provider,
        content_type=stored.content_type,
        size=stored.size,
        original_name=filename,
        vehicle_id=vehicle_id,
        claim_id=claim_id,
    )
    db.session.add(record)
    db.session.commit()
    return record


def file_payload(record: StoredFile) -> dict:
    storage = get_storage()
    return record.to_dict(url=storage.url(record.object_key))


def user_kyc_documents(user_id: int) -> dict:
    files = StoredFile.query.filter(
        StoredFile.owner_id == user_id,
        StoredFile.category.in_(USER_KYC_CATEGORIES),
    ).all()
    grouped: dict[str, list] = {cat: [] for cat in USER_KYC_CATEGORIES}
    for record in files:
        grouped.setdefault(record.category, []).append(file_payload(record))
    return grouped


def vehicle_photo_files(vehicle_id: int) -> list:
    records = StoredFile.query.filter_by(
        vehicle_id=vehicle_id, category="vehicle_image"
    ).all()
    return [file_payload(record) for record in records]


def vehicle_document_files(vehicle_id: int) -> dict:
    records = StoredFile.query.filter(
        StoredFile.vehicle_id == vehicle_id,
        StoredFile.category.in_(VEHICLE_DOC_CATEGORIES),
    ).all()
    grouped: dict[str, list] = {cat: [] for cat in VEHICLE_DOC_CATEGORIES}
    for record in records:
        grouped.setdefault(record.category, []).append(file_payload(record))
    return grouped


def vehicle_has_required_documents(vehicle_id: int) -> bool:
    records = StoredFile.query.filter(
        StoredFile.vehicle_id == vehicle_id,
        StoredFile.category.in_(("rc_document", "driving_license")),
    ).all()
    categories = {record.category for record in records}
    return "rc_document" in categories and "driving_license" in categories
