"""ICS-214 Activity Log PDF export.

Replicates the standard FEMA/ICS Activity Log form layout: the incident
identification boxes (incident name, operational period, preparer's name/
position/agency) repeated at the top of every page, a two-column Date/Time
+ Notable Activities table that flows across as many pages as needed, and
a prepared-by line at the end -- rather than just dumping the log as a
plain CSV, this is meant to be the actual paper form a radio net/incident
log is normally kept on, filled in from the app's own Log Gara/Event Log.
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
HEADER_HEIGHT = 1.15 * inch
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
    canvas_obj.drawCentredString(PAGE_WIDTH / 2, top - 12, "ACTIVITY LOG (ICS 214)")

    row_h = 28
    box_top = top - 20
    col1, col2, col3 = usable_width * 0.5, usable_width * 0.25, usable_width * 0.25
    _field_box(canvas_obj, MARGIN, box_top, col1, row_h, "1. INCIDENT NAME", fields.get("incident_name", ""))
    _field_box(canvas_obj, MARGIN + col1, box_top, col2, row_h, "2. OPERATIONAL PERIOD (FROM)", fields.get("op_from", ""))
    _field_box(canvas_obj, MARGIN + col1 + col2, box_top, col3, row_h, "TO", fields.get("op_to", ""))

    box_top2 = box_top - row_h
    third = usable_width / 3
    _field_box(canvas_obj, MARGIN, box_top2, third, row_h, "3. NAME", fields.get("prepared_name", ""))
    _field_box(canvas_obj, MARGIN + third, box_top2, third, row_h, "4. ICS POSITION", fields.get("prepared_position", ""))
    _field_box(canvas_obj, MARGIN + 2 * third, box_top2, third, row_h, "5. HOME AGENCY (AND UNIT)", fields.get("prepared_agency", ""))

    canvas_obj.setFont("Helvetica", 7)
    canvas_obj.drawString(MARGIN, MARGIN - 10, f"ICS 214, Page {canvas_obj.getPageNumber()}")
    canvas_obj.drawRightString(PAGE_WIDTH - MARGIN, MARGIN - 10, "6. ACTIVITY LOG")
    canvas_obj.restoreState()


def build_ics214_pdf(fields: dict[str, str], entries: list[dict[str, str]]) -> bytes:
    buffer = io.BytesIO()
    doc = BaseDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN + HEADER_HEIGHT,
        bottomMargin=MARGIN + FOOTER_HEIGHT,
        title="ICS 214 Activity Log",
    )
    frame = Frame(
        MARGIN,
        MARGIN + FOOTER_HEIGHT,
        PAGE_WIDTH - 2 * MARGIN,
        PAGE_HEIGHT - 2 * MARGIN - HEADER_HEIGHT - FOOTER_HEIGHT,
        id="content",
    )
    doc.addPageTemplates([
        PageTemplate(id="ics214", frames=[frame], onPage=lambda c, d: _draw_page_frame(c, d, fields)),
    ])

    styles = getSampleStyleSheet()
    cell_style = ParagraphStyle("ics214-cell", parent=styles["Normal"], fontSize=8, leading=10)
    header_style = ParagraphStyle("ics214-header", parent=cell_style, fontName="Helvetica-Bold")

    usable_width = PAGE_WIDTH - 2 * MARGIN
    time_col = 1.1 * inch
    table_data = [[Paragraph("Date/Time", header_style), Paragraph("Notable Activities", header_style)]]
    for entry in entries:
        table_data.append([
            Paragraph(_xml_escape(entry["time"]), cell_style),
            Paragraph(_xml_escape(entry["activity"]), cell_style),
        ])
    table = Table(table_data, colWidths=[time_col, usable_width - time_col], repeatRows=1)
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
