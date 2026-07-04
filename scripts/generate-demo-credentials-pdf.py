#!/usr/bin/env python3
"""Private demo login sheet — save to Downloads."""
import json
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "data" / ".leaflock-render-env.json"
OUT = Path.home() / "Downloads" / "LeafLock-Private-Demo-Logins.pdf"

env = json.loads(ENV_FILE.read_text(encoding="utf-8-sig")) if ENV_FILE.exists() else {}
site = env.get("SITE_URL", "https://med.leaflock.com.au")
admin_pw = env.get("ANALYTICS_ADMIN_PASSWORD", "(not set)")
portal_code = env.get("SEED_ACCESS_CODE", "(not set)")

styles = getSampleStyleSheet()
TITLE = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=18, spaceAfter=8, textColor=colors.HexColor("#1d5730"))
SUB = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#5c6963"))
H1 = ParagraphStyle("H1", parent=styles["Heading2"], fontSize=12, spaceBefore=12, spaceAfter=6, textColor=colors.HexColor("#2d7a44"))
BODY = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=14)
WARN = ParagraphStyle("Warn", parent=BODY, backColor=colors.HexColor("#fff3cd"), borderPadding=8)
MONO = ParagraphStyle("Mono", parent=BODY, fontName="Courier", fontSize=10, backColor=colors.HexColor("#f4f7f5"), borderPadding=6)


def p(text, style=BODY):
    return Paragraph(text.replace("\n", "<br/>"), style)


def cred_table(rows):
    t = Table(rows, colWidths=[4.2 * cm, 12.3 * cm], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf5ed")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#dce4df")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


story = [
    p("LeafLock Pharmacy Wholesale", TITLE),
    p("Private demo logins — keep confidential", SUB),
    p(f"Generated {datetime.now().strftime('%d %B %Y %H:%M')} (Australia/Brisbane)", SUB),
    Spacer(1, 0.4 * cm),
    p(
        "<b>CONFIDENTIAL.</b> Do not share publicly. For your own testing and demos only. "
        "Change the admin password in Render if this file is ever exposed.",
        WARN,
    ),
    Spacer(1, 0.3 * cm),
    p("1. Admin dashboard (analytics + wholesale management)", H1),
    cred_table(
        [
            ["Field", "Value"],
            ["URL", f'<a href="{site}/admin/">{site}/admin/</a>'],
            ["Login type", "Password only (no username)"],
            ["Admin password", f"<b>{admin_pw}</b>"],
            ["What you can test", "Traffic stats, approve pharmacies, send compliance docs, orders, login log"],
        ]
    ),
    Spacer(1, 0.35 * cm),
    p("Quick test steps", BODY),
    p(
        "Open the admin URL → enter the password → Wholesale tab → check System status is green. "
        "Try approving a test application or Send docs on a pharmacy row.",
        BODY,
    ),
    Spacer(1, 0.25 * cm),
    HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#dce4df")),
    Spacer(1, 0.25 * cm),
    p("2. Pharmacy wholesale portal (pricing + orders)", H1),
    cred_table(
        [
            ["Field", "Value"],
            ["URL", f'<a href="{site}/portal.html">{site}/portal.html</a>'],
            ["Login type", "Access code (no password)"],
            ["Demo access code", f"<b>{portal_code}</b>"],
            ["Test account", "LeafLock Test Pharmacy"],
            ["What you can test", "Pricing, order form, PayPal LIVE buttons, company credentials badges (collapsed)"],
        ]
    ),
    Spacer(1, 0.35 * cm),
    p("Quick test steps", BODY),
    p(
        "Open portal → enter access code → confirm pricing loads → expand "
        "<i>Company credentials</i> → verify trademark / NDA / compliance badges show (no downloads). "
        "Log out and confirm pricing is hidden again.",
        BODY,
    ),
    Spacer(1, 0.25 * cm),
    HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#dce4df")),
    Spacer(1, 0.25 * cm),
    p("3. Public pages (no login)", H1),
    cred_table(
        [
            ["Page", "URL"],
            ["Home", f"{site}/"],
            ["Request access", f"{site}/request-access.html"],
            ["Humidity packs", f"{site}/humidity-packs.html"],
            ["Gummies", f"{site}/gummies.html"],
            ["Lab disclosure", f"{site}/lab-disclosure.html"],
        ]
    ),
    Spacer(1, 0.35 * cm),
    p("4. Support contact", H1),
    cred_table(
        [
            ["Email", "med@leaflock.com.au"],
            ["Phone", "0431 295 201"],
            ["Render account", "leaflock420@gmail.com"],
        ]
    ),
    Spacer(1, 0.5 * cm),
    p(
        "PayPal is in <b>LIVE</b> mode on production — use small test amounts only if you complete a real checkout.",
        WARN,
    ),
]

doc = SimpleDocTemplate(
    str(OUT),
    pagesize=A4,
    leftMargin=2 * cm,
    rightMargin=2 * cm,
    topMargin=1.8 * cm,
    bottomMargin=1.8 * cm,
    title="LeafLock Private Demo Logins",
    author="LeafLock & Co Pty Ltd",
)
doc.build(story)
print(f"Wrote {OUT}")