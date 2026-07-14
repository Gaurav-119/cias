"""IDV calculation per IRDAI-style depreciation slabs."""
from __future__ import annotations

import math
from datetime import date

from ..extensions import db
from ..models import DepreciationConfig


def vehicle_age_months_from_year(manufacturing_year: int, today: date | None = None) -> int:
    today = today or date.today()
    start = date(int(manufacturing_year), 1, 1)
    return max(12 * (today.year - start.year) + (today.month - start.month), 0)


def vehicle_age_months_from_rc(rc_date: date, today: date | None = None) -> int:
    today = today or date.today()
    months = 12 * (today.year - rc_date.year) + (today.month - rc_date.month)
    if today.day < rc_date.day:
        months -= 1
    return max(months, 0)


def _get_over_10_config() -> DepreciationConfig:
    row = DepreciationConfig.query.first()
    if not row:
        row = DepreciationConfig()
        db.session.add(row)
        db.session.commit()
    return row


def depreciation_percentage(age_months: int) -> float:
    if age_months < 6:
        return 5.0
    if age_months < 12:
        return 15.0
    if age_months < 24:
        return 20.0
    if age_months < 36:
        return 30.0
    if age_months < 48:
        return 40.0
    if age_months < 60:
        return 50.0
    if age_months < 120:
        return 60.0
    cfg = _get_over_10_config()
    applied = float(cfg.over_10_years_applied_pct or 50)
    lo = float(cfg.over_10_years_min_pct or 40)
    hi = float(cfg.over_10_years_max_pct or 50)
    return max(lo, min(hi, applied))


def calculate_idv(
    ex_showroom_price: float,
    *,
    manufacturing_year: int | None = None,
    rc_date: date | None = None,
    accessory_value: float = 0.0,
    accessory_depreciation_pct: float | None = None,
) -> dict:
    """
    IDV = (Ex Showroom − Depreciation) + Accessory Value − Accessory Depreciation
    """
    price = float(ex_showroom_price or 0)
    accessories = max(float(accessory_value or 0), 0.0)

    if rc_date:
        age_months = vehicle_age_months_from_rc(rc_date)
    elif manufacturing_year:
        age_months = vehicle_age_months_from_year(manufacturing_year)
    else:
        age_months = 0

    dep_pct = depreciation_percentage(age_months)
    acc_dep_pct = accessory_depreciation_pct if accessory_depreciation_pct is not None else dep_pct

    depreciation_amount = round(price * dep_pct / 100, 2)
    accessory_depreciation = round(accessories * acc_dep_pct / 100, 2)
    vehicle_idv_component = price - depreciation_amount
    final_idv = int(math.floor(vehicle_idv_component + accessories - accessory_depreciation))

    vehicle_age_years = round(age_months / 12, 2)

    return {
        "vehicle_age_months": age_months,
        "vehicle_age_years": vehicle_age_years,
        "depreciation_percentage": dep_pct,
        "depreciation_amount": depreciation_amount,
        "accessory_value": accessories,
        "accessory_depreciation": accessory_depreciation,
        "ex_showroom_price": price,
        "final_idv": max(final_idv, 0),
        "max_claim_amount": max(final_idv, 0),
    }
