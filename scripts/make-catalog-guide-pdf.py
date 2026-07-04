"""Create CSV template + simple PDF guide on the user's PC."""
from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
SRC_CSV = ROOT / "data" / "wholesale-catalog.csv"
OUT_DIR = Path.home() / "Downloads" / "LeafLock-Wholesale-Catalog"
CSV_NAME = "wholesale-catalog-template.csv"
PDF_NAME = "How-To-Update-Order-Form.pdf"


def build_pdf(pdf_path: Path) -> None:
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=20,
        spaceAfter=10,
        textColor=colors.HexColor("#1d5730"),
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=12,
        spaceAfter=6,
        textColor=colors.HexColor("#1d5730"),
    )
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=11, leading=15, spaceAfter=8)
    small = ParagraphStyle("Small", parent=styles["BodyText"], fontSize=9.5, leading=13, textColor=colors.grey)

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )
    story = []

    story.append(Paragraph("LeafLock Wholesale — Update the order form", title))
    story.append(
        Paragraph(
            f"Simple guide · {date.today().strftime('%d %B %Y')} · "
            "Keep this PDF with your spreadsheet template.",
            small,
        )
    )
    story.append(Spacer(1, 8))

    story.append(Paragraph("What you have on your PC", h2))
    story.append(
        Paragraph(
            f"<b>{CSV_NAME}</b> — your product list (open in Excel or Google Sheets).<br/>"
            "Edit prices and products here, then upload to the website.",
            body,
        )
    )

    story.append(Paragraph("3 easy steps", h2))
    steps = [
        ("1", "Download the latest template", "Admin → Wholesale → Download spreadsheet (or use the CSV saved with this PDF)."),
        ("2", "Edit in Excel", "Change prices or product names. Do not delete or rename the top header row."),
        ("3", "Upload", "Admin → Wholesale → Upload updated CSV. The portal order form updates straight away."),
    ]
    for num, heading, text in steps:
        story.append(Paragraph(f"<b>Step {num} — {heading}</b><br/>{text}", body))

    story.append(Paragraph("Column guide (top row — do not change)", h2))
    cols = [
        ["Column", "What to put"],
        ["Category", "Section name on the order form (e.g. Gummy mix 90g)"],
        ["SKU", "Unique product code — never duplicate"],
        ["Product Name", "Name stockists see"],
        ["Wholesale ex GST", "Your wholesale price (numbers only, e.g. 15.99)"],
        ["RRP", "Retail price"],
        ["MOQ", "Minimum order qty (leave blank if none)"],
        ["Bulk/Notes", "Extra info shown to stockists"],
        ["Image URL", "Optional — usually leave blank"],
        ["Bundle", "Y for cartons/multi-packs, else blank"],
        ["Units per bundle", "How many units in one bundle (e.g. 24 for gummy carton)"],
        ["Active", "Y = show on order form · N = hide product"],
    ]
    table = Table(cols, colWidths=[42 * mm, 120 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf5ed")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1d5730")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c8d9cc")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)

    story.append(Paragraph("Saving from Excel", h2))
    story.append(
        Paragraph(
            "File → Save As → choose <b>CSV (Comma delimited) (*.csv)</b>.<br/>"
            "If Excel warns about features, click Yes to keep CSV format.",
            body,
        )
    )

    story.append(Paragraph("Links", h2))
    story.append(
        Paragraph(
            "Admin: <b>https://www.wholesale.leaflock.com.au/admin/</b><br/>"
            "Portal (stockist order form): <b>https://www.wholesale.leaflock.com.au/portal.html</b><br/>"
            "Questions: <b>info@leaflock.com.au</b>",
            body,
        )
    )

    story.append(Paragraph("Do not change", h2))
    story.append(
        Paragraph(
            "• The first row (column headings)<br/>"
            "• SKU codes for existing products (unless you mean to add a new product)<br/>"
            "• File type — must stay .csv",
            body,
        )
    )

    doc.build(story)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_out = OUT_DIR / CSV_NAME
    pdf_out = OUT_DIR / PDF_NAME

    shutil.copy2(SRC_CSV, csv_out)
    build_pdf(pdf_out)

    print(f"CSV:  {csv_out}")
    print(f"PDF:  {pdf_out}")


if __name__ == "__main__":
    main()