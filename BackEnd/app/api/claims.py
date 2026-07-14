from datetime import datetime

import requests
from flask import Blueprint, Response, current_app, jsonify, request

from ..auth.utils import current_user, login_required
from ..extensions import db
from ..models import AIResult, Claim, Vehicle
from ..services import premium as prem
from ..services.ai_client import predict_damage
from ..services.audit import log_action, record_claim_event
from ..services.claim_pdf_generator import generate_claim_summary_pdf, generate_damage_report_pdf
from ..services.damage_assessment_service import build_assessment_report
from ..storage import get_storage
from ._helpers import ALLOWED_IMAGE, allowed, file_payload, save_upload

claims_bp = Blueprint("claims", __name__, url_prefix="/api/claims")


def _vehicle_claim_cap(vehicle: Vehicle | None) -> float | None:
    if not vehicle:
        return None
    if vehicle.max_claim_amount:
        return float(vehicle.max_claim_amount)
    if vehicle.calculated_idv:
        return float(vehicle.calculated_idv)
    return float(vehicle.market_value) if vehicle.market_value else None


def _cap_amount(amount, cap: float | None) -> float | None:
    if amount is None or cap is None:
        return amount
    return min(float(amount), cap)


def _latest_ai(claim: Claim) -> AIResult | None:
    return claim.ai_results.order_by(AIResult.created_at.desc()).first()


def _can_view_claim(claim: Claim) -> bool:
    if claim.user_id == current_user().id:
        return True
    return current_user().role.value in {
        "admin", "verifier", "surveyor", "claims_manager"
    }


@claims_bp.get("")
@login_required
def list_claims():
    claims = Claim.query.filter_by(user_id=current_user().id).order_by(
        Claim.created_at.desc()
    ).all()
    return jsonify(claims=[c.to_dict() for c in claims])


@claims_bp.post("")
@login_required
def create_claim():
    data = request.get_json(silent=True) or {}
    vehicle = db.session.get(Vehicle, data.get("vehicle_id"))
    if not vehicle or vehicle.user_id != current_user().id:
        return jsonify(error="Vehicle not found"), 404

    incident_date = None
    if data.get("incident_date"):
        try:
            incident_date = datetime.fromisoformat(data["incident_date"]).date()
        except ValueError:
            incident_date = None

    claim = Claim(
        user_id=current_user().id,
        vehicle_id=vehicle.id,
        policy_id=data.get("policy_id"),
        damage_type=data.get("damage_type"),
        cause=data.get("cause"),
        incident_date=incident_date,
        police_report=data.get("police_report"),
        witness_info=data.get("witness_info"),
        description=data.get("description"),
        status="pending",
    )
    db.session.add(claim)
    db.session.commit()
    claim.claim_number = prem.generate_claim_number(claim.id)
    db.session.commit()
    record_claim_event(claim.id, "pending", "Claim submitted by policyholder",
                       current_user().id)
    log_action(current_user().id, "create_claim", "claim", claim.id)
    return jsonify(claim=claim.to_dict()), 201


@claims_bp.get("/<int:claim_id>")
@login_required
def get_claim(claim_id):
    claim = db.session.get(Claim, claim_id)
    if not claim:
        return jsonify(error="Claim not found"), 404
    if not _can_view_claim(claim):
        return jsonify(error="Forbidden"), 403
    data = claim.to_dict()
    cap = _vehicle_claim_cap(claim.vehicle)
    if cap is not None:
        data["max_claim_amount"] = cap
    data["images"] = [file_payload(f) for f in claim.images]
    data["ai_results"] = [r.to_dict() for r in claim.ai_results]
    data["events"] = [e.to_dict() for e in claim.events]
    return jsonify(claim=data)


@claims_bp.get("/<int:claim_id>/assessment")
@login_required
def get_assessment(claim_id):
    claim = db.session.get(Claim, claim_id)
    if not claim:
        return jsonify(error="Claim not found"), 404
    if not _can_view_claim(claim):
        return jsonify(error="Forbidden"), 403
    ai = _latest_ai(claim)
    if not ai or not ai.report:
        return jsonify(error="AI assessment not available yet"), 404
    images = [file_payload(f) for f in claim.images]
    cap = _vehicle_claim_cap(claim.vehicle)
    vehicle = claim.vehicle.to_dict() if claim.vehicle else None
    return jsonify(
        claim=claim.to_dict(),
        assessment=ai.report,
        ai_result=ai.to_dict(),
        images=images,
        vehicle=vehicle,
        max_claim_amount=cap,
    )


@claims_bp.post("/<int:claim_id>/images")
@login_required
def upload_claim_images(claim_id):
    claim = db.session.get(Claim, claim_id)
    if not claim or claim.user_id != current_user().id:
        return jsonify(error="Claim not found"), 404

    files = request.files.getlist("images") or request.files.getlist("image")
    if not files:
        return jsonify(error="No images provided"), 400

    saved = []
    for f in files:
        if not f.filename or not allowed(f.filename, ALLOWED_IMAGE):
            continue
        record = save_upload(
            f, folder=f"claims/{claim.id}", category="damage_image",
            owner_id=current_user().id, claim_id=claim.id,
        )
        saved.append(file_payload(record))
    return jsonify(images=saved), 201


@claims_bp.post("/<int:claim_id>/analyze")
@login_required
def analyze_claim(claim_id):
    """Run AI /predict on primary damage image and store assessment report."""
    claim = db.session.get(Claim, claim_id)
    if not claim or claim.user_id != current_user().id:
        return jsonify(error="Claim not found"), 404

    damage_files = list(claim.images)
    if not damage_files:
        return jsonify(error="Upload damage images before analysis"), 400

    storage = get_storage()
    primary = damage_files[0]
    try:
        image_bytes = storage.read(primary.object_key)
    except Exception as exc:  # noqa: BLE001
        return jsonify(error=f"Could not read uploaded image: {exc}"), 400

    if not image_bytes:
        return jsonify(error="Invalid or empty image file"), 400

    market_value = _vehicle_claim_cap(claim.vehicle)

    try:
        predict_payload = predict_damage(image_bytes, primary.original_name or "damage.jpg")
    except requests.exceptions.Timeout:
        current_app.logger.exception("AI predict timed out for claim %s", claim_id)
        return jsonify(error="AI service timed out — please try again later"), 504
    except requests.exceptions.ConnectionError:
        current_app.logger.exception("AI predict connection failed for claim %s", claim_id)
        return jsonify(error="AI service unavailable — ensure the prediction API is running at http://127.0.0.1:8000/predict"), 503
    except Exception as exc:  # noqa: BLE001
        current_app.logger.exception("AI predict failed for claim %s", claim_id)
        return jsonify(error=f"AI prediction failed: {exc}"), 502

    if predict_payload.get("success") is True or predict_payload.get("damage_detection") is not None:
        current_app.logger.info(
            "AI success for claim %s — damage_detection=%s panel_detection=%s",
            claim_id,
            len(predict_payload.get("damage_detection") or []),
            len(predict_payload.get("panel_detection") or []),
        )
    else:
        current_app.logger.warning("AI response missing success flag for claim %s: %s", claim_id, predict_payload)

    try:
        image_meta = file_payload(primary)
        report = build_assessment_report(
            predict_payload,
            claim,
            vehicle_idv=market_value,
            image_meta=image_meta,
        )
    except Exception:
        current_app.logger.exception("Assessment report build failed for claim %s", claim_id)
        return jsonify(error="Failed to process AI assessment report"), 500

    summary = report.setdefault("summary", {})
    total = summary.get("total_repair_cost") or summary.get("total_estimated_cost") or 0
    final_amount = summary.get("final_claim_amount") or summary.get("recommended_claim_amount") or total

    estimated = _cap_amount(total, market_value)
    recommended = _cap_amount(final_amount, market_value)

    summary["total_repair_cost"] = estimated
    summary["total_estimated_cost"] = estimated
    summary["final_claim_amount"] = recommended
    summary["recommended_claim_amount"] = recommended  # legacy alias

    try:
        ai = AIResult(
            claim_id=claim.id,
            severity=report.get("severity"),
            severity_score=report.get("severity_score"),
            total_cost=estimated,
            valid=report.get("claim_valid", False),
            fraud_flag=report.get("fraud_flag", False),
            detections=report.get("line_items"),
            raw=predict_payload,
            report=report,
            claim_recommendation=summary.get("claim_decision") or summary.get("claim_recommendation"),
        )
        claim.estimated_cost = estimated
        claim.fraud_flag = report.get("fraud_flag", False)
        claim.status = "under_review"
        db.session.add(ai)
        db.session.commit()
    except Exception:
        current_app.logger.exception("Failed to persist AI result for claim %s", claim_id)
        db.session.rollback()
        return jsonify(error="Failed to save claim assessment"), 500

    note = (
        f"AI assessment complete — {summary.get('claim_decision') or summary.get('claim_recommendation')}, "
        f"estimated {_fmt_inr(estimated)}"
    )
    record_claim_event(claim.id, "under_review", note, current_user().id)
    log_action(current_user().id, "analyze_claim", "claim", claim.id)

    payload = claim.to_dict()
    if market_value:
        payload["max_claim_amount"] = market_value
    return jsonify(
        result=ai.to_dict(),
        assessment=report,
        claim=payload,
        progress={"stage": "complete", "percent": 100},
    )


@claims_bp.get("/<int:claim_id>/reports/damage.pdf")
@login_required
def damage_report_pdf(claim_id):
    claim = db.session.get(Claim, claim_id)
    if not claim or not _can_view_claim(claim):
        return jsonify(error="Not found"), 404
    ai = _latest_ai(claim)
    if not ai or not ai.report:
        return jsonify(error="Assessment not found"), 404
    pdf = generate_damage_report_pdf(claim.to_dict(), ai.report)
    return Response(
        pdf,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="damage-report-{claim.claim_number}.pdf"'},
    )


@claims_bp.get("/<int:claim_id>/reports/summary.pdf")
@login_required
def claim_summary_pdf(claim_id):
    claim = db.session.get(Claim, claim_id)
    if not claim or not _can_view_claim(claim):
        return jsonify(error="Not found"), 404
    ai = _latest_ai(claim)
    if not ai or not ai.report:
        return jsonify(error="Assessment not found"), 404
    pdf = generate_claim_summary_pdf(claim.to_dict(), ai.report)
    return Response(
        pdf,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="claim-summary-{claim.claim_number}.pdf"'},
    )


@claims_bp.post("/<int:claim_id>/request-inspection")
@login_required
def request_manual_inspection(claim_id):
    claim = db.session.get(Claim, claim_id)
    if not claim or claim.user_id != current_user().id:
        return jsonify(error="Claim not found"), 404
    claim.status = "under_review"
    db.session.commit()
    record_claim_event(
        claim.id,
        "under_review",
        "Policyholder requested manual inspection",
        current_user().id,
    )
    log_action(current_user().id, "request_inspection", "claim", claim.id)
    return jsonify(claim=claim.to_dict(), message="Manual inspection requested.")


def _fmt_inr(amount) -> str:
    if amount is None:
        return "₹0"
    return f"₹{float(amount):,.0f}"
