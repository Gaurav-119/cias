"""Storage abstraction package.

Application code only ever talks to ``storage_service``. Swapping between
Local disk, MinIO or AWS S3 is a pure configuration change (STORAGE_PROVIDER),
never a code change. Binaries are never stored in PostgreSQL - only the
returned object key / metadata is persisted.
"""
from __future__ import annotations

from flask import Flask

from .local_provider import LocalStorageProvider
from .storage_service import StorageService, get_storage

_service: StorageService | None = None


def init_storage(app: Flask) -> StorageService:
    global _service
    requested = (app.config.get("STORAGE_PROVIDER") or "local").lower().strip()

    try:
        _service = StorageService.from_config(app.config)
        app.logger.info("Storage provider active: %s", _service.provider_name)
    except Exception as exc:  # noqa: BLE001
        app.logger.warning(
            "Storage init failed for provider %r: %s. Falling back to local disk.",
            requested,
            exc,
        )
        fallback = LocalStorageProvider(
            bucket=app.config["STORAGE_BUCKET"],
            base_dir=app.config["LOCAL_STORAGE_DIR"],
        )
        _service = StorageService(fallback)

    app.extensions["storage"] = _service
    return _service


__all__ = ["StorageService", "get_storage", "init_storage"]
