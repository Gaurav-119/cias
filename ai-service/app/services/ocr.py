"""OCR service. Uses EasyOCR when available, else returns empty text.

Includes a light Indian-plate heuristic to surface a likely registration
number from the recognised tokens.
"""
from __future__ import annotations

import re

import cv2
import numpy as np

_reader = None
PLATE_RE = re.compile(r"[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{1,4}")


def _get_reader():
    global _reader
    if _reader is None:
        try:
            import easyocr

            _reader = easyocr.Reader(["en"], gpu=False)
        except Exception:
            _reader = False  # mark unavailable
    return _reader


def read_text(image: np.ndarray) -> dict:
    reader = _get_reader()
    if not reader:
        return {"text": "", "fields": {}, "engine": "unavailable"}

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = reader.readtext(rgb)
    tokens = [r[1] for r in results]
    text = " ".join(tokens)

    plate = None
    upper = text.upper().replace("  ", " ")
    m = PLATE_RE.search(upper.replace(" ", ""))
    if m:
        plate = m.group(0)

    return {"text": text, "fields": {"plate": plate}, "engine": "easyocr"}
