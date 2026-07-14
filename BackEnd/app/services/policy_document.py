"""Assemble IRDAI-style policy schedule data from database models."""
from __future__ import annotations

from datetime import date

from ..models import Payment, Policy
from . import premium as prem

COMPANY = {
    "name": "Claim Nova Insurance",
    "address": "ADYPSOE Campus, Charholi Budruk, Pune, Maharashtra — 410105",
    "email": "support@claimnova.com",
    "website": "www.claimnova.com",
    "phone": "+91 1800-266-0000",
    "emergency_claim": "+91 1800-266-0001",
    "irdai_note": "Claim Nova Insurance is a demonstration platform for motor insurance workflows.",
}

POLICY_TYPE_LABELS = {
    "third_party": "Third Party (Liability Only)",
    "comprehensive": "Comprehensive Package Policy",
    "own_damage": "Standalone Own Damage",
}

ADDON_KEYWORDS = {
    "zero_depreciation": ("zero dep", "zero depreciation"),
    "roadside_assistance": ("roadside", "rsa"),
    "engine_protection": ("engine",),
    "consumables": ("consumable",),
    "key_protect": ("key",),
    "passenger_cover": ("passenger", "pa cover"),
}


def _fmt_date(value) -> str:
    if not value:
        return "—"
    if isinstance(value, str):
        try:
            value = date.fromisoformat(value[:10])
        except ValueError:
            return value
    return value.strftime("%d-%b-%Y")


def _fmt_inr(amount) -> str:
    if amount is None:
        return "—"
    return f"₹{float(amount):,.2f}"


def _vehicle_age_label(vehicle) -> str:
    if not vehicle or not vehicle.year:
        return "—"
    years = date.today().year - int(vehicle.year)
    return f"{max(years, 0)} year(s)"


def _addon_flags(addons: list) -> dict:
    names = " ".join(
        (a.get("name", "") if isinstance(a, dict) else str(a)).lower()
        for a in (addons or [])
    )
    flags = {key: False for key in ADDON_KEYWORDS}
    for key, keywords in ADDON_KEYWORDS.items():
        flags[key] = any(k in names for k in keywords)
    return flags


def _premium_split(policy_type: str, base: float) -> tuple[float, float]:
    base = float(base or 0)
    if policy_type == "third_party":
        return 0.0, base
    if policy_type == "own_damage":
        return base, 0.0
    return round(base * 0.62, 2), round(base * 0.38, 2)


def _latest_payment(policy_id: int) -> Payment | None:
    return (
        Payment.query.filter_by(policy_id=policy_id)
        .order_by(Payment.created_at.desc())
        .first()
    )


def _payment_status_label(status: str | None) -> str:
    mapping = {
        "completed": "SUCCESS",
        "pending": "PENDING",
        "failed": "FAILED",
    }
    return mapping.get((status or "").lower(), (status or "—").upper())


def build_policy_schedule_data(policy: Policy) -> dict:
    vehicle = policy.vehicle
    owner = policy.owner
    provider = policy.provider
    payment = _latest_payment(policy.id)
    addons = policy.addons or []
    addon_flags = _addon_flags(addons)

    base = float(policy.base_premium or 0)
    od_premium, tp_premium = _premium_split(policy.policy_type or "comprehensive", base)
    addon_total = float(policy.addon_premium or 0)
    gst = float(policy.gst or 0)
    total = float(policy.total_premium or 0)
    discount = 0.0

    vehicle_age_months = (
        prem.vehicle_age_months(vehicle.rc_date) if vehicle and vehicle.rc_date else 0
    )
    ncb = "0%" if vehicle_age_months < 12 else "20%"

    holder_city = owner.city if owner else None
    rto = holder_city or (owner.state if owner else "—")

    qr_payload = "|".join(filter(None, [
        policy.policy_number or str(policy.id),
        owner.full_name if owner else "",
        vehicle.license_plate if vehicle else "",
        policy.end_date.isoformat() if policy.end_date else "",
    ]))

    return {
        "company": COMPANY,
        "header": {
            "title": "POLICY CERTIFICATE CUM POLICY SCHEDULE",
            "policy_number": policy.policy_number or f"CNPL-{policy.id:04d}",
            "proposal_number": f"PROP-{policy.id:06d}",
            "issue_date": _fmt_date(policy.created_at.date() if policy.created_at else date.today()),
            "effective_date": _fmt_date(policy.start_date),
            "expiry_date": _fmt_date(policy.end_date),
            "status": (policy.status or "pending").upper(),
        },
        "holder": {
            "name": owner.full_name if owner else "—",
            "dob": _fmt_date(owner.date_of_birth) if owner else "—",
            "gender": "—",
            "mobile": owner.phone or "—",
            "email": owner.email if owner else "—",
            "address": owner.address or "—",
            "city": owner.city or "—",
            "state": owner.state or "—",
            "pincode": owner.pincode or "—",
        },
        "vehicle": {
            "registration": vehicle.license_plate if vehicle else "—",
            "manufacturer": vehicle.make if vehicle else "—",
            "model": vehicle.model if vehicle else "—",
            "variant": vehicle.variant if vehicle and vehicle.variant else (vehicle.model if vehicle else "—"),
            "fuel_type": vehicle.fuel_type or "—",
            "transmission": vehicle.transmission if vehicle and vehicle.transmission else "—",
            "category": "Private Car",
            "engine_number": (
                f"ENG-{vehicle.chassis_number[-6:]}"
                if vehicle and vehicle.chassis_number and len(vehicle.chassis_number) >= 6
                else "As per Registration Certificate"
            ),
            "chassis_number": vehicle.chassis_number if vehicle else "—",
            "year": str(vehicle.year) if vehicle and vehicle.year else "—",
            "color": vehicle.color or "—",
            "rto_location": rto,
            "age": _vehicle_age_label(vehicle),
            "ex_showroom_price": _fmt_inr(vehicle.ex_showroom_price) if vehicle and vehicle.ex_showroom_price else "—",
            "ex_showroom_price_raw": float(vehicle.ex_showroom_price) if vehicle and vehicle.ex_showroom_price else None,
            "depreciation_percentage": (
                f"{float(vehicle.depreciation_percentage):.0f}%"
                if vehicle and vehicle.depreciation_percentage is not None else "—"
            ),
            "depreciation_amount": _fmt_inr(vehicle.depreciation_amount) if vehicle and vehicle.depreciation_amount else "—",
            "idv": _fmt_inr(policy.idv or (vehicle.calculated_idv if vehicle else None)),
            "idv_raw": float(policy.idv or (vehicle.calculated_idv if vehicle else 0) or 0) or None,
            "max_claim_amount": _fmt_inr(vehicle.max_claim_amount if vehicle else policy.idv),
            "max_claim_amount_raw": float(vehicle.max_claim_amount or policy.idv or 0) or None,
        },
        "insurance": {
            "company": provider.name if provider else "Claim Nova Partner",
            "policy_type": POLICY_TYPE_LABELS.get(
                policy.policy_type, policy.policy_type or "—"
            ),
            "policy_type_code": policy.policy_type,
            "coverage_start": _fmt_date(policy.start_date),
            "coverage_end": _fmt_date(policy.end_date),
            "tenure_years": policy.tenure_years or 1,
            "ncb": ncb,
            "deductible": _fmt_inr(1000),
            "zero_depreciation": "Yes" if addon_flags["zero_depreciation"] else "No",
            "roadside_assistance": "Yes" if addon_flags["roadside_assistance"] else "No",
            "engine_protection": "Yes" if addon_flags["engine_protection"] else "No",
            "consumables_cover": "Yes" if addon_flags["consumables"] else "No",
            "key_protect": "Yes" if addon_flags["key_protect"] else "No",
            "passenger_cover": "Yes" if addon_flags["passenger_cover"] else "No",
            "addons": addons,
        },
        "premium": {
            "basic_premium": _fmt_inr(base),
            "own_damage_premium": _fmt_inr(od_premium),
            "third_party_premium": _fmt_inr(tp_premium),
            "addon_premium": _fmt_inr(addon_total),
            "roadside_assistance": _fmt_inr(
                next((a.get("price") for a in addons if isinstance(a, dict)
                      and "roadside" in a.get("name", "").lower()), 0)
            ) if addon_flags["roadside_assistance"] else _fmt_inr(0),
            "gst": _fmt_inr(gst),
            "discount": _fmt_inr(discount),
            "final_premium": _fmt_inr(total - gst),
            "grand_total": _fmt_inr(total),
            "rows": [
                ("Basic Premium", _fmt_inr(base)),
                ("Own Damage Premium", _fmt_inr(od_premium)),
                ("Third Party Premium", _fmt_inr(tp_premium)),
                ("Add-on Premium", _fmt_inr(addon_total)),
                ("GST (18%)", _fmt_inr(gst)),
                ("Discount", _fmt_inr(discount)),
                ("Grand Total", _fmt_inr(total)),
            ],
        },
        "coverage_table": _coverage_rows(policy.policy_type, addon_flags, policy.idv),
        "payment": {
            "transaction_id": (
                payment.stripe_transaction_id or payment.transaction_ref if payment else "—"
            ),
            "stripe_payment_id": payment.stripe_payment_intent_id if payment else "—",
            "payment_date": _fmt_date(
                payment.created_at.date() if payment and payment.created_at else None
            ),
            "payment_method": (payment.payment_method or payment.method if payment else "—"),
            "amount_paid": _fmt_inr(payment.amount if payment else policy.total_premium),
            "status": _payment_status_label(payment.status if payment else policy.status),
        },
        "nominee": {
            "name": owner.full_name if owner else "—",
            "relationship": "Self / Policyholder",
            "contact": owner.phone or "—",
        },
        "claim_process": [
            "Login to your Claim Nova customer portal.",
            "Navigate to Submit Claim and select the insured vehicle.",
            "Upload accident / damage photographs from multiple angles.",
            "Submit supporting documents (FIR, RC, DL, repair estimates).",
            "AI-assisted damage assessment evaluates the claim.",
            "Surveyor / verifier reviews evidence via video or desk audit.",
            "Claim approval decision is communicated digitally.",
            "Settlement is processed to your registered bank account.",
        ],
        "terms": [
            "This policy is subject to the terms, conditions and exclusions of the Indian Motor Tariff.",
            "Any misrepresentation or concealment of material facts may void the policy ab initio.",
            "Claims must be reported within 48 hours of the incident unless prevented by force majeure.",
            "Coverage is valid only for the vehicle and usage declared in this schedule.",
            "The insurer reserves the right to inspect the vehicle before claim settlement.",
            "Fraudulent claims will be rejected and may attract legal action under applicable law.",
            "Policy cancellation refunds are governed by IRDAI guidelines and company policy.",
            "Geographical scope: India unless otherwise endorsed.",
        ],
        "qr_payload": qr_payload,
        # Legacy keys for backward compatibility
        "policy_number": policy.policy_number,
        "status": policy.status,
        "holder_name": owner.full_name if owner else "—",
        "holder_email": owner.email if owner else "—",
        "holder_phone": owner.phone or "—",
        "holder_address": ", ".join(filter(None, [
            owner.address, owner.city, owner.state, owner.pincode
        ])) if owner else "—",
        "provider_name": provider.name if provider else "Claim Nova",
        "vehicle": f"{vehicle.make} {vehicle.model}" if vehicle else "—",
        "license_plate": vehicle.license_plate if vehicle else "—",
        "vehicle_meta": (
            f"{vehicle.fuel_type or '-'} / {vehicle.year or '-'}" if vehicle else "—"
        ),
        "policy_type": policy.policy_type,
        "tenure_years": policy.tenure_years,
        "start_date": policy.start_date.isoformat() if policy.start_date else None,
        "end_date": policy.end_date.isoformat() if policy.end_date else None,
        "idv": float(policy.idv) if policy.idv else None,
        "base_premium": float(policy.base_premium) if policy.base_premium else None,
        "addon_premium": float(policy.addon_premium) if policy.addon_premium else None,
        "gst": float(policy.gst) if policy.gst else None,
        "total_premium": float(policy.total_premium) if policy.total_premium else None,
        "addons": addons,
    }


def _coverage_rows(policy_type: str | None, addon_flags: dict, idv) -> list[dict]:
    idv_limit = _fmt_inr(idv)
    tp_limit = "Unlimited (Statutory)"
    pa_limit = "₹15,00,000"

    def included(flag: bool) -> str:
        return "Covered" if flag else "Not Covered"

    od = policy_type in {"comprehensive", "own_damage"}
    tp = policy_type in {"comprehensive", "third_party"}

    rows = [
        {"item": "Own Damage", "limit": idv_limit if od else "—", "status": included(od)},
        {"item": "Third Party Liability", "limit": tp_limit if tp else "—", "status": included(tp)},
        {"item": "Personal Accident Cover", "limit": pa_limit, "status": "Covered"},
        {
            "item": "Roadside Assistance",
            "limit": "As per add-on",
            "status": included(addon_flags["roadside_assistance"]),
        },
        {
            "item": "Engine Protection",
            "limit": "As per add-on",
            "status": included(addon_flags["engine_protection"]),
        },
        {
            "item": "Consumables",
            "limit": "As per add-on",
            "status": included(addon_flags["consumables"]),
        },
        {
            "item": "Zero Depreciation",
            "limit": "As per add-on",
            "status": included(addon_flags["zero_depreciation"]),
        },
    ]
    return rows
