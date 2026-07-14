"""Build AI damage assessment reports from /predict API output."""
from __future__ import annotations

from ..models import Claim, Policy, Vehicle
from ..repositories.repair_cost_repository import RepairCostRepository, get_claim_rules

REPO = RepairCostRepository()

PANEL_ALIASES = {
    "front bumper": "Front Bumper",
    "front_bumper": "Front Bumper",
    "rear bumper": "Rear Bumper",
    "rear_bumper": "Rear Bumper",
    "hood": "Hood",
    "bonnet": "Hood",
    "scratch_bonnet": "Hood",
    "fender": "Fender",
    "front fender": "Fender",
    "door": "Door",
    "windscreen": "Windshield",
    "windshield": "Windshield",
    "window": "Window",
    "headlight": "Left Headlight",
    "left headlight": "Left Headlight",
    "right headlight": "Right Headlight",
    "taillight": "Taillight",
    "trunk": "Trunk",
    "side_mirror": "Side Mirror",
    "panel_damage": "Vehicle Panel",
    "tire": "Tire",
}

DAMAGE_ALIASES = {
    "scratch": "Scratch",
    "dent": "Dent",
    "crack": "Crack",
    "glass shatter": "Glass Shatter",
    "shatter": "Glass Shatter",
    "lamp broken": "Lamp Broken",
    "broken": "Lamp Broken",
    "headlight": "Lamp Broken",
    "tire flat": "Tire Flat",
    "flat": "Tire Flat",
}


def _norm_panel(name: str) -> str:
    key = (name or "vehicle panel").strip().lower()
    return PANEL_ALIASES.get(key, name.strip().title() if name else "Vehicle Panel")


def _norm_damage(name: str) -> str:
    key = (name or "damage").strip().lower().replace("_", " ")
    return DAMAGE_ALIASES.get(key, key.title())


def _bbox_area(bbox: list) -> float:
    if not bbox or len(bbox) < 4:
        return 0.0
    x1, y1, x2, y2 = [float(v) for v in bbox[:4]]
    return max(0.0, x2 - x1) * max(0.0, y2 - y1)


def _intersection_area(a: list, b: list) -> float:
    if not a or not b:
        return 0.0
    ax1, ay1, ax2, ay2 = [float(v) for v in a[:4]]
    bx1, by1, bx2, by2 = [float(v) for v in b[:4]]
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0
    return (ix2 - ix1) * (iy2 - iy1)


def _severity_from_confidence(confidence: float, total_damages: int, panel_damage_count: int) -> str:
    """User-defined severity bands."""
    if confidence > 0.95 and (total_damages > 1 or panel_damage_count > 1):
        return "Severe"
    if confidence >= 0.80:
        return "Moderate"
    if confidence >= 0.60:
        return "Minor"
    return "Inspection Required"


def _match_panel(damage_bbox: list, panels: list[dict]) -> dict | None:
    best, best_iou = None, 0.0
    d_area = _bbox_area(damage_bbox) or 1.0
    for panel in panels:
        inter = _intersection_area(damage_bbox, panel.get("bbox", []))
        p_area = _bbox_area(panel.get("bbox", [])) or 1.0
        iou = inter / max(d_area, p_area)
        if iou > best_iou:
            best_iou = iou
            best = panel
    return best


def _resolve_policy(claim: Claim) -> Policy | None:
    if claim.policy_id:
        policy = Policy.query.get(claim.policy_id)
        if policy:
            return policy
    if claim.vehicle_id:
        return (
            Policy.query.filter_by(
                user_id=claim.user_id, vehicle_id=claim.vehicle_id, status="active"
            )
            .order_by(Policy.created_at.desc())
            .first()
        )
    return None


def _vehicle_context(vehicle: Vehicle | None) -> dict:
    if not vehicle:
        return {}
    return {
        "brand": vehicle.make,
        "model": vehicle.model,
        "variant": vehicle.variant,
        "registration_number": vehicle.license_plate,
        "manufacturing_year": vehicle.year,
        "idv": float(vehicle.calculated_idv or vehicle.max_claim_amount or vehicle.market_value or 0) or None,
        "depreciation_percentage": float(vehicle.depreciation_percentage or 0) if vehicle.depreciation_percentage else None,
        "depreciation_amount": float(vehicle.depreciation_amount or 0) if vehicle.depreciation_amount else None,
        "ex_showroom_price": float(vehicle.ex_showroom_price or 0) if vehicle.ex_showroom_price else None,
    }


def _fraud_score(mean_conf: float, total_cost: float, line_count: int) -> int:
    base = max(0, min(100, int(round((1.0 - mean_conf) * 70))))
    if total_cost > 50000 and mean_conf < 0.55:
        base += 20
    if line_count == 0:
        base += 15
    return min(100, base)


def _claim_decision(
    *,
    line_items: list,
    mean_conf: float,
    fraud_score: int,
    final_amount: float,
    max_eligible: float | None,
) -> str:
    if not line_items:
        return "Needs Manual Inspection"
    if any(item["severity"] == "Inspection Required" for item in line_items):
        return "Needs Manual Inspection"
    if fraud_score >= 70:
        return "Rejected"
    if max_eligible and final_amount > max_eligible:
        return "Rejected"
    if mean_conf < 0.60 or fraud_score >= 45:
        return "Needs Manual Inspection"
    return "Approved"


def build_assessment_report(
    predict_payload: dict,
    claim: Claim,
    *,
    vehicle_idv: float | None,
    image_meta: dict | None = None,
) -> dict:
    rules = get_claim_rules()
    vehicle = claim.vehicle
    vctx = _vehicle_context(vehicle)
    policy = _resolve_policy(claim)

    damages = predict_payload.get("damage_detection") or []
    panels = predict_payload.get("panel_detection") or []
    total_damages = len(damages)

    panel_counts: dict[str, int] = {}
    line_items = []
    confidences = []
    total_repair = 0.0

    brand = vctx.get("brand")
    model = vctx.get("model")

    for dmg in damages:
        damage_type = _norm_damage(dmg.get("damage", "damage"))
        damage_key = damage_type.lower()
        confidence = float(dmg.get("confidence", 0))
        confidences.append(confidence)
        bbox = dmg.get("bbox") or [0, 0, 0, 0]
        mask = dmg.get("mask") or dmg.get("segmentation")

        panel_hit = _match_panel(bbox, panels)
        panel_name = _norm_panel(panel_hit.get("panel") if panel_hit else "Vehicle Panel")
        panel_bbox = panel_hit.get("bbox") if panel_hit else bbox
        panel_counts[panel_name] = panel_counts.get(panel_name, 0) + 1

        severity = _severity_from_confidence(
            confidence, total_damages, panel_counts[panel_name]
        )

        cost_row = REPO.lookup_cost(
            panel_name, damage_key, severity, brand=brand, model=model
        )
        if not cost_row and severity == "Inspection Required":
            cost_row = REPO.lookup_cost(
                panel_name, damage_key, "Moderate", brand=brand, model=model
            )

        if cost_row:
            repair_cost = round((float(cost_row.min_cost) + float(cost_row.max_cost)) / 2.0)
        else:
            repair_cost = 0

        total_repair += repair_cost

        line_items.append({
            "panel": panel_name,
            "damage": damage_type,
            "damage_type": damage_type,
            "severity": severity,
            "confidence": round(confidence * 100, 1),
            "repair_cost": repair_cost,
            "estimated_cost": repair_cost,
            "damage_bbox": bbox,
            "panel_bbox": panel_bbox,
            "mask": mask,
        })

    mean_conf = sum(confidences) / len(confidences) if confidences else 0.0
    idv = vehicle_idv or vctx.get("idv")
    max_eligible = float(idv) if idv else None

    depreciation = vctx.get("depreciation_amount")
    if depreciation is None and vctx.get("ex_showroom_price") and vctx.get("depreciation_percentage"):
        depreciation = round(
            float(vctx["ex_showroom_price"]) * float(vctx["depreciation_percentage"]) / 100.0
        )

    deductible_pct = float(getattr(rules, "deductible_percentage", 0.02) or 0.02)
    deductibles = round(total_repair * deductible_pct)
    final_claim = max(0.0, total_repair - deductibles)
    if max_eligible:
        final_claim = min(final_claim, max_eligible)

    fraud_score = _fraud_score(mean_conf, total_repair, len(line_items))
    decision = _claim_decision(
        line_items=line_items,
        mean_conf=mean_conf,
        fraud_score=fraud_score,
        final_amount=final_claim,
        max_eligible=max_eligible,
    )

    detected_panels = sorted({p.get("panel", "") for p in panels if p.get("panel")})
    detected_panels = [_norm_panel(p) for p in detected_panels]
    detected_damages = sorted({item["damage"] for item in line_items})

    return {
        "line_items": line_items,
        "detected_panels": detected_panels,
        "detected_damages": detected_damages,
        "vehicle": vctx,
        "policy_number": policy.policy_number if policy else None,
        "summary": {
            "total_repair_cost": round(total_repair),
            "total_estimated_cost": round(total_repair),
            "estimated_idv": idv,
            "vehicle_idv": idv,
            "maximum_claim_eligible": max_eligible,
            "deductibles": deductibles,
            "depreciation": depreciation,
            "final_claim_amount": round(final_claim),
            "fraud_score": fraud_score,
            "claim_decision": decision,
            "policy_coverage_status": "Covered — Active Policy" if policy and policy.status == "active" else "Review Required",
            "claim_recommendation": decision,
        },
        "severity": "severe" if any(i["severity"] == "Severe" for i in line_items) else "moderate",
        "severity_score": round(mean_conf, 3),
        "claim_valid": decision == "Approved",
        "fraud_flag": fraud_score >= 70,
        "image": image_meta or {},
        "ai_raw": predict_payload,
    }
