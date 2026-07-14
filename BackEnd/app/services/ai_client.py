"""Thin client to the FastAPI AI micro-service."""
from __future__ import annotations

import json

import requests
from flask import current_app


def _base() -> str:
    return current_app.config["AI_SERVICE_URL"].rstrip("/")


def _api_key() -> str:
    return current_app.config.get("AI_API_KEY", "claimnova_2026")


def _timeout() -> int:
    return int(current_app.config.get("AI_PREDICT_TIMEOUT", 120))


def predict_damage(image_bytes: bytes, filename: str = "damage.jpg") -> dict:
    """POST multipart file to /predict with API key header."""
    url = f"{_base()}/predict"
    headers = {"x-api-key": _api_key()}
    files = {"file": (filename, image_bytes, "image/jpeg")}

    current_app.logger.info(
        "AI predict request url=%s multipart_field=file x-api-key=***",
        url,
    )

    resp = requests.post(
        url,
        headers=headers,
        files=files,
        timeout=_timeout(),
    )

    current_app.logger.info(
        "AI predict response status=%s body=%s",
        resp.status_code,
        resp.text[:8000],
    )

    resp.raise_for_status()
    payload = resp.json()

    current_app.logger.info(
        "AI predict parsed payload=%s",
        json.dumps(payload, default=str)[:8000],
    )

    if payload.get("success") is False:
        raise RuntimeError(payload.get("error") or payload.get("detail") or "AI prediction failed")

    return payload


def analyze_damage(image_urls, registration_urls=None, market_value=None):
    """Legacy analyze-claim endpoint (kept for backward compatibility)."""
    payload = {
        "image_urls": image_urls,
        "registration_urls": registration_urls or [],
        "market_value": market_value,
    }
    resp = requests.post(f"{_base()}/analyze-claim", json=payload, timeout=_timeout())
    resp.raise_for_status()
    return resp.json()


def run_ocr(image_url):
    resp = requests.post(f"{_base()}/ocr", json={"image_url": image_url}, timeout=60)
    resp.raise_for_status()
    return resp.json()
