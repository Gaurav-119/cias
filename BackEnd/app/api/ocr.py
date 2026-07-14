from flask import Blueprint, jsonify, request

from ..auth.utils import current_user, login_required
from ..extensions import db
from ..models import OCRResult, StoredFile
from ..services.ai_client import run_ocr
from ..storage import get_storage

ocr_bp = Blueprint("ocr", __name__, url_prefix="/api/ocr")


@ocr_bp.post("/file/<int:file_id>")
@login_required
def ocr_file(file_id):
    record = db.session.get(StoredFile, file_id)
    if not record:
        return jsonify(error="File not found"), 404

    storage = get_storage()
    try:
        result = run_ocr(storage.url(record.object_key))
    except Exception as exc:  # noqa: BLE001
        return jsonify(error=f"OCR service error: {exc}"), 502

    ocr = OCRResult(
        file_id=record.id,
        vehicle_id=record.vehicle_id,
        text=result.get("text"),
        fields=result.get("fields"),
    )
    db.session.add(ocr)
    db.session.commit()
    return jsonify(ocr=ocr.to_dict())
