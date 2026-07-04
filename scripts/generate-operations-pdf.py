#!/usr/bin/env python3
"""LeafLock Retail Wholesale — full backup operations manual (PDF)."""
import json
from datetime import date, datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "LeafLock-Pharmacy-Wholesale-Operations-Guide.pdf"
ENV_FILE = ROOT / "data" / ".leaflock-render-env.json"
LOCAL_SECRETS = ROOT / "data" / ".production-secrets.json"

styles = getSampleStyleSheet()
TITLE = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=20, spaceAfter=10, textColor=colors.HexColor("#1d5730"))
SUB = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#5c6963"))
H1 = ParagraphStyle("H1", parent=styles["Heading2"], fontSize=14, spaceBefore=14, spaceAfter=6, textColor=colors.HexColor("#2d7a44"))
H2 = ParagraphStyle("H2", parent=styles["Heading3"], fontSize=11, spaceBefore=8, spaceAfter=4, textColor=colors.HexColor("#1d5730"))
BODY = ParagraphStyle("Body", parent=styles["Normal"], fontSize=9.5, leading=13)
STEP = ParagraphStyle("Step", parent=BODY, leftIndent=10, spaceAfter=5)
WARN = ParagraphStyle("Warn", parent=BODY, backColor=colors.HexColor("#fff3cd"), borderPadding=6)
OK = ParagraphStyle("OK", parent=BODY, backColor=colors.HexColor("#eaf5ed"), borderPadding=6)

env = {}
if ENV_FILE.exists():
    env = json.loads(ENV_FILE.read_text(encoding="utf-8-sig"))
local = {}
if LOCAL_SECRETS.exists():
    local = json.loads(LOCAL_SECRETS.read_text(encoding="utf-8-sig"))

def p(t, s=BODY):
    return Paragraph(t.replace("\n", "<br/>"), s)

def steps(items):
    return [p(f"<b>{i+1}.</b> {t}", STEP) for i, t in enumerate(items)]

def tbl(rows, widths=None):
    t = Table(rows, colWidths=widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf5ed")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#dce4df")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t

story = []
story.append(p("LeafLock Retail Wholesale", TITLE))
story.append(p("Complete Backup Manual — use without Grok Build", SUB))
story.append(p(f"Generated {datetime.now().strftime('%d %B %Y at %H:%M')} (Australia/Brisbane)", SUB))
story.append(Spacer(1, 0.25 * cm))

# LIVE STATUS
story.append(p("LIVE STATUS REPORT (checked against med.leaflock.com.au)", H1))
story.append(p("<b>Working now:</b> Site URLs, HTTPS security headers, admin login, portal login, gated pricing, /data/ blocked from web.", OK))
story.append(p("<b>Needs attention on Render:</b> SMTP env vars missing on server — approval emails and daily reports will NOT send until SMTP_PASS etc. are pasted in Render Environment. PayPal is on <b>sandbox</b> on server — set PAYPAL_MODE=live and Live credentials for real payments.", WARN))
story.append(Spacer(1, 0.15 * cm))

story.append(p("Key URLs (bookmark these)", H2))
story += steps([
    "Public site: <b>https://med.leaflock.com.au</b>",
    "Admin dashboard: <b>https://med.leaflock.com.au/admin/</b>",
    "Retail portal: <b>https://med.leaflock.com.au/portal.html</b>",
    "New retail signup: <b>https://med.leaflock.com.au/request-access.html</b>",
    "Render dashboard: <b>https://dashboard.render.com/web/srv-d93nossvikkc73amkvv0</b>",
    "Render environment vars: <b>.../srv-d93nossvikkc73amkvv0/env</b>",
    "GoDaddy DNS: <b>https://dcc.godaddy.com/control/dnsmanagement?domainName=leaflock.com.au</b>",
])
story.append(PageBreak())

# WHERE PASSWORDS LIVE ON YOUR PC
story.append(p("WHERE TO FIND PASSWORDS ON YOUR PC", H1))
story.append(p("You do NOT need Grok chat history if these files exist:", BODY))
story += steps([
    f"<b>{ENV_FILE}</b> — all production passwords (admin, SMTP, PayPal, secrets). Gitignored, safe on your machine.",
    f"<b>{LOCAL_SECRETS}</b> — local copy of admin password and test codes.",
    f"<b>{OUT.name}</b> — this PDF (keep in password manager too).",
    "<b>Render dashboard → Environment</b> — what's actually running on the live server (log in as leaflock420@gmail.com).",
    "<b>Google Admin</b> — med@leaflock.com.au app password (for SMTP).",
    "<b>PayPal Developer</b> — developer.paypal.com → Med LeafLock app → Live credentials.",
])
story.append(Spacer(1, 0.2 * cm))

story.append(p("Your credentials (from local backup file)", H2))
cred = [
    ["What", "Value", "Used for"],
    ["Admin password", env.get("ANALYTICS_ADMIN_PASSWORD", local.get("adminPassword", "?")), "Login at /admin/"],
    ["Test pharmacy code", env.get("SEED_ACCESS_CODE", local.get("portalTestCode", "?")), "Test portal at /portal.html"],
    ["Email login", env.get("SMTP_USER", "med@leaflock.com.au"), "Google Workspace — sending mail"],
    ["SMTP app password", env.get("SMTP_PASS", "(see Render or Google Admin)"), "Server sends approval emails"],
    ["PayPal mode (should be)", env.get("PAYPAL_MODE", "live"), "live = real money"],
    ["PayPal Live Client ID", env.get("PAYPAL_CLIENT_ID", "(Render env)"), "Checkout"],
    ["PayPal Live Secret", env.get("PAYPAL_CLIENT_SECRET", "(Render env)"), "Server only — never share"],
]
story.append(tbl(cred, [3.8*cm, 5.5*cm, 6.2*cm]))
story.append(p("<i>Pharmacy access codes are NOT stored in plain text. Each is shown once when you approve or regenerate in admin.</i>", SUB))
story.append(PageBreak())

# DAILY ADMIN WORKFLOW
story.append(p("HOW TO USE THE ADMIN DASHBOARD", H1))
story.append(p("Logging in", H2))
story += steps([
    "Open <b>https://med.leaflock.com.au/admin/</b> in Chrome (any device).",
    f"Enter admin password: <b>{env.get('ANALYTICS_ADMIN_PASSWORD', 'see backup file above')}</b>",
    "Click <b>View dashboard</b>. Session lasts ~12 hours.",
    "Click <b>Log out</b> when done on a shared computer.",
])
story.append(p("Traffic tab", H2))
story += steps([
    "See live visitors, today's pageviews, portal views, access requests.",
    "Top pages and traffic sources (Google, direct, email, etc.).",
    "<b>Email report now</b> — sends yesterday's traffic to med@ (only works when SMTP is configured on Render).",
    "Automatic daily email at 7:00 AM Brisbane time when SMTP works.",
])
story.append(p("Wholesale tab — your main workspace", H2))
story += steps([
    "<b>System status</b> — green ticks = PayPal, email, secrets OK. Fix red items in Render Environment.",
    "<b>Access applications</b> — new pharmacies who filled request-access.html form.",
    "<b>Retail accounts</b> — approved pharmacies; regenerate codes here.",
    "<b>Orders</b> — all wholesale orders; change status to processing/shipped.",
    "<b>Recent logins</b> — who logged into portal (success and failed attempts).",
])
story.append(PageBreak())

# NEW PHARMACY FLOW
story.append(p("NEW PHARMACY SIGN-UP (end to end)", H1))
story.append(p("What the retailer does", H2))
story += steps([
    "Goes to <b>med.leaflock.com.au/request-access.html</b>.",
    "Fills: business name, full name, ABN, pharmacy reg number, email, phone, address.",
    "Submits form → sees confirmation. Pricing is still hidden.",
])
story.append(p("What you do in admin", H2))
story += steps([
    "Open admin → <b>Wholesale</b> tab → <b>Access applications</b>.",
    "Review pending row — verify ABN/reg look legitimate.",
    "Click <b>Approve</b> → system creates pharmacy account + access code (format LL-XXXX-XXXX).",
    "If SMTP works: approval email sent automatically to pharmacy with their code.",
    "If SMTP broken: popup shows code → click <b>Copy code</b> → email it manually from med@leaflock.com.au.",
    "Pharmacy goes to <b>portal.html</b>, enters code, sees pricing and can order.",
])
story.append(p("Rejecting an application", H2))
story += steps([
    "Click <b>Reject</b> on the application row. No email is sent automatically — contact them manually if needed.",
])
story.append(p("Adding a pharmacy manually (skip the form)", H2))
story += steps([
    "Wholesale tab → <b>Add retailer</b> → enter business name and email.",
    "Copy the generated code from popup → email to pharmacy.",
])
story.append(PageBreak())

# PORTAL & ORDERS
story.append(p("PHARMACY PORTAL & ORDERS", H1))
story.append(p("How pharmacies log in", H2))
story += steps([
    "URL: <b>https://med.leaflock.com.au/portal.html</b>",
    "Enter access code you gave them (e.g. LL-A1B2-C3D4).",
    "Session lasts 24 hours on that browser.",
    f"<b>Your test account:</b> code <b>{env.get('SEED_ACCESS_CODE', '?')}</b> — LeafLock Test Retail (for testing only).",
])
story.append(p("What pharmacies see after login", H2))
story += steps([
    "Wholesale pricing (humidity packs, gummy mix, starter bundle) — never visible to public.",
    "Order form with quantities, contact details, PayPal or invoice.",
    "PayPal button (sandbox until you fix PAYPAL_MODE=live on Render).",
])
story.append(p("Managing orders in admin", H2))
story += steps([
    "Wholesale tab → <b>Orders</b> table.",
    "Columns: date, pharmacy, total, payment method/status, order status.",
    "Change status dropdown: submitted → awaiting_payment → paid → processing → shipped.",
    "PayPal orders auto-mark paid when capture succeeds (when PayPal live is configured).",
    "Invoice orders: mark paid manually when you receive payment.",
])
story.append(PageBreak())

# RESET PASSWORDS
story.append(p("RESETTING PASSWORDS & ACCESS CODES", H1))
story.append(tbl([
    ["Reset what", "How", "Notes"],
    ["Admin password", "Render → Environment → change ANALYTICS_ADMIN_PASSWORD → Manual Deploy", "Also update data/.leaflock-render-env.json on your PC"],
    ["Pharmacy forgot code", "Admin → Pharmacies → <b>New code</b> → email new code", "Old code stops working immediately"],
    ["Suspend pharmacy", "Admin → Pharmacies → <b>Deactivate</b>", "They cannot log in until Activate"],
    ["SMTP / email", "Google Admin → med@ → App passwords → new password → SMTP_PASS on Render", "Needs 2FA on Google account"],
    ["PayPal", "developer.paypal.com → rotate secret → PAYPAL_CLIENT_SECRET on Render", "Set PAYPAL_MODE=live"],
    ["Session secrets", "Change PORTAL_SESSION_SECRET or ADMIN_SESSION_SECRET on Render", "Logs everyone out — redeploy after"],
], [3.5*cm, 6.5*cm, 5.5*cm]))
story.append(Spacer(1, 0.2 * cm))
story.append(p("There is NO pharmacy 'password' — only access codes. You never see old codes; only generate new ones.", BODY))
story.append(PageBreak())

# BACKUP PLAN WITHOUT GROK
story.append(p("BACKUP PLAN (no Grok Build required)", H1))
story.append(p("Routine operations — you only need a browser", H2))
story += steps([
    "Admin: med.leaflock.com.au/admin/ + password from this PDF or .leaflock-render-env.json",
    "Approve pharmacies, manage orders, check traffic — all in admin UI.",
    "Email pharmacies manually from med@ if Render SMTP not fixed yet.",
])
story.append(p("If the site goes down", H2))
story += steps([
    "Check Render dashboard (leaflock420@gmail.com) — is service green?",
    "Click <b>Manual Deploy</b> if last deploy failed.",
    "Check GitHub repo leaflock420-weedman/leaflock-pharmacy-wholesale — Render needs access to private repo.",
    "Check GoDaddy DNS: med → A record 216.24.57.1",
])
story.append(p("Fix email + PayPal on Render (one-time)", H2))
story += steps([
    "Open Render env tab for srv-d93nossvikkc73amkvv0.",
    "Paste ALL variables from data/.leaflock-render-env.json (20 vars) — especially SMTP_HOST, SMTP_USER, SMTP_PASS, PAYPAL_MODE=live, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET.",
    "Click <b>Save</b> → <b>Manual Deploy</b>.",
    "Admin → Wholesale → System status should show green ticks.",
    "Test: approve a test application or click Email report now.",
])
story.append(p("Local project folder (for a developer, not daily use)", H2))
story += steps([
    f"Code: <b>{ROOT}</b>",
    "Start locally: scripts/start-local.cmd (port 4173)",
    "Regenerate this PDF: python scripts/generate-operations-pdf.py",
    "Health check: node scripts/_live-health-check.mjs",
])
story.append(PageBreak())

# SECURITY & ANALYTICS
story.append(p("SECURITY (what protects you)", H1))
story += steps([
    "Wholesale pricing only via authenticated API — not in public HTML.",
    "Access codes stored as encrypted hashes — plain codes shown once only.",
    "Admin + portal sessions are signed tokens; expire after 12h / 24h.",
    "Rate limits: 20 login attempts per 15 min per IP.",
    "HTTPS, HSTS, CSP, clickjacking protection on all pages.",
    "/data/ folder blocked from internet — pharmacy data not downloadable.",
    "PayPal: server verifies payment amount matches order total.",
    "Secrets only in Render env — never in GitHub.",
])
story.append(p("Analytics (built-in)", H2))
story += steps([
    "Tracks pageviews, sessions, referrers, UTM campaigns on public pages.",
    "View in admin Traffic tab.",
    "Stored on Render disk at /var/data/events.json.",
    f"Daily email to {env.get('ANALYTICS_EMAIL_TO', 'med@leaflock.com.au')} at 7 AM when SMTP works.",
])
story.append(Spacer(1, 0.3 * cm))
story.append(p("ACCOUNTS SUMMARY", H1))
story.append(tbl([
    ["Account", "Email / login", "Purpose"],
    ["Render (hosting)", "leaflock420@gmail.com", "Runs the website, env vars, deploys"],
    ["Google Workspace", "med@leaflock.com.au", "Send/receive business email, SMTP"],
    ["GoDaddy", "leaflock420@gmail.com", "DNS for med.leaflock.com.au"],
    ["GitHub", "leaflock420-weedman", "Private code repo, auto-deploy"],
    ["PayPal Business", "Med LeafLock app (Live)", "Pharmacy checkout payments"],
    ["Admin dashboard", f"Password: {env.get('ANALYTICS_ADMIN_PASSWORD', 'see backup file')}", "You — traffic + wholesale"],
], [3.5*cm, 5*cm, 6*cm]))
story.append(Spacer(1, 0.4 * cm))
story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#dce4df")))
story.append(p("CONFIDENTIAL — LeafLock Retail Wholesale — med.leaflock.com.au", SUB))

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=1.8*cm, rightMargin=1.8*cm, topMargin=1.8*cm, bottomMargin=1.8*cm,
    title="LeafLock Retail Wholesale Backup Manual", author="LeafLock")
doc.build(story)
print(f"Wrote {OUT}")