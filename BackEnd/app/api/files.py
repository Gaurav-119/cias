from flask import Blueprint, Response, abort

from ..extensions import db
from ..models import StoredFile
from ..storage import get_storage

files_bp = Blueprint("files", __name__, url_prefix="/api/files")


@files_bp.get("/<path:object_key>")
def serve_file(object_key):
    """Stream stored objects through the API for any configured storage backend."""
    storage = get_storage()
    try:
        data = storage.read(object_key)
    except Exception:
        abort(404)

    record = db.session.query(StoredFile).filter_by(object_key=object_key).first()
    mimetype = (record.content_type if record else None) or "application/octet-stream"
    return Response(data, mimetype=mimetype)
