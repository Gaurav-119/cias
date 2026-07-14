"""Startup diagnostics and external-service health probes."""
from __future__ import annotations

from urllib.parse import urlparse

import requests
from flask import Flask


def _database_host(database_url: str) -> str:
    if database_url.startswith("sqlite"):
        return "sqlite (local file)"
    normalized = database_url.replace("postgresql+psycopg2://", "postgresql://")
    parsed = urlparse(normalized)
    return parsed.hostname or "unknown"


def _database_label(database_url: str) -> str:
    return "SQLite" if database_url.startswith("sqlite") else "PostgreSQL"


def log_startup_configuration(app: Flask, storage_provider: str) -> None:
    db_url = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    storage_path = app.config.get("LOCAL_STORAGE_DIR", "./storage")
    banner = (
        "\n---\n\n"
        "## Claim Nova Startup Configuration\n\n"
        f"Storage Provider: {storage_provider}\n"
        f"Database: {_database_label(db_url)}\n"
        f"Database URL: {_database_host(db_url)}\n"
        f"Storage Path: {storage_path}\n"
        "-----------------------"
    )
    print(banner)
    app.logger.info(banner.strip())


def check_ai_service(app: Flask) -> None:
    base = app.config.get("AI_SERVICE_URL", "").rstrip("/")
    if not base:
        app.logger.warning("AI service URL not configured; AI features disabled until service is up")
        return
    try:
        resp = requests.get(f"{base}/health", timeout=3)
        resp.raise_for_status()
        app.logger.info("AI service reachable at %s", base)
    except Exception as exc:  # noqa: BLE001
        app.logger.warning(
            "AI service unavailable at %s (%s). API will start; AI routes may fail until it is running.",
            base,
            exc,
        )
