"""PDF generators for AI damage assessment and claim summary."""
from __future__ import annotations

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BRAND = colors.HexColor("#00C1D4")
NAVY = colors.HexColor("#002147")
INK = colors.HexColor("#1e293b")
LIGHT = colors.HexColor("#f1f5f9")


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Heading1"], textColor=NAVY, fontSize=16, spaceAfter=8),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], textColor=NAVY, fontSize=12, spaceAfter=6),
        "body": ParagraphStyle("body", parent=base["Normal"], textColor=INK, fontSize=9, leading=12),
    }


def _inr(value) -> str:
    if value is None:
        return "—"
    return f"₹{float(value):,.0f}"


def generate_damage_report_pdf(claim: dict, assessment: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm,
                            topMargin=14 * mm, bottomMargin=14 * mm)
    styles = _styles()
    story = [
        Paragraph("Claim Nova — AI Damage Assessment Report", styles["title"]),
        Paragraph(f"Claim: <b>{claim.get('claim_number', '')}</b>", styles["body"]),
        Spacer(1, 8),
    ]
    summary = assessment.get("summary") or {}
    meta = [
        ["Total Repair Cost", _inr(summary.get("total_repair_cost"))],
        ["Estimated IDV", _inr(summary.get("estimated_idv"))],
        ["Maximum Claim Eligible", _inr(summary.get("maximum_claim_eligible"))],
        ["Deductibles", _inr(summary.get("deductibles"))],
        ["Depreciation", _inr(summary.get("depreciation"))],
        ["Final Claim Amount", _inr(summary.get("final_claim_amount"))],
        ["Fraud Score", f"{summary.get('fraud_score', 0)} / 100"],
        ["Claim Decision", summary.get("claim_decision", "—")],
    ]
    t = Table(meta, colWidths=[80 * mm, 90 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story += [t, Spacer(1, 12), Paragraph("Damaged Parts", styles["h2"])]

    rows = [["Damaged Part", "Damage", "Severity", "Confidence", "Repair Cost"]]
    for item in assessment.get("line_items") or []:
        rows.append([
            item.get("panel", ""),
            item.get("damage") or item.get("damage_type", ""),
            item.get("severity", ""),
            f"{item.get('confidence', 0)}%",
            _inr(item.get("repair_cost") or item.get("estimated_cost")),
        ])
    table = Table(rows, repeatRows=1, colWidths=[38 * mm, 32 * mm, 24 * mm, 22 * mm, 28 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    story.append(table)
    doc.build(story)
    return buf.getvalue()


def generate_claim_summary_pdf(claim: dict, assessment: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm,
                            topMargin=14 * mm, bottomMargin=14 * mm)
    styles = _styles()
    summary = assessment.get("summary") or {}
    story = [
        Paragraph("Claim Nova — Claim Summary", styles["title"]),
        Paragraph(f"Claim Number: <b>{claim.get('claim_number', '')}</b>", styles["body"]),
        Paragraph(f"Status: <b>{claim.get('status', '')}</b>", styles["body"]),
        Paragraph(f"Damage Type: {claim.get('damage_type', '—')} | Cause: {claim.get('cause', '—')}", styles["body"]),
        Paragraph(f"Incident Date: {claim.get('incident_date', '—')}", styles["body"]),
        Spacer(1, 10),
        Paragraph(f"AI Severity: <b>{assessment.get('severity', '—')}</b>", styles["body"]),
        Paragraph(f"Recommended Amount: <b>{_inr(summary.get('recommended_claim_amount'))}</b>", styles["body"]),
        Paragraph(f"Recommendation: {summary.get('claim_recommendation', '—')}", styles["body"]),
    ]
    doc.build(story)
    return buf.getvalue()
