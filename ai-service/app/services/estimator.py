"""Claim severity + cost estimation (blackbook section 3.2).

Maps per-part damage to a severity class, a part-wise repair estimate, a
composite image-level severity score and a capped final claim amount.
"""
from __future__ import annotations

# Tabulated per-part repair cost range (INR) - extend as needed.
PART_COST = {
    "windscreen": (8000, 18000),
    "window": (4000, 9000),
    "trunk": (10000, 25000),
    "rear_bumper": (8000, 20000),
    "front_bumper": (8000, 20000),
    "side_mirror": (2000, 6000),
    "taillight": (2500, 7000),
    "headlight": (3000, 9000),
    "signlight": (1500, 4000),
    "scratch_bonnet": (5000, 15000),
    "door": (9000, 22000),
    "fender": (6000, 16000),
    "rear": (12000, 30000),
}
DEFAULT_COST = (4000, 12000)

SEVERITY_MULTIPLIER = {
    "very_minor": 0.2,
    "minor": 0.4,
    "moderate": 0.7,
    "severe": 1.0,
}


def severity_from_ratio(ratio: float) -> str:
    if ratio < 0.05:
        return "very_minor"
    if ratio < 0.15:
        return "minor"
    if ratio < 0.35:
        return "moderate"
    return "severe"


def part_estimate(part: str, ratio: float, confidence: float) -> float:
    lo, hi = PART_COST.get(part, DEFAULT_COST)
    sev = severity_from_ratio(ratio)
    mult = SEVERITY_MULTIPLIER[sev]
    return ((lo + hi) / 2.0) * mult * confidence


def composite_severity(avg_mask_pct: float, mean_conf: float, n: int) -> float:
    fd = min(1.0, avg_mask_pct / 50.0)
    fc = mean_conf
    fn = min(1.0, n / 5.0)
    return min(1.0, 0.5 * fd + 0.3 * fc + 0.2 * fn)


def aggregate(detections: list[dict], market_value: float | None):
    """detections: [{type, confidence, ratio}] -> assessment dict."""
    if not detections:
        return {
            "severity": "none",
            "severity_score": 0.0,
            "total_repair_cost": 0.0,
            "claim_valid": False,
            "detections": [],
        }

    enriched = []
    raw_total = 0.0
    for d in detections:
        ratio = float(d.get("ratio", 0.0))
        conf = float(d.get("confidence", 0.0))
        est = part_estimate(d.get("type", "unknown"), ratio, conf)
        raw_total += est
        enriched.append({
            **d,
            "severity": severity_from_ratio(ratio),
            "estimated_cost": round(est),
        })

    n = len(detections)
    mean_conf = sum(float(d.get("confidence", 0)) for d in detections) / n
    avg_mask_pct = sum(float(d.get("ratio", 0)) for d in detections) / n * 100
    score = composite_severity(avg_mask_pct, mean_conf, n)

    if score < 0.2:
        label = "minor"
    elif score < 0.5:
        label = "moderate"
    elif score < 0.8:
        label = "major"
    else:
        label = "severe"

    # Cap at 60% of insured value (blackbook 5.3).
    total = raw_total
    if market_value:
        total = min(total, 0.6 * float(market_value))

    return {
        "severity": label,
        "severity_score": round(score, 3),
        "total_repair_cost": round(total),
        "claim_valid": score > 0.3,
        "detections": enriched,
    }
