"""Seed roles/demo accounts and the insurance catalog.

Run once after the database is up:
    python seed.py
Idempotent: existing rows (matched by email/name) are skipped.
"""
from app import create_app
from app.extensions import db
from app.models import Addon, Pricing, Provider, Role, User, VehicleBasePrice, VehicleMaster
from scripts.ensure_kyc_columns import ensure_kyc_columns
from scripts.ensure_payment_columns import ensure_payment_columns
from scripts.ensure_role_enum import ensure_role_enum
from scripts.ensure_repair_master import ensure_repair_master_schema
from scripts.ensure_vehicle_master import ensure_vehicle_master
from scripts.generate_vehicle_catalog import OUT as CATALOG_CSV
from app.repositories.vehicle_master_repository import VehicleMasterRepository
from app.services.vehicle_master_service import validate_master_payload
import csv

DEMO_USERS = [
    ("Admin User", "admin@claimnova.com", "Admin@123", Role.admin),
    ("Agent User", "agent@claimnova.com", "Agent@123", Role.agent),
    ("Verifier User", "verifier@claimnova.com", "Verifier@123", Role.verifier),
    ("Surveyor User", "surveyor@claimnova.com", "Surveyor@123", Role.surveyor),
    ("Claims Manager", "claims@claimnova.com", "Claims@123", Role.claims_manager),
    ("Demo Customer", "user@claimnova.com", "User@123", Role.user),
]

PROVIDERS = [
    ("Nova General Insurance", "private"),
    ("Bharat Public Assurance", "public"),
    ("Shield Insure Co.", "private"),
]

ADDONS = [
    ("Zero Depreciation", 3500),
    ("Engine Protection", 2200),
    ("Roadside Assistance", 1200),
    ("Return to Invoice", 1800),
]

BASE_PRICES = [
    ("Toyota", "Camry", "Petrol", 3500000),
    ("Honda", "Civic", "Petrol", 1800000),
    ("Hyundai", "Tucson", "Diesel", 2900000),
    ("Tata", "Nexon", "Petrol", 1200000),
    ("Maruti", "Swift", "Petrol", 800000),
]


def run():
    app = create_app()
    with app.app_context():
        ensure_kyc_columns()
        ensure_payment_columns()
        ensure_vehicle_master()
        ensure_repair_master_schema()
        ensure_role_enum()
        for name, email, pwd, role in DEMO_USERS:
            if not User.query.filter_by(email=email).first():
                u = User(full_name=name, email=email, role=role)
                u.set_password(pwd)
                db.session.add(u)

        providers = {}
        for name, sector in PROVIDERS:
            p = Provider.query.filter_by(name=name).first()
            if not p:
                p = Provider(name=name, sector=sector)
                db.session.add(p)
                db.session.flush()
            providers[name] = p

        # Pricing per provider per policy type
        ranges = {
            "third_party": (3000, 6000),
            "comprehensive": (8000, 22000),
            "own_damage": (5000, 15000),
        }
        for prov in providers.values():
            for ptype, (lo, hi) in ranges.items():
                exists = Pricing.query.filter_by(
                    provider_id=prov.id, policy_type=ptype
                ).first()
                if not exists:
                    db.session.add(Pricing(
                        provider_id=prov.id, policy_type=ptype,
                        price_min=lo, price_max=hi,
                    ))

        for name, price in ADDONS:
            if not Addon.query.filter_by(name=name).first():
                db.session.add(Addon(name=name, price=price))

        for make, model, fuel, price in BASE_PRICES:
            if not VehicleBasePrice.query.filter_by(make=make, model=model).first():
                db.session.add(VehicleBasePrice(
                    make=make, model=model, fuel_type=fuel, base_price=price
                ))

        if VehicleMaster.query.count() == 0 and CATALOG_CSV.exists():
            repo = VehicleMasterRepository()
            with CATALOG_CSV.open(encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    payload, err = validate_master_payload(row)
                    if not err:
                        repo.upsert_identity(payload)
            print(f"Imported vehicle master catalogue from {CATALOG_CSV.name}")

        db.session.commit()
        print("Seed complete. Demo logins:")
        for name, email, pwd, role in DEMO_USERS:
            print(f"  {role.value:9} {email} / {pwd}")


if __name__ == "__main__":
    run()
