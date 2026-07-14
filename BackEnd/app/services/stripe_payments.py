"""Stripe PaymentIntent helpers for insurance premium checkout."""
from __future__ import annotations

from flask import current_app

import stripe


class StripeNotConfiguredError(RuntimeError):
    pass


def _require_stripe():
    secret = current_app.config.get("STRIPE_SECRET_KEY", "")
    if not secret:
        raise StripeNotConfiguredError("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = secret
    return stripe


def create_payment_intent(
    *,
    amount_inr: float,
    policy_id: int,
    user_id: int,
    payment_id: int,
    policy_number: str | None,
):
    client = _require_stripe()
    return client.PaymentIntent.create(
        amount=int(round(amount_inr * 100)),
        currency="inr",
        automatic_payment_methods={"enabled": True},
        description=f"Claim Nova policy premium — {policy_number or policy_id}",
        metadata={
            "policy_id": str(policy_id),
            "user_id": str(user_id),
            "payment_id": str(payment_id),
        },
    )


def retrieve_payment_intent(payment_intent_id: str):
    client = _require_stripe()
    return client.PaymentIntent.retrieve(payment_intent_id, expand=["latest_charge"])


def payment_method_label(intent) -> str | None:
    if not intent:
        return None
    pm_types = intent.get("payment_method_types") or []
    if intent.get("payment_method"):
        return str(intent["payment_method"])
    if pm_types:
        return pm_types[0]
    charge = intent.get("latest_charge")
    if charge and not isinstance(charge, str):
        details = charge.get("payment_method_details") or {}
        return details.get("type")
    return None
