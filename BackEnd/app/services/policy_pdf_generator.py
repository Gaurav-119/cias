"""IRDAI-style motor insurance policy schedule PDF generator."""
from __future__ import annotations

import io
from typing import Any

import qrcode
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

BRAND = colors.HexColor("#00A6B5")
NAVY = colors.HexColor("#002147")
INK = colors.HexColor("#1e293b")
SLATE = colors.HexColor("#64748b")
LIGHT = colors.HexColor("#f1f5f9")
BORDER = colors.HexColor("#cbd5e1")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 16 * mm


class PolicyPDFGenerator:
    """Generate multi-page A4 policy schedule PDFs."""

    def generate(self, data: dict[str, Any]) -> bytes:
        buf = io.BytesIO()
        doc = BaseDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=14 * mm,
            bottomMargin=18 * mm,
            title=f"Policy Schedule — {data.get('header', {}).get('policy_number', '')}",
            author="Claim Nova Insurance",
        )
        frame = Frame(
            MARGIN, 22 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 40 * mm, id="main"
        )
        template = PageTemplate(id="policy", frames=[frame], onPage=self._draw_page)
        doc.addPageTemplates([template])
        doc._company = data.get("company", {})

        styles = self._styles()
        story: list = []

        story.extend(self._build_header_block(data, styles))
        story.append(Spacer(1, 4 * mm))
        story.extend(self._section("1. POLICY HEADER", self._header_table(data), styles))
        story.extend(self._section("2. POLICY HOLDER DETAILS", self._holder_table(data), styles))
        story.extend(self._section("3. VEHICLE DETAILS", self._vehicle_table(data), styles))
        story.extend(self._section("4. INSURANCE DETAILS", self._insurance_table(data), styles))
        story.extend(self._section("5. PREMIUM BREAKDOWN", self._premium_table(data), styles))
        story.extend(self._section("6. COVERAGE TABLE", self._coverage_table(data), styles))
        story.extend(self._section("7. PAYMENT DETAILS", self._payment_table(data), styles))
        story.extend(self._section("8. NOMINEE DETAILS", self._nominee_table(data), styles))

        story.append(PageBreak())
        story.extend(self._section("9. CLAIM PROCESS", self._claim_process(data, styles), styles))
        story.extend(self._section("10. TERMS & CONDITIONS", self._terms_block(data, styles), styles))
        story.extend(self._verification_block(data, styles))

        doc.build(story)
        return buf.getvalue()

    def _styles(self):
        base = getSampleStyleSheet()
        return {
            "title": ParagraphStyle(
                "title", parent=base["Heading1"], fontSize=14, textColor=NAVY,
                spaceAfter=4, alignment=TA_CENTER, fontName="Helvetica-Bold",
            ),
            "subtitle": ParagraphStyle(
                "subtitle", parent=base["Normal"], fontSize=9, textColor=SLATE,
                alignment=TA_CENTER, spaceAfter=6,
            ),
            "section": ParagraphStyle(
                "section", parent=base["Heading2"], fontSize=10, textColor=WHITE,
                backColor=NAVY, leftIndent=4, spaceBefore=6, spaceAfter=4,
                fontName="Helvetica-Bold",
            ),
            "body": ParagraphStyle(
                "body", parent=base["Normal"], fontSize=8.5, textColor=INK,
                leading=11, alignment=TA_LEFT,
            ),
            "small": ParagraphStyle(
                "small", parent=base["Normal"], fontSize=7.5, textColor=SLATE,
                leading=10,
            ),
            "footer": ParagraphStyle(
                "footer", parent=base["Normal"], fontSize=7, textColor=SLATE,
                alignment=TA_CENTER,
            ),
        }

    def _draw_page(self, canvas, doc):
        canvas.saveState()
        self._watermark(canvas)
        company = getattr(doc, "_company", {})
        canvas.setFillColor(NAVY)
        canvas.rect(0, PAGE_H - 24 * mm, PAGE_W, 24 * mm, fill=1, stroke=0)
        canvas.setFillColor(WHITE)
        canvas.setFont("Helvetica-Bold", 13)
        canvas.drawString(MARGIN, PAGE_H - 11 * mm, company.get("name", "Claim Nova Insurance"))
        canvas.setFillColor(BRAND)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(MARGIN, PAGE_H - 16 * mm, "Motor Insurance Policy Schedule")
        canvas.setFillColor(WHITE)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 11 * mm, company.get("website", ""))
        canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 16 * mm, company.get("email", ""))

        canvas.setFillColor(SLATE)
        canvas.setFont("Helvetica", 7)
        canvas.drawCentredString(
            PAGE_W / 2, 10 * mm,
            f"Page {canvas.getPageNumber()}  |  {company.get('name', 'Claim Nova Insurance')}  |  "
            f"Support: {company.get('phone', '')}",
        )
        canvas.setFont("Helvetica-Oblique", 6.5)
        canvas.drawCentredString(
            PAGE_W / 2, 6 * mm,
            "Digitally generated policy document — physical signature not required.",
        )
        canvas.restoreState()

    def _watermark(self, canvas):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor("#e2e8f0"))
        canvas.setFont("Helvetica-Bold", 46)
        canvas.translate(PAGE_W / 2, PAGE_H / 2)
        canvas.rotate(45)
        canvas.drawCentredString(0, 0, "CLAIM NOVA")
        canvas.restoreState()

    def _build_header_block(self, data, styles):
        header = data.get("header", {})
        company = data.get("company", {})
        qr_img = self._qr_image(data.get("qr_payload", ""), 22 * mm)

        status = header.get("status", "PENDING")
        status_color = {
            "ACTIVE": colors.HexColor("#16a34a"),
            "EXPIRED": colors.HexColor("#dc2626"),
            "PENDING": colors.HexColor("#d97706"),
        }.get(status, SLATE)

        left = [
            [Paragraph(f"<b>{company.get('name', '')}</b>", styles["body"])],
            [Paragraph(company.get("address", ""), styles["small"])],
            [Paragraph(
                f"Support: {company.get('phone', '')} | Emergency Claims: "
                f"{company.get('emergency_claim', '')}",
                styles["small"],
            )],
        ]
        right = [[qr_img], [Paragraph("Scan to verify policy", styles["small"])]]

        top = Table(
            [[Table(left, colWidths=[110 * mm]), Table(right, colWidths=[28 * mm])]],
            colWidths=[118 * mm, 34 * mm],
        )
        top.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ]))

        title = Paragraph(header.get("title", "POLICY CERTIFICATE CUM POLICY SCHEDULE"), styles["title"])
        badge = Table(
            [[Paragraph(f"<b>STATUS: {status}</b>", ParagraphStyle(
                "st", fontSize=9, textColor=WHITE, alignment=TA_CENTER,
            ))]],
            colWidths=[40 * mm],
        )
        badge.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), status_color),
            ("BOX", (0, 0), (-1, -1), 0.5, status_color),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))

        row = Table([[title, badge]], colWidths=[112 * mm, 40 * mm])
        row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ]))

        return [top, Spacer(1, 3 * mm), row, Spacer(1, 2 * mm)]

    def _section(self, title, content, styles):
        block = [Paragraph(title, styles["section"])]
        if isinstance(content, list):
            block.extend(content)
        else:
            block.append(content)
        return block

    def _kv_table(self, rows: list[tuple[str, str]], col_widths=None) -> Table:
        col_widths = col_widths or [52 * mm, 100 * mm]
        table = Table([[k, v] for k, v in rows], colWidths=col_widths, hAlign="LEFT")
        table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica"),
            ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 0), (0, -1), SLATE),
            ("TEXTCOLOR", (1, 0), (1, -1), INK),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("BACKGROUND", (0, 0), (0, -1), LIGHT),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ]))
        return table

    def _header_table(self, data):
        h = data.get("header", {})
        return self._kv_table([
            ("Policy Number", h.get("policy_number", "—")),
            ("Proposal Number", h.get("proposal_number", "—")),
            ("Issue Date", h.get("issue_date", "—")),
            ("Policy Effective Date", h.get("effective_date", "—")),
            ("Policy Expiry Date", h.get("expiry_date", "—")),
            ("Policy Status", h.get("status", "—")),
        ])

    def _holder_table(self, data):
        h = data.get("holder", {})
        return self._kv_table([
            ("Customer Name", h.get("name", "—")),
            ("Date of Birth", h.get("dob", "—")),
            ("Gender", h.get("gender", "—")),
            ("Mobile Number", h.get("mobile", "—")),
            ("Email", h.get("email", "—")),
            ("Address", h.get("address", "—")),
            ("City", h.get("city", "—")),
            ("State", h.get("state", "—")),
            ("PIN Code", h.get("pincode", "—")),
        ])

    def _vehicle_table(self, data):
        v = data.get("vehicle", {})
        return self._kv_table([
            ("Registration Number", v.get("registration", "—")),
            ("Manufacturer", v.get("manufacturer", "—")),
            ("Model", v.get("model", "—")),
            ("Variant", v.get("variant", "—")),
            ("Fuel Type", v.get("fuel_type", "—")),
            ("Vehicle Category", v.get("category", "—")),
            ("Engine Number", v.get("engine_number", "—")),
            ("Chassis Number", v.get("chassis_number", "—")),
            ("Manufacturing Year", v.get("year", "—")),
            ("Color", v.get("color", "—")),
            ("RTO Location", v.get("rto_location", "—")),
            ("Vehicle Age", v.get("age", "—")),
            ("Ex-Showroom Price", v.get("ex_showroom_price", "—")),
            ("Depreciation", v.get("depreciation_percentage", "—")),
            ("Depreciation Amount", v.get("depreciation_amount", "—")),
            ("Insured Declared Value (IDV)", v.get("idv", "—")),
            ("Maximum Claim Amount", v.get("max_claim_amount", "—")),
            ("Transmission", v.get("transmission", "—")),
        ])

    def _insurance_table(self, data):
        ins = data.get("insurance", {})
        return self._kv_table([
            ("Insurance Company", ins.get("company", "—")),
            ("Policy Type", ins.get("policy_type", "—")),
            ("Coverage Start", ins.get("coverage_start", "—")),
            ("Coverage End", ins.get("coverage_end", "—")),
            ("No Claim Bonus (NCB)", ins.get("ncb", "—")),
            ("Compulsory Deductible", ins.get("deductible", "—")),
            ("Zero Depreciation", ins.get("zero_depreciation", "—")),
            ("Roadside Assistance", ins.get("roadside_assistance", "—")),
            ("Engine Protection", ins.get("engine_protection", "—")),
            ("Consumables Cover", ins.get("consumables_cover", "—")),
            ("Key Protect", ins.get("key_protect", "—")),
            ("Passenger Cover", ins.get("passenger_cover", "—")),
        ])

    def _premium_table(self, data):
        p = data.get("premium", {})
        rows = [["Particulars", "Amount (INR)"]]
        rows.extend(p.get("rows", []))
        table = Table(rows, colWidths=[100 * mm, 52 * mm], hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("BACKGROUND", (0, 1), (-1, -2), WHITE),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e0f7fa")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("ALIGN", (1, 1), (1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        return table

    def _coverage_table(self, data):
        rows = [["Coverage Item", "Coverage Limit", "Status"]]
        for item in data.get("coverage_table", []):
            rows.append([item["item"], item["limit"], item["status"]])
        table = Table(rows, colWidths=[58 * mm, 52 * mm, 42 * mm], hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
            ("ALIGN", (2, 1), (2, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return table

    def _payment_table(self, data):
        pay = data.get("payment", {})
        return self._kv_table([
            ("Transaction ID", str(pay.get("transaction_id", "—"))),
            ("Stripe Payment ID", str(pay.get("stripe_payment_id", "—"))),
            ("Payment Date", pay.get("payment_date", "—")),
            ("Payment Method", str(pay.get("payment_method", "—"))),
            ("Amount Paid", pay.get("amount_paid", "—")),
            ("Payment Status", pay.get("status", "—")),
        ])

    def _nominee_table(self, data):
        n = data.get("nominee", {})
        return self._kv_table([
            ("Nominee Name", n.get("name", "—")),
            ("Relationship", n.get("relationship", "—")),
            ("Contact Number", n.get("contact", "—")),
        ])

    def _claim_process(self, data, styles):
        items = []
        for i, step in enumerate(data.get("claim_process", []), 1):
            items.append(Paragraph(f"{i}. {step}", styles["body"]))
        return items

    def _terms_block(self, data, styles):
        items = []
        for term in data.get("terms", []):
            items.append(Paragraph(f"• {term}", styles["body"]))
            items.append(Spacer(1, 1.5 * mm))
        return items

    def _verification_block(self, data, styles):
        company = data.get("company", {})
        return [
            Spacer(1, 4 * mm),
            Paragraph("11. DIGITAL VERIFICATION", styles["section"]),
            Paragraph(
                "Scan the QR code on page 1 to verify policy authenticity. "
                "The code encodes policy number, customer name, vehicle registration and validity.",
                styles["body"],
            ),
            Spacer(1, 3 * mm),
            Paragraph(
                f"<b>{company.get('name', 'Claim Nova Insurance')}</b><br/>"
                f"Customer Support: {company.get('email', '')} | {company.get('phone', '')}<br/>"
                f"Website: {company.get('website', '')} | "
                f"Emergency Claims: {company.get('emergency_claim', '')}",
                styles["footer"],
            ),
        ]

    def _qr_image(self, payload: str, size):
        if not payload:
            return Spacer(size, size)
        qr = qrcode.QRCode(version=1, box_size=4, border=1)
        qr.add_data(payload)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#002147", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return Image(buf, width=size, height=size)


def generate_policy_schedule_pdf(data: dict[str, Any]) -> bytes:
    return PolicyPDFGenerator().generate(data)
