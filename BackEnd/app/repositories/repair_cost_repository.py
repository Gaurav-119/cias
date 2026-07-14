"""Data access for repair cost master and claim rules."""
from __future__ import annotations

from ..extensions import db
from ..models import ClaimRulesConfig, RepairCostMaster

ANY = "*"


class RepairCostRepository:
    def list_active(self) -> list[RepairCostMaster]:
        return (
            RepairCostMaster.query.filter_by(is_active=True)
            .order_by(RepairCostMaster.vehicle_brand, RepairCostMaster.panel_name)
            .all()
        )

    def search(
        self,
        *,
        q: str | None = None,
        page: int = 1,
        per_page: int = 50,
    ) -> tuple[list[RepairCostMaster], int]:
        query = RepairCostMaster.query
        if q:
            like = f"%{q.strip()}%"
            query = query.filter(
                db.or_(
                    RepairCostMaster.panel_name.ilike(like),
                    RepairCostMaster.damage_type.ilike(like),
                    RepairCostMaster.vehicle_brand.ilike(like),
                    RepairCostMaster.vehicle_model.ilike(like),
                )
            )
        total = query.count()
        rows = (
            query.order_by(
                RepairCostMaster.vehicle_brand,
                RepairCostMaster.vehicle_model,
                RepairCostMaster.panel_name,
            )
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return rows, total

    def get_by_id(self, record_id: int) -> RepairCostMaster | None:
        return db.session.get(RepairCostMaster, record_id)

    def lookup_cost(
        self,
        panel_name: str,
        damage_type: str,
        severity: str,
        *,
        brand: str | None = None,
        model: str | None = None,
    ) -> RepairCostMaster | None:
        brand_key = (brand or ANY).strip() or ANY
        model_key = (model or ANY).strip() or ANY
        damage_key = damage_type.strip().lower()

        attempts = [
            (brand_key, model_key),
            (brand_key, ANY),
            (ANY, ANY),
        ]
        for b, m in attempts:
            row = RepairCostMaster.query.filter_by(
                vehicle_brand=b,
                vehicle_model=m,
                panel_name=panel_name,
                damage_type=damage_key,
                severity=severity,
                is_active=True,
            ).first()
            if row:
                return row
            row = RepairCostMaster.query.filter_by(
                vehicle_brand=b,
                vehicle_model=m,
                panel_name=panel_name,
                damage_type="general",
                severity=severity,
                is_active=True,
            ).first()
            if row:
                return row

        return RepairCostMaster.query.filter_by(
            vehicle_brand=ANY,
            vehicle_model=ANY,
            panel_name="General",
            damage_type=damage_key,
            severity=severity,
            is_active=True,
        ).first()

    def upsert(self, data: dict) -> RepairCostMaster:
        data = {
            **data,
            "vehicle_brand": data.get("vehicle_brand") or ANY,
            "vehicle_model": data.get("vehicle_model") or ANY,
        }
        row = RepairCostMaster.query.filter_by(
            vehicle_brand=data["vehicle_brand"],
            vehicle_model=data["vehicle_model"],
            panel_name=data["panel_name"],
            damage_type=data["damage_type"],
            severity=data["severity"],
        ).first()
        if row:
            for key in ("min_cost", "max_cost", "is_active"):
                if key in data:
                    setattr(row, key, data[key])
            return row
        row = RepairCostMaster(**data)
        db.session.add(row)
        return row


def get_claim_rules() -> ClaimRulesConfig:
    row = ClaimRulesConfig.query.first()
    if not row:
        row = ClaimRulesConfig()
        db.session.add(row)
        db.session.commit()
    return row
