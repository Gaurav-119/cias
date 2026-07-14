from flask import Blueprint, jsonify

from ..auth.utils import login_required
from ..services.ai_client import _base
import requests

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")


@ai_bp.get("/health")
@login_required
def ai_health():
    try:
        resp = requests.get(f"{_base()}/health", timeout=10)
        return jsonify(ai=resp.json())
    except Exception as exc:  # noqa: BLE001
        return jsonify(error=str(exc), ai={"status": "unreachable"}), 502
