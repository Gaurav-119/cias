"""Policy certificate PDF generation (reportlab)."""
from __future__ import annotations

from .policy_document import build_policy_schedule_data
from .policy_pdf_generator import generate_policy_schedule_pdf


def build_policy_certificate(data: dict) -> bytes:
    """Generate IRDAI-style policy schedule PDF bytes."""
    return generate_policy_schedule_pdf(data)


def build_policy_certificate_for_policy(policy) -> bytes:
    """Build schedule data from a Policy model and generate PDF."""
    return generate_policy_schedule_pdf(build_policy_schedule_data(policy))
