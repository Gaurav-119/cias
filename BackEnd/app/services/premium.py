"""Premium / IDV / policy-number logic.

Direct implementation of the blackbook Appendix-A mathematical model
(IRDAI-style depreciation slabs, IDV, scaled premium, GST split and the
CNPL-<alpha>-<beta> policy number generator).
"""
from __future__ import annotations

import hashlib
import math
from datetime import date

REFERENCE_PRICE = 900000.0  # B_ref in the blackbook
GST_RATE = 0.18


from .idv_service import depreciation_percentage, vehicle_age_months_from_rc


def vehicle_age_months(rc_date: date, today: date | None = None) -> int:
    return vehicle_age_months_from_rc(rc_date, today)


def depreciation_rate(months: int) -> float:
    return depreciation_percentage(months) / 100.0


def compute_idv(base_price: float, months: int) -> int:
    dep = depreciation_percentage(months)
    return int(math.floor(base_price * (1 - dep / 100.0)))


def idv_factor(idv: float) -> float:
    f = idv / REFERENCE_PRICE
    return max(0.7, min(1.6, f))


def base_policy_premium(price_min, price_max, policy_type, idv, tenure):
    mean = (float(price_min) + float(price_max)) / 2.0
    if policy_type == "third_party":
        scaled = mean
    else:
        scaled = mean * idv_factor(idv)
    return round(scaled * tenure)


def addon_premium(addon_prices, tenure):
    return round(tenure * sum(float(p) for p in addon_prices))


def gst_split(total: float):
    pre_gst = total / (1 + GST_RATE)
    return round(pre_gst, 2), round(total - pre_gst, 2)


def quote(base_price, price_min, price_max, policy_type, rc_date,
          tenure=1, addon_prices=None):
    addon_prices = addon_prices or []
    months = vehicle_age_months(rc_date) if rc_date else 0
    idv = compute_idv(float(base_price), months)
    base = base_policy_premium(price_min, price_max, policy_type, idv, tenure)
    addons = addon_premium(addon_prices, tenure)
    total = base + addons
    pre_gst, gst = gst_split(total)
    return {
        "idv": idv,
        "depreciation_rate": depreciation_rate(months),
        "vehicle_age_months": months,
        "base_premium": base,
        "addon_premium": addons,
        "total_premium": total,
        "pre_gst": pre_gst,
        "gst": gst,
    }


def generate_policy_number(policy_id: int, created_at) -> str:
    s = f"{policy_id}{created_at.isoformat()}"
    h = hashlib.sha1(s.encode()).hexdigest()
    alpha = h[:4].upper()
    beta = str(policy_id % 10000).zfill(4)
    return f"CNPL-{alpha}-{beta}"


def generate_claim_number(claim_id: int) -> str:
    return f"CNCL-{str(claim_id).zfill(6)}"
