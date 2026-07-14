import re

_INDIAN_MOBILE_LOCAL = re.compile(r"^[6-9]\d{9}$")


def normalize_indian_phone(value: str | None) -> str | None:
    if not value or not str(value).strip():
        return None
    raw = re.sub(r"[\s\-()]", "", str(value).strip())
    if raw.startswith("+91"):
        local = raw[3:]
    elif raw.startswith("91") and len(raw) == 12:
        local = raw[2:]
    elif raw.startswith("0") and len(raw) == 11:
        local = raw[1:]
    else:
        local = raw
    if not _INDIAN_MOBILE_LOCAL.match(local):
        return None
    return f"+91{local}"


def validate_indian_phone(value: str | None, *, required: bool = False) -> tuple[str | None, str | None]:
    if not value or not str(value).strip():
        if required:
            return None, "Phone number is required"
        return None, None
    normalized = normalize_indian_phone(value)
    if not normalized:
        return None, "Enter a valid 10-digit Indian mobile number (+91)"
    return normalized, None
