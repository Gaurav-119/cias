from flask import Blueprint, jsonify, request

from ..auth.utils import current_user, roles_required
from ..extensions import db
from ..models import Addon, Payment, Policy, Pricing, Provider, VehicleBasePrice
from ..services.audit import log_action

agent_bp = Blueprint("agent", __name__, url_prefix="/api/agent")


@agent_bp.get("/stats")
@roles_required("agent", "admin")
def stats():
    monthly_revenue = sum(
        float(payment.amount or 0)
        for payment in Payment.query.filter_by(status="completed").all()
    )
    return jsonify(stats={
        "providers": Provider.query.count(),
        "pricing_rules": Pricing.query.count(),
        "addons": Addon.query.count(),
        "base_prices": VehicleBasePrice.query.count(),
        "policies": Policy.query.count(),
        "monthly_revenue": monthly_revenue,
    })


# ---- Providers ---------------------------------------------------------
@agent_bp.get("/providers")
@roles_required("agent", "admin")
def list_providers():
    return jsonify(providers=[p.to_dict() for p in Provider.query.all()])


@agent_bp.post("/providers")
@roles_required("agent", "admin")
def create_provider():
    data = request.get_json(silent=True) or {}
    provider = Provider(name=data.get("name"), sector=data.get("sector"),
                        active=data.get("active", True))
    db.session.add(provider)
    db.session.commit()
    log_action(current_user().id, "agent_create_provider", "provider", provider.id)
    return jsonify(provider=provider.to_dict()), 201


@agent_bp.put("/providers/<int:provider_id>")
@roles_required("agent", "admin")
def update_provider(provider_id):
    provider = db.session.get(Provider, provider_id)
    if not provider:
        return jsonify(error="Provider not found"), 404
    data = request.get_json(silent=True) or {}
    for field in ["name", "sector", "active"]:
        if field in data:
            setattr(provider, field, data[field])
    db.session.commit()
    return jsonify(provider=provider.to_dict())


@agent_bp.delete("/providers/<int:provider_id>")
@roles_required("agent", "admin")
def delete_provider(provider_id):
    provider = db.session.get(Provider, provider_id)
    if not provider:
        return jsonify(error="Provider not found"), 404
    db.session.delete(provider)
    db.session.commit()
    return jsonify(message="Provider deleted")


# ---- Pricing -----------------------------------------------------------
@agent_bp.get("/pricing")
@roles_required("agent", "admin")
def list_pricing():
    return jsonify(pricing=[p.to_dict() for p in Pricing.query.all()])


@agent_bp.post("/pricing")
@roles_required("agent", "admin")
def create_pricing():
    data = request.get_json(silent=True) or {}
    pricing = Pricing(
        provider_id=data.get("provider_id"),
        policy_type=data.get("policy_type"),
        price_min=data.get("price_min"),
        price_max=data.get("price_max"),
    )
    db.session.add(pricing)
    db.session.commit()
    return jsonify(pricing=pricing.to_dict()), 201


@agent_bp.put("/pricing/<int:pricing_id>")
@roles_required("agent", "admin")
def update_pricing(pricing_id):
    pricing = db.session.get(Pricing, pricing_id)
    if not pricing:
        return jsonify(error="Pricing not found"), 404
    data = request.get_json(silent=True) or {}
    for field in ["policy_type", "price_min", "price_max", "provider_id"]:
        if field in data:
            setattr(pricing, field, data[field])
    db.session.commit()
    return jsonify(pricing=pricing.to_dict())


@agent_bp.delete("/pricing/<int:pricing_id>")
@roles_required("agent", "admin")
def delete_pricing(pricing_id):
    pricing = db.session.get(Pricing, pricing_id)
    if not pricing:
        return jsonify(error="Pricing not found"), 404
    db.session.delete(pricing)
    db.session.commit()
    return jsonify(message="Pricing deleted")


# ---- Add-ons -----------------------------------------------------------
@agent_bp.get("/addons")
@roles_required("agent", "admin")
def list_addons():
    return jsonify(addons=[a.to_dict() for a in Addon.query.all()])


@agent_bp.post("/addons")
@roles_required("agent", "admin")
def create_addon():
    data = request.get_json(silent=True) or {}
    addon = Addon(name=data.get("name"), price=data.get("price"),
                  active=data.get("active", True))
    db.session.add(addon)
    db.session.commit()
    return jsonify(addon=addon.to_dict()), 201


@agent_bp.put("/addons/<int:addon_id>")
@roles_required("agent", "admin")
def update_addon(addon_id):
    addon = db.session.get(Addon, addon_id)
    if not addon:
        return jsonify(error="Addon not found"), 404
    data = request.get_json(silent=True) or {}
    for field in ["name", "price", "active"]:
        if field in data:
            setattr(addon, field, data[field])
    db.session.commit()
    return jsonify(addon=addon.to_dict())


@agent_bp.delete("/addons/<int:addon_id>")
@roles_required("agent", "admin")
def delete_addon(addon_id):
    addon = db.session.get(Addon, addon_id)
    if not addon:
        return jsonify(error="Addon not found"), 404
    db.session.delete(addon)
    db.session.commit()
    return jsonify(message="Addon deleted")


# ---- Vehicle base prices ----------------------------------------------
@agent_bp.get("/base-prices")
@roles_required("agent", "admin")
def list_base_prices():
    return jsonify(base_prices=[b.to_dict() for b in VehicleBasePrice.query.all()])


@agent_bp.post("/base-prices")
@roles_required("agent", "admin")
def create_base_price():
    data = request.get_json(silent=True) or {}
    bp = VehicleBasePrice(
        make=data.get("make"), model=data.get("model"), variant=data.get("variant"),
        fuel_type=data.get("fuel_type"), transmission=data.get("transmission"),
        base_price=data.get("base_price"),
    )
    db.session.add(bp)
    db.session.commit()
    return jsonify(base_price=bp.to_dict()), 201


@agent_bp.put("/base-prices/<int:bp_id>")
@roles_required("agent", "admin")
def update_base_price(bp_id):
    bp = db.session.get(VehicleBasePrice, bp_id)
    if not bp:
        return jsonify(error="Base price not found"), 404
    data = request.get_json(silent=True) or {}
    for field in ["make", "model", "variant", "fuel_type", "transmission",
                  "base_price"]:
        if field in data:
            setattr(bp, field, data[field])
    db.session.commit()
    return jsonify(base_price=bp.to_dict())


@agent_bp.delete("/base-prices/<int:bp_id>")
@roles_required("agent", "admin")
def delete_base_price(bp_id):
    bp = db.session.get(VehicleBasePrice, bp_id)
    if not bp:
        return jsonify(error="Base price not found"), 404
    db.session.delete(bp)
    db.session.commit()
    return jsonify(message="Base price deleted")
