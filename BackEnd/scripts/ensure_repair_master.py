"""Idempotent schema bootstrap for repair cost master tables."""
from sqlalchemy import inspect, text

from app.extensions import db
from app.models import ClaimRulesConfig, RepairCostMaster


def ensure_repair_master_schema() -> None:
    db.create_all()
    inspector = inspect(db.engine)
    if inspector.has_table("repair_cost_master"):
        columns = {c["name"] for c in inspector.get_columns("repair_cost_master")}
        for col, typedef in {
            "vehicle_brand": "VARCHAR(80) DEFAULT '*'",
            "vehicle_model": "VARCHAR(80) DEFAULT '*'",
        }.items():
            if col not in columns:
                db.session.execute(text(f"ALTER TABLE repair_cost_master ADD COLUMN {col} {typedef}"))
        db.session.commit()

    if inspector.has_table("claim_rules_config"):
        cols = {c["name"] for c in inspector.get_columns("claim_rules_config")}
        if "deductible_percentage" not in cols:
            db.session.execute(text(
                "ALTER TABLE claim_rules_config ADD COLUMN deductible_percentage FLOAT DEFAULT 0.02"
            ))
            db.session.commit()

    if not inspector.has_table("ai_results"):
        return
    columns = {c["name"] for c in inspector.get_columns("ai_results")}
    for col, typedef in {
        "report": "JSON",
        "claim_recommendation": "VARCHAR(80)",
    }.items():
        if col not in columns:
            db.session.execute(text(f"ALTER TABLE ai_results ADD COLUMN {col} {typedef}"))
    db.session.commit()

    if ClaimRulesConfig.query.count() == 0:
        db.session.add(ClaimRulesConfig())
        db.session.commit()

    if RepairCostMaster.query.count() == 0:
        _seed_defaults()


def _seed_defaults() -> None:
    defaults = [
        ("*", "*", "Front Bumper", "scratch", "Minor", 2500, 4500),
        ("*", "*", "Front Bumper", "scratch", "Moderate", 4500, 8000),
        ("*", "*", "Front Bumper", "scratch", "Severe", 8000, 15000),
        ("*", "*", "Front Bumper", "dent", "Moderate", 6000, 12000),
        ("*", "*", "Front Bumper", "dent", "Severe", 12000, 22000),
        ("*", "*", "Hood", "scratch", "Minor", 3000, 6000),
        ("*", "*", "Hood", "dent", "Moderate", 9000, 14000),
        ("*", "*", "Hood", "dent", "Severe", 14000, 25000),
        ("*", "*", "Fender", "dent", "Moderate", 5000, 10000),
        ("*", "*", "Left Headlight", "lamp broken", "Severe", 15000, 22000),
        ("*", "*", "Left Headlight", "broken", "Severe", 15000, 22000),
        ("*", "*", "Windshield", "crack", "Moderate", 8000, 15000),
        ("*", "*", "Windshield", "glass shatter", "Severe", 15000, 22000),
        ("*", "*", "Door", "dent", "Moderate", 7000, 14000),
        ("*", "*", "Tire", "tire flat", "Moderate", 4000, 8000),
        ("*", "*", "General", "general", "Minor", 2000, 4000),
        ("*", "*", "General", "general", "Moderate", 4000, 8000),
        ("*", "*", "General", "general", "Severe", 8000, 15000),
    ]
    for brand, model, panel, dmg, sev, lo, hi in defaults:
        db.session.add(
            RepairCostMaster(
                vehicle_brand=brand,
                vehicle_model=model,
                panel_name=panel,
                damage_type=dmg,
                severity=sev,
                min_cost=lo,
                max_cost=hi,
                is_active=True,
            )
        )
    db.session.commit()
