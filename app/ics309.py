"""ICS-309 Communications Log PDF export.

Replicates the standard FEMA/ICS Communications Log form layout: the
incident identification boxes (incident name, date/time prepared,
operational period, task force/net, channel/frequency/system) repeated at
the top of every page, a four-column Time/From/To/Message radio-traffic
table that flows across as many pages as needed, and a prepared-by line at
the end -- filled in from the app's own Log Gara/Event Log.
"""
from __future__ import annotations

import io
from typing import Any
from xml.sax.saxutils import escape as _xml_escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 0.5 * inch
HEADER_HEIGHT = 1.45 * inch
FOOTER_HEIGHT = 0.3 * inch


def _field_box(canvas_obj: Canvas, x: float, y: float, w: float, h: float, label: str, value: str) -> None:
    canvas_obj.rect(x, y - h, w, h)
    canvas_obj.setFont("Helvetica-Bold", 6.5)
    canvas_obj.drawString(x + 3, y - 9, label)
    canvas_obj.setFont("Helvetica", 9)
    canvas_obj.drawString(x + 3, y - h + 6, str(value)[:70])


def _draw_page_frame(canvas_obj: Canvas, _doc: Any, fields: dict[str, str]) -> None:
    canvas_obj.saveState()
    top = PAGE_HEIGHT - MARGIN
    usable_width = PAGE_WIDTH - 2 * MARGIN

    canvas_obj.setFont("Helvetica-Bold", 13)
    canvas_obj.drawCentredString(PAGE_WIDTH / 2, top - 12, "COMMUNICATIONS LOG (ICS 309)")

    row_h = 28
    box_top = top - 20
    col1, col2 = usable_width * 0.65, usable_width * 0.35
    _field_box(canvas_obj, MARGIN, box_top, col1, row_h, "1. INCIDENT NAME", fields.get("incident_name", ""))
    _field_box(canvas_obj, MARGIN + col1, box_top, col2, row_h, "2. DATE/TIME PREPARED", fields.get("prepared_at", ""))

    box_top2 = box_top - row_h
    half = usable_width / 2
    _field_box(canvas_obj, MARGIN, box_top2, half, row_h, "3. OPERATIONAL PERIOD (FROM)", fields.get("op_from", ""))
    _field_box(canvas_obj, MARGIN + half, box_top2, half, row_h, "TO", fields.get("op_to", ""))

    box_top3 = box_top2 - row_h
    _field_box(canvas_obj, MARGIN, box_top3, half, row_h, "4. TASK FORCE/TEAM/NET", fields.get("net_name", ""))
    _field_box(canvas_obj, MARGIN + half, box_top3, half, row_h, "5. RADIO/TEL/FREQ/SYSTEM/ASSIGNMENT", fields.get("channel", ""))

    canvas_obj.setFont("Helvetica", 7)
    canvas_obj.drawString(MARGIN, MARGIN - 10, f"ICS 309, Page {canvas_obj.getPageNumber()}")
    canvas_obj.drawRightString(PAGE_WIDTH - MARGIN, MARGIN - 10, "6. COMMUNICATIONS LOG")
    canvas_obj.restoreState()


def build_ics309_pdf(fields: dict[str, str], entries: list[dict[str, str]]) -> bytes:
    buffer = io.BytesIO()
    doc = BaseDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN + HEADER_HEIGHT,
        bottomMargin=MARGIN + FOOTER_HEIGHT,
        title="ICS 309 Communications Log",
    )
    frame = Frame(
        MARGIN,
        MARGIN + FOOTER_HEIGHT,
        PAGE_WIDTH - 2 * MARGIN,
        PAGE_HEIGHT - 2 * MARGIN - HEADER_HEIGHT - FOOTER_HEIGHT,
        id="content",
    )
    doc.addPageTemplates([
        PageTemplate(id="ics309", frames=[frame], onPage=lambda c, d: _draw_page_frame(c, d, fields)),
    ])

    styles = getSampleStyleSheet()
    cell_style = ParagraphStyle("ics309-cell", parent=styles["Normal"], fontSize=8, leading=10)
    header_style = ParagraphStyle("ics309-header", parent=cell_style, fontName="Helvetica-Bold")

    usable_width = PAGE_WIDTH - 2 * MARGIN
    time_col = 0.9 * inch
    from_col = 1.3 * inch
    to_col = 1.3 * inch
    message_col = usable_width - time_col - from_col - to_col

    table_data = [[
        Paragraph("Time", header_style),
        Paragraph("From", header_style),
        Paragraph("To", header_style),
        Paragraph("Message", header_style),
    ]]
    for entry in entries:
        table_data.append([
            Paragraph(_xml_escape(entry["time"]), cell_style),
            Paragraph(_xml_escape(entry["from_station"]), cell_style),
            Paragraph(_xml_escape(entry["to_station"]), cell_style),
            Paragraph(_xml_escape(entry["message"]), cell_style),
        ])
    table = Table(table_data, colWidths=[time_col, from_col, to_col, message_col], repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))

    story = [table, Spacer(1, 14), Paragraph(_xml_escape(fields.get("signature_line", "")), cell_style)]
    doc.build(story)
    return buffer.getvalue()
