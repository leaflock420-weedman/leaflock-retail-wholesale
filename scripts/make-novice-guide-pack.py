"""Build a complete novice guide pack on the user's PC (PDF + CSV + readme)."""
from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SRC_CSV = ROOT / "data" / "wholesale-catalog.csv"
OUT_DIRS = [
    Path.home() / "Downloads" / "LeafLock-Wholesale-Complete-Guide",
    Path.home() / "Desktop" / "LeafLock-Wholesale-Guide",
    ROOT / "docs",
]
SECURITY_RULES_SRC = ROOT / "docs" / "SECURITY-RULES.txt"
CSV_NAME = "wholesale-catalog-template.csv"
PDF_NAME = "LeafLock-Wholesale-Complete-Guide.pdf"
README_NAME = "START-HERE.txt"


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Heading1"],
            fontSize=22,
            spaceAfter=8,
            textColor=colors.HexColor("#1d5730"),
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["BodyText"],
            fontSize=10,
            leading=14,
            textColor=colors.grey,
            spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontSize=14,
            spaceBefore=14,
            spaceAfter=8,
            textColor=colors.HexColor("#1d5730"),
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=base["Heading3"],
            fontSize=11.5,
            spaceBefore=10,
            spaceAfter=5,
            textColor=colors.HexColor("#2d6a3e"),
        ),
        "body": ParagraphStyle("Body", parent=base["BodyText"], fontSize=11, leading=15, spaceAfter=7),
        "bullet": ParagraphStyle("Bullet", parent=base["BodyText"], fontSize=11, leading=15, leftIndent=12, spaceAfter=4),
    }


def p(text: str, style) -> Paragraph:
    return Paragraph(text, style)


def simple_table(rows: list[list[str]], col_widths: list[float]) -> Table:
    table = Table(rows, colWidths=col_widths)
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
    return table


def build_pdf(pdf_path: Path) -> None:
    s = styles()
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    story: list = []

    # —— Cover ——
    story.append(p("LeafLock Wholesale", s["title"]))
    story.append(
        p(
            "Complete beginner guide — make changes &amp; update the website<br/>"
            f"Printed {date.today().strftime('%d %B %Y')} · No coding experience needed for most tasks",
            s["subtitle"],
        )
    )
    story.append(
        p(
            "<b>Read this first.</b> The most common job is updating product prices on the "
            "stockist order form. That uses the spreadsheet in this folder — not code.",
            s["body"],
        )
    )

    story.append(p("What is in this folder on your PC", s["h2"]))
    story.append(
        p(
            f"• <b>{CSV_NAME}</b> — product list for the order form<br/>"
            f"• <b>{PDF_NAME}</b> — this guide (save or print it)<br/>"
            f"• <b>{README_NAME}</b> — quick links",
            s["body"],
        )
    )

    story.append(p("Important website links", s["h2"]))
    links = [
        ["What", "Web address"],
        ["Live wholesale site", "https://www.wholesale.leaflock.com.au"],
        ["Admin dashboard", "https://www.wholesale.leaflock.com.au/admin/"],
        ["Stockist login / order form", "https://www.wholesale.leaflock.com.au/portal.html"],
        ["Demo (try the portal)", "https://www.wholesale.leaflock.com.au/demo.html"],
        ["New stockist sign-up", "https://www.wholesale.leaflock.com.au/request-access.html"],
        ["Gummy email checkout", "https://www.wholesale.leaflock.com.au/gummy-checkout.html"],
        ["Your email", "info@leaflock.com.au"],
    ]
    story.append(simple_table(links, [52 * mm, 118 * mm]))

    story.append(PageBreak())

    # —— Part 1: Spreadsheet (main task) ——
    story.append(p("PART 1 — Update prices &amp; products (easiest)", s["title"]))
    story.append(
        p(
            "This is what you will do most often. You use <b>Excel</b> and the <b>Admin</b> page. "
            "You do <b>not</b> need to write code.",
            s["body"],
        )
    )

    story.append(p("Step 1 — Get the spreadsheet", s["h2"]))
    story.append(
        p(
            "Use the file <b>wholesale-catalog-template.csv</b> in this folder.<br/><br/>"
            "Or download a fresh copy anytime:<br/>"
            "1. Open <b>Admin</b> → log in with your admin password<br/>"
            "2. Click the <b>Wholesale</b> tab<br/>"
            "3. Click <b>Download spreadsheet</b>",
            s["body"],
        )
    )

    story.append(p("Step 2 — Edit in Excel", s["h2"]))
    story.append(
        p(
            "1. Double-click the CSV file (opens in Excel)<br/>"
            "2. Change prices, names, or add rows for new products<br/>"
            "3. <b>Do not change the top row</b> — that row has column headings<br/>"
            "4. When finished: <b>File → Save As → CSV (Comma delimited) (*.csv)</b><br/>"
            "5. If Excel asks about saving as CSV, click <b>Yes</b>",
            s["body"],
        )
    )

    story.append(p("Step 3 — Upload to the website", s["h2"]))
    story.append(
        p(
            "1. Go to <b>Admin → Wholesale</b><br/>"
            "2. Click <b>Upload updated CSV</b><br/>"
            "3. Pick your saved file<br/>"
            "4. Wait for the green success message<br/>"
            "5. Open the <b>portal</b> and check the order form — it updates straight away",
            s["body"],
        )
    )

    story.append(p("Spreadsheet columns explained", s["h2"]))
    cols = [
        ["Column", "What you type"],
        ["Category", "Group name (e.g. Gummy mix 90g)"],
        ["SKU", "Product code — must be unique"],
        ["Product Name", "What stockists read on the form"],
        ["Wholesale ex GST", "Your price — numbers only, e.g. 15.99"],
        ["RRP", "Shop retail price"],
        ["MOQ", "Minimum order (blank = no minimum)"],
        ["Bulk/Notes", "Extra text under the product"],
        ["Image URL", "Leave blank unless you know the image link"],
        ["Bundle", "Type Y for cartons / multi-packs"],
        ["Units per bundle", "e.g. 24 for a gummy carton"],
        ["Active", "Y = show on form · N = hide product"],
    ]
    story.append(simple_table(cols, [44 * mm, 126 * mm]))

    story.append(p("Adding a new product", s["h3"]))
    story.append(
        p(
            "Add a new row at the bottom. Give it a new <b>SKU</b> nobody else uses. "
            "Set <b>Active</b> to Y. Upload the file again.",
            s["body"],
        )
    )

    story.append(p("Hiding a product (stop selling it)", s["h3"]))
    story.append(p("Change <b>Active</b> from Y to <b>N</b> on that row. Upload again.", s["body"]))

    story.append(PageBreak())

    # —— Part 2: Admin daily tasks ——
    story.append(p("PART 2 — Admin dashboard (day-to-day)", s["title"]))
    story.append(p("Log in at https://www.wholesale.leaflock.com.au/admin/", s["body"]))

    story.append(p("Wholesale tab — what you do here", s["h2"]))
    admin_tasks = [
        ("Upload / download spreadsheet", "Update the order form (Part 1 above)"),
        ("Access applications", "When a shop applies — click Approve or Reject"),
        ("Retail stockist accounts", "See who can log in; Reset password if they forgot"),
        ("Orders", "See orders; change status (processing, shipped, etc.)"),
        ("System status", "Green ticks = email, PayPal, catalogue working"),
    ]
    for heading, detail in admin_tasks:
        story.append(p(f"<b>{heading}</b> — {detail}", s["bullet"]))

    story.append(p("When you approve a new stockist", s["h3"]))
    story.append(
        p(
            "1. Click <b>Approve</b> on their application<br/>"
            "2. They get an email with a link to set their password (if email is working)<br/>"
            "3. If no email — copy the setup link from the popup and send it yourself from info@",
            s["body"],
        )
    )

    story.append(p("Demo login (for testing)", s["h2"]))
    demo = [
        ["Email", "demo@leaflock.com.au"],
        ["Password", "Demo-Stockist-2026!"],
        ["Quick link", "https://www.wholesale.leaflock.com.au/demo.html"],
    ]
    story.append(simple_table(demo, [40 * mm, 130 * mm]))
    story.append(
        p("Use this to check pricing and the order form before telling stockists.", s["body"])
    )

    story.append(PageBreak())

    # —— Part 3: Optional website text/colours ——
    story.append(p("PART 3 — Change website words or colours (optional)", s["title"]))
    story.append(
        p(
            "Only needed if you want to change headlines, paragraphs, or colours — not prices. "
            "Prices go in the <b>spreadsheet</b> (Part 1).",
            s["body"],
        )
    )

    story.append(p("Tools (free)", s["h2"]))
    story.append(
        p(
            "• <b>VS Code</b> — download from code.visualstudio.com<br/>"
            "• Open folder: <b>C:\\Users\\wordo\\LL-Wholesale</b><br/>"
            "• Browser: Chrome or Edge",
            s["body"],
        )
    )

    story.append(p("Golden rules", s["h2"]))
    rules = [
        "Save the file (Ctrl + S) before checking the browser",
        "Refresh the page (F5) to see changes",
        "Change one small thing at a time",
        "Ctrl + Z to undo mistakes",
        "Never share passwords online",
    ]
    for rule in rules:
        story.append(p(f"• {rule}", s["bullet"]))

    story.append(p("Which file to open", s["h2"]))
    pages = [
        ["Change…", "Open this file"],
        ["Home page words", "index.html"],
        ["Portal login words", "portal.html"],
        ["Green buttons / dark theme", "assets\\styles.css"],
        ["Logo picture", "assets\\brand\\leaflock-logo.png"],
        ["Top menu links", "assets\\layout.js"],
    ]
    story.append(simple_table(pages, [58 * mm, 112 * mm]))

    story.append(p("How to change a sentence", s["h3"]))
    story.append(
        p(
            "1. Open the HTML file in VS Code<br/>"
            "2. Press <b>Ctrl + F</b> and search for the words you see on the website<br/>"
            "3. Edit the text — only the readable words, not the &lt;tags&gt;<br/>"
            "4. Save and refresh the website",
            s["body"],
        )
    )

    story.append(p("How to change the green colour", s["h3"]))
    story.append(
        p(
            "1. Open <b>assets\\styles.css</b><br/>"
            "2. Near the top find: <b>--ll-green: #95d05d;</b><br/>"
            "3. Change the colour code (Google “html color picker” for ideas)<br/>"
            "4. Save and refresh",
            s["body"],
        )
    )

    story.append(p("Put text/colour changes LIVE on the internet", s["h2"]))
    story.append(
        p(
            "Spreadsheet uploads go live instantly (Part 1).<br/><br/>"
            "For HTML/CSS file edits, an adult needs to upload to GitHub:<br/>"
            "1. Open Terminal in VS Code in the project folder<br/>"
            "2. Type: <b>git add</b> then the filename<br/>"
            "3. Type: <b>git commit -m \"describe change\"</b><br/>"
            "4. Type: <b>git push</b><br/>"
            "5. Wait 2–5 minutes, then hard-refresh the site (Ctrl + Shift + R)",
            s["body"],
        )
    )

    story.append(PageBreak())

    # —— Part 4: Don't touch / troubleshooting ——
    story.append(p("PART 4 — Leave these alone (for now)", s["title"]))
    dont = [
        "server.js — runs the whole site",
        "lib\\ folder — orders, login, PayPal logic",
        "data\\ folder — real customer data",
        ".env.local — secret passwords",
        "lib\\pricing.js — gummy bulk rules & free shipping (ask for help first)",
    ]
    for item in dont:
        story.append(p(f"• {item}", s["bullet"]))

    story.append(p("If something goes wrong", s["h2"]))
    fixes = [
        ("Spreadsheet upload failed", "Read the red error on Admin. Usually a duplicate SKU or missing price."),
        ("Excel looks messy", "Widen columns. Save as CSV again — not .xlsx."),
        ("Portal looks old after upload", "Hard refresh: Ctrl + Shift + R. Or log out and back in."),
        ("Stockist can't log in", "Admin → find their store → Reset password → email them the link."),
        ("PayPal button missing", "Check Admin → System status. PayPal should show a green tick."),
        ("Undo a bad file edit", "Ctrl + Z in VS Code, or ask someone to restore from Git."),
    ]
    fix_rows = [["Problem", "Try this"]] + list(fixes)
    story.append(simple_table(fix_rows, [52 * mm, 118 * mm]))

    story.append(p("PART 5 — Security (always follow)", s["title"]))
    story.append(
        p(
            "<b>Never paste passwords or API keys in chat, text messages, or GitHub.</b> "
            "That includes admin passwords, email app passwords, PayPal secrets, and Australia Post API keys.",
            s["body"],
        )
    )
    security = [
        "Secrets live only on Render → leaflock-retail-wholesale → Environment",
        "On your PC: .env.local and data\\.leaflock-render-env.json (never commit these)",
        "If a key was shared by mistake: revoke it at the provider, create a new one, add only in Render",
        "Tell your developer “updated on Render” — do not send the new key in chat",
        "Before git push: run npm run secrets:check",
    ]
    for rule in security:
        story.append(p(f"• {rule}", s["bullet"]))

    story.append(p("Quick cheat sheet", s["h2"]))
    cheat = [
        ["I want to…", "Do this"],
        ["Change product prices", "Edit CSV → Admin → Upload"],
        ["Approve a new shop", "Admin → Wholesale → Approve"],
        ["See orders", "Admin → Wholesale → Orders"],
        ["Test the portal", "demo.html + demo login"],
        ["Change homepage text", "index.html in VS Code → git push"],
        ["Change green colour", "assets\\styles.css → git push"],
    ]
    story.append(simple_table(cheat, [52 * mm, 118 * mm]))

    story.append(Spacer(1, 12))
    story.append(
        p(
            "<b>You're done.</b> For most updates: edit the spreadsheet, upload in Admin, check the portal. "
            "Questions: info@leaflock.com.au",
            s["body"],
        )
    )

    doc.build(story)


def write_readme(path: Path) -> None:
    path.write_text(
        f"""LEAFLOCK WHOLESALE — START HERE
================================
Folder created: {date.today().strftime('%d %B %Y')}

OPEN FIRST:
  {PDF_NAME}
  (Complete instructions for a beginner — print or keep on your desktop)

MOST COMMON TASK — update order form prices:
  1. Open {CSV_NAME} in Excel
  2. Edit prices (keep the top header row unchanged)
  3. Save As -> CSV (Comma delimited)
  4. Go to https://www.wholesale.leaflock.com.au/admin/
  5. Wholesale tab -> Upload updated CSV

LINKS:
  Admin:    https://www.wholesale.leaflock.com.au/admin/
  Portal:   https://www.wholesale.leaflock.com.au/portal.html
  Demo:     https://www.wholesale.leaflock.com.au/demo.html

DEMO LOGIN:
  Email:    demo@leaflock.com.au
  Password: Demo-Stockist-2026!

EMAIL: info@leaflock.com.au

SECURITY: Read SECURITY-RULES.txt — never paste API keys or passwords in chat.
""",
        encoding="utf-8",
    )


def main() -> None:
    for out_dir in OUT_DIRS:
        out_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SRC_CSV, out_dir / CSV_NAME)
        build_pdf(out_dir / PDF_NAME)
        write_readme(out_dir / README_NAME)
        if SECURITY_RULES_SRC.exists():
            dest = out_dir / "SECURITY-RULES.txt"
            try:
                shutil.copy2(SECURITY_RULES_SRC, dest)
            except OSError:
                dest.write_text(SECURITY_RULES_SRC.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"Pack ready: {out_dir}")
        for name in (README_NAME, CSV_NAME, PDF_NAME):
            print(f"  - {name}")


if __name__ == "__main__":
    main()