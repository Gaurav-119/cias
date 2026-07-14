"""Data access layer for Vehicle Master catalogue."""
from __future__ import annotations

from sqlalchemy import distinct, func, or_

from ..extensions import db
from ..models import VehicleMaster


class VehicleMasterRepository:
    def base_query(self, *, active_only: bool = True):
        q = VehicleMaster.query
        if active_only:
            q = q.filter_by(is_active=True)
        return q

    def get_by_id(self, record_id: int, *, active_only: bool = False) -> VehicleMaster | None:
        q = VehicleMaster.query.filter_by(id=record_id)
        if active_only:
            q = q.filter_by(is_active=True)
        return q.first()

    def list_brands(self) -> list[str]:
        rows = (
            self.base_query()
            .with_entities(distinct(VehicleMaster.brand))
            .order_by(VehicleMaster.brand)
            .all()
        )
        return [r[0] for r in rows]

    def list_brand_options(self) -> list[dict]:
        """Stable brand id = MIN(vehicle_master.id) per brand group."""
        rows = (
            self.base_query()
            .with_entities(
                func.min(VehicleMaster.id).label("id"),
                VehicleMaster.brand.label("name"),
            )
            .group_by(VehicleMaster.brand)
            .order_by(VehicleMaster.brand)
            .all()
        )
        return [{"id": int(r.id), "name": r.name} for r in rows]

    def resolve_brand_name(self, brand_id: int) -> str | None:
        row = self.get_by_id(brand_id, active_only=True)
        return row.brand if row else None

    def list_model_options(self, brand_id: int) -> list[dict]:
        brand_name = self.resolve_brand_name(brand_id)
        if not brand_name:
            return []
        rows = (
            self.base_query()
            .filter(VehicleMaster.brand == brand_name)
            .with_entities(
                func.min(VehicleMaster.id).label("id"),
                VehicleMaster.model.label("name"),
            )
            .group_by(VehicleMaster.model)
            .order_by(VehicleMaster.model)
            .all()
        )
        return [{"id": int(r.id), "name": r.name} for r in rows]

    def model_belongs_to_brand(self, brand_id: int, model_id: int) -> bool:
        brand_name = self.resolve_brand_name(brand_id)
        model_row = self.get_by_id(model_id, active_only=True)
        if not brand_name or not model_row:
            return False
        return model_row.brand == brand_name

    def resolve_model_name(self, model_id: int) -> str | None:
        row = self.get_by_id(model_id, active_only=True)
        return row.model if row else None

    def list_models(self, brand: str) -> list[str]:
        rows = (
            self.base_query()
            .filter(VehicleMaster.brand == brand)
            .with_entities(distinct(VehicleMaster.model))
            .order_by(VehicleMaster.model)
            .all()
        )
        return [r[0] for r in rows]

    def list_fuel_types(self, brand: str, model: str) -> list[str]:
        rows = (
            self.base_query()
            .filter_by(brand=brand, model=model)
            .with_entities(distinct(VehicleMaster.fuel_type))
            .order_by(VehicleMaster.fuel_type)
            .all()
        )
        return [r[0] for r in rows]

    def list_transmissions(self, brand: str, model: str, fuel_type: str) -> list[str]:
        rows = (
            self.base_query()
            .filter_by(brand=brand, model=model, fuel_type=fuel_type)
            .with_entities(distinct(VehicleMaster.transmission))
            .order_by(VehicleMaster.transmission)
            .all()
        )
        return [r[0] for r in rows]

    def list_variants(
        self,
        brand: str,
        model: str,
        fuel_type: str | None = None,
        transmission: str | None = None,
    ) -> list[VehicleMaster]:
        q = self.base_query().filter_by(brand=brand, model=model)
        if fuel_type:
            q = q.filter_by(fuel_type=fuel_type)
        if transmission:
            q = q.filter_by(transmission=transmission)
        return q.order_by(VehicleMaster.variant, VehicleMaster.ex_showroom_price).all()

    def search(
        self,
        *,
        q: str | None = None,
        brand: str | None = None,
        model: str | None = None,
        fuel_type: str | None = None,
        is_active: bool | None = None,
        page: int = 1,
        per_page: int = 25,
    ) -> tuple[list[VehicleMaster], int]:
        query = VehicleMaster.query
        if is_active is not None:
            query = query.filter_by(is_active=is_active)
        if brand:
            query = query.filter(VehicleMaster.brand.ilike(brand))
        if model:
            query = query.filter(VehicleMaster.model.ilike(model))
        if fuel_type:
            query = query.filter(VehicleMaster.fuel_type.ilike(fuel_type))
        if q:
            like = f"%{q.strip()}%"
            query = query.filter(
                or_(
                    VehicleMaster.brand.ilike(like),
                    VehicleMaster.model.ilike(like),
                    VehicleMaster.variant.ilike(like),
                )
            )
        total = query.count()
        items = (
            query.order_by(VehicleMaster.brand, VehicleMaster.model, VehicleMaster.variant)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def create(self, data: dict) -> VehicleMaster:
        row = VehicleMaster(**data)
        db.session.add(row)
        db.session.flush()
        return row

    def update(self, row: VehicleMaster, data: dict) -> VehicleMaster:
        for key, value in data.items():
            if hasattr(row, key):
                setattr(row, key, value)
        db.session.flush()
        return row

    def upsert_identity(self, data: dict) -> tuple[VehicleMaster, bool]:
        existing = VehicleMaster.query.filter_by(
            brand=data["brand"],
            model=data["model"],
            variant=data["variant"],
            fuel_type=data["fuel_type"],
            transmission=data["transmission"],
        ).first()
        if existing:
            self.update(existing, data)
            return existing, False
        return self.create(data), True

    def deactivate(self, row: VehicleMaster) -> None:
        row.is_active = False
        db.session.flush()
