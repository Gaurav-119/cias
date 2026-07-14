from flask import Blueprint, current_app, jsonify, request

from ..auth.utils import current_user, login_required
from ..extensions import db
from ..models import Payment, Policy, Provider
from ..services.audit import log_action
from ..services.stripe_payments import (
    StripeNotConfiguredError,
    create_payment_intent,
    payment_method_label,
    retrieve_payment_intent,
)

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")

PLATFORM_FEE = 0
DISCOUNT = 0

COVERAGE_BY_TYPE = {
    "third_party": {
        "own_damage": False,
        "third_party": True,
        "personal_accident": True,
    },
    "comprehensive": {
        "own_damage": True,
        "third_party": True,
        "personal_accident": True,
    },
    "own_damage": {
        "own_damage": True,
        "third_party": False,
        "personal_accident": True,
    },
}

POLICY_LABELS = {
    "third_party": "Third Party (Liability Only)",
    "comprehensive": "Comprehensive",
    "own_damage": "Own Damage",
}


def _policy_for_user(policy_id: int) -> Policy | None:
    policy = db.session.get(Policy, policy_id)
    if not policy or policy.user_id != current_user().id:
        return None
    return policy


def _pricing_breakdown(policy: Policy) -> dict:
    base = float(policy.base_premium or 0)
    addons = float(policy.addon_premium or 0)
    gst = float(policy.gst or 0)
    total = float(policy.total_premium or 0)
    premium = round(base + addons, 2)
    return {
        "premium_amount": premium,
        "base_premium": base,
        "addon_premium": addons,
        "gst": gst,
        "platform_fee": PLATFORM_FEE,
        "discount": DISCOUNT,
        "total_payable": total,
    }


def _checkout_context(policy: Policy) -> dict:
    user = current_user()
    vehicle = policy.vehicle
    provider = policy.provider or (
        db.session.get(Provider, policy.provider_id) if policy.provider_id else None
    )
    coverage = COVERAGE_BY_TYPE.get(
        policy.policy_type or "comprehensive",
        COVERAGE_BY_TYPE["comprehensive"],
    )
    return {
        "policy": {
            **policy.to_dict(),
            "policy_type_label": POLICY_LABELS.get(
                policy.policy_type, policy.policy_type
            ),
        },
        "vehicle": vehicle.to_dict() if vehicle else None,
        "provider": provider.to_dict() if provider else None,
        "customer": {
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "address": ", ".join(
                filter(None, [user.address, user.city, user.state, user.pincode])
            ),
        },
        "coverage": coverage,
        "coverage_addons": policy.addons or [],
        "pricing": _pricing_breakdown(policy),
        "stripe_enabled": bool(
            current_app.config.get("PAYMENT_MODE") == "stripe"
            and current_app.config.get("STRIPE_SECRET_KEY")
        ),
    }


def _complete_payment(payment: Payment, intent=None) -> Policy:
    payment.status = "completed"
    if intent:
        is_dict = isinstance(intent, dict)
        intent_id = intent.get("id") if is_dict else intent.id
        payment.stripe_payment_intent_id = intent_id
        charge = intent.get("latest_charge") if is_dict else intent.get("latest_charge")
        if charge and not isinstance(charge, str):
            payment.stripe_transaction_id = charge.get("id")
        else:
            payment.stripe_transaction_id = intent_id
        if is_dict:
            pm = (intent.get("payment_method_types") or [None])[0]
            charge_obj = intent.get("charges", {}).get("data", [{}])[0] if intent.get("charges") else None
            if charge_obj:
                pm = (charge_obj.get("payment_method_details") or {}).get("type") or pm
            payment.payment_method = pm
        else:
            payment.payment_method = payment_method_label(intent)
        payment.transaction_ref = intent_id
    if payment.policy:
        payment.policy.status = "active"
    db.session.commit()
    log_action(
        payment.user_id,
        "payment_completed",
        "payment",
        payment.id,
        meta={"amount": float(payment.amount), "policy_id": payment.policy_id},
    )
    return payment.policy


@payments_bp.get("")
@login_required
def list_payments():
    payments = Payment.query.filter_by(user_id=current_user().id).order_by(
        Payment.created_at.desc()
    ).all()
    return jsonify(payments=[p.to_dict() for p in payments])


@payments_bp.get("/checkout/<int:policy_id>")
@login_required
def checkout_context(policy_id):
    policy = _policy_for_user(policy_id)
    if not policy:
        return jsonify(error="Policy not found"), 404
    if policy.status not in {"pending"}:
        return jsonify(error="This policy is not awaiting payment"), 400
    return jsonify(_checkout_context(policy))


@payments_bp.get("/<int:payment_id>")
@login_required
def get_payment(payment_id):
    payment = db.session.get(Payment, payment_id)
    if not payment or payment.user_id != current_user().id:
        return jsonify(error="Payment not found"), 404
    payload = payment.to_dict()
    if payment.policy:
        payload["policy"] = payment.policy.to_dict()
        payload["policy"]["provider_name"] = (
            payment.policy.provider.name if payment.policy.provider else None
        )
    payload["customer_name"] = current_user().full_name
    return jsonify(payment=payload)


@payments_bp.post("/create-intent")
@login_required
def create_intent():
    data = request.get_json(silent=True) or {}
    policy = _policy_for_user(data.get("policy_id"))
    if not policy:
        return jsonify(error="Policy not found"), 404
    if policy.status != "pending":
        return jsonify(error="Policy is not pending payment"), 400

    amount = float(policy.total_premium or 0)
    if amount <= 0:
        return jsonify(error="Invalid policy premium"), 400

    mode = current_app.config.get("PAYMENT_MODE", "record")
    if mode != "stripe":
        return jsonify(error="Stripe payments are not enabled"), 400

    try:
        payment = Payment(
            user_id=current_user().id,
            policy_id=policy.id,
            amount=amount,
            currency="INR",
            method="stripe",
            status="pending",
            description=f"Premium for {policy.policy_number or policy.id}",
        )
        db.session.add(payment)
        db.session.flush()

        intent = create_payment_intent(
            amount_inr=amount,
            policy_id=policy.id,
            user_id=current_user().id,
            payment_id=payment.id,
            policy_number=policy.policy_number,
        )
        payment.stripe_payment_intent_id = intent.id
        payment.transaction_ref = intent.id
        db.session.commit()

        return jsonify(
            client_secret=intent.client_secret,
            payment_id=payment.id,
            payment_intent_id=intent.id,
        )
    except StripeNotConfiguredError as exc:
        db.session.rollback()
        return jsonify(error=str(exc)), 503


@payments_bp.post("/confirm")
@login_required
def confirm_payment():
    data = request.get_json(silent=True) or {}
    payment_intent_id = data.get("payment_intent_id")
    payment_id = data.get("payment_id")

    payment = None
    if payment_id:
        payment = db.session.get(Payment, payment_id)
    elif payment_intent_id:
        payment = Payment.query.filter_by(
            stripe_payment_intent_id=payment_intent_id
        ).first()

    if not payment or payment.user_id != current_user().id:
        return jsonify(error="Payment not found"), 404

    if payment.status == "completed":
        return jsonify(
            payment=payment.to_dict(),
            policy=payment.policy.to_dict() if payment.policy else None,
            already_completed=True,
        )

    try:
        intent = retrieve_payment_intent(
            payment_intent_id or payment.stripe_payment_intent_id
        )
    except StripeNotConfiguredError as exc:
        return jsonify(error=str(exc)), 503
    except Exception as exc:  # noqa: BLE001
        payment.status = "failed"
        db.session.commit()
        return jsonify(error=f"Could not verify payment: {exc}"), 400

    if intent.status == "succeeded":
        policy = _complete_payment(payment, intent)
        return jsonify(payment=payment.to_dict(), policy=policy.to_dict() if policy else None)

    if intent.status in {"processing", "requires_capture"}:
        return jsonify(
            payment=payment.to_dict(),
            status=intent.status,
            message="Payment is still processing.",
        ), 202

    payment.status = "failed"
    db.session.commit()
    last_error = getattr(intent, "last_payment_error", None) or (
        intent.get("last_payment_error") if isinstance(intent, dict) else None
    )
    reason = (
        getattr(last_error, "message", None)
        or (last_error or {}).get("message")
        or "Payment failed"
    )
    return jsonify(error=reason, payment=payment.to_dict()), 402


@payments_bp.post("/checkout")
@login_required
def checkout():
    """Legacy record-only checkout (dev / offline mode)."""
    data = request.get_json(silent=True) or {}
    policy = _policy_for_user(data.get("policy_id"))
    if not policy:
        return jsonify(error="Policy not found"), 404

    amount = float(data.get("amount") or policy.total_premium or 0)
    mode = current_app.config.get("PAYMENT_MODE", "record")

    if mode == "stripe" and current_app.config.get("STRIPE_SECRET_KEY"):
        return jsonify(
            error="Use /api/payments/create-intent with Stripe Payment Element"
        ), 400

    payment = Payment(
        user_id=current_user().id,
        policy_id=policy.id,
        amount=amount,
        method="record",
        status="completed",
        transaction_ref=f"TEST-{policy.id}-{int(amount)}",
        stripe_transaction_id=f"TEST-{policy.id}-{int(amount)}",
        payment_method="record",
        description=f"Premium for {policy.policy_number}",
    )
    policy.status = "active"
    db.session.add(payment)
    db.session.commit()
    log_action(current_user().id, "payment", "payment", payment.id,
               meta={"amount": amount, "mode": mode})
    return jsonify(payment=payment.to_dict(), policy=policy.to_dict()), 201


@payments_bp.post("/stripe/webhook")
def stripe_webhook():
    import stripe

    payload = request.get_data()
    sig = request.headers.get("Stripe-Signature", "")
    secret = current_app.config.get("STRIPE_WEBHOOK_SECRET", "")
    if not secret:
        return jsonify(error="Webhook secret not configured"), 400
    try:
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except Exception as exc:  # noqa: BLE001
        return jsonify(error=str(exc)), 400

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        payment = Payment.query.filter_by(stripe_payment_intent_id=intent["id"]).first()
        if payment and payment.status != "completed":
            _complete_payment(payment, intent)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        payment = Payment.query.filter_by(transaction_ref=session["id"]).first()
        if payment and payment.status != "completed":
            payment.status = "completed"
            if payment.policy:
                payment.policy.status = "active"
            db.session.commit()

    return jsonify(received=True)
