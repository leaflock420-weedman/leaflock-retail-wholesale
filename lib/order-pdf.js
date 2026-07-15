const PDFDocument = require("pdfkit");
const { PUBLIC_COMPANY } = require("./company-public");
const { bankDetails, paymentReference } = require("./bank-details");
const { expandOrderLines, money } = require("./order-lines");

const BRAND = "#1d5730";
const MUTED = "#5c6963";
const LINE = "#d8e0da";
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const INVOICE_MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const INVOICE_W = PAGE_W - INVOICE_MARGIN * 2;
const INVOICE_FOOTER_Y = PAGE_H - INVOICE_MARGIN - 108;

function formatDate(ts) {
  return new Date(ts || Date.now()).toLocaleString("en-AU", {
    timeZone: process.env.TZ || "Australia/Brisbane",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function drawHeader(doc, title, subtitle) {
  doc.fillColor(BRAND).fontSize(18).font("Helvetica-Bold").text("LeafLock™ Wholesale", MARGIN, 45);
  doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(PUBLIC_COMPANY.legalName, MARGIN, 66);
  doc.fillColor(BRAND).fontSize(14).font("Helvetica-Bold").text(title, MARGIN, 92);
  if (subtitle) {
    doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(subtitle, MARGIN, 110);
  }
  doc.moveTo(MARGIN, 124).lineTo(PAGE_W - MARGIN, 124).strokeColor(LINE).stroke();
  doc.y = 136;
}

function drawCompactInvoiceHeader(doc, ref) {
  const m = INVOICE_MARGIN;
  doc.fillColor(BRAND).fontSize(14).font("Helvetica-Bold").text("LeafLock™ Wholesale", m, m);
  doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(PUBLIC_COMPANY.legalName, m, m + 16, { width: 280 });
  doc.fillColor(BRAND).fontSize(12).font("Helvetica-Bold").text("TAX INVOICE", 360, m, { width: 195, align: "right" });
  doc.fillColor(MUTED).fontSize(8).font("Helvetica").text(`Ref ${ref}`, 360, m + 16, { width: 195, align: "right" });
  doc.moveTo(m, m + 30).lineTo(PAGE_W - m, m + 30).strokeColor(LINE).stroke();
  doc.y = m + 36;
}

function drawCompactInvoiceMeta(doc, order) {
  const m = INVOICE_MARGIN;
  const contact = order.contact || {};
  const inv = order.invoiceNumber || order.id;
  const billTo = [
    contact.businessName || order.retailStockistName || "—",
    contact.fullName || null,
    contact.abn ? `ABN ${contact.abn}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const deliverTo = contact.address || "—";

  let y = doc.y;
  doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("INVOICE", m, y);
  doc.fillColor("#17211d").fontSize(8).font("Helvetica").text(
    `${inv} · ${formatDate(order.createdAt)} · ${order.paymentMethod || "invoice"}`,
    m,
    y + 9,
    { width: INVOICE_W },
  );

  y += 22;
  const colW = Math.floor(INVOICE_W / 2) - 6;
  doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("BILL TO", m, y);
  doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("DELIVER TO", m + colW + 12, y);
  doc.fillColor("#17211d").fontSize(8).font("Helvetica");
  const billH = doc.heightOfString(billTo, { width: colW });
  const deliverH = doc.heightOfString(deliverTo, { width: colW });
  doc.text(billTo, m, y + 9, { width: colW, lineGap: 0 });
  doc.text(deliverTo, m + colW + 12, y + 9, { width: colW, lineGap: 0 });
  doc.y = y + 12 + Math.max(billH, deliverH, 10) + 4;
}

function drawCompactPriceTable(doc, lines, maxY) {
  const m = INVOICE_MARGIN;
  const cols = [
    { label: "SKU", w: 64 },
    { label: "Description", w: 236 },
    { label: "Qty", w: 28, align: "right" },
    { label: "Unit ex", w: 58, align: "right" },
    { label: "Line ex", w: 58, align: "right" },
  ];

  let y = doc.y;
  doc.fillColor("#fff").rect(m, y, INVOICE_W, 13).fill(BRAND);
  doc.fillColor("#fff").fontSize(7).font("Helvetica-Bold");
  let x = m + 4;
  for (const col of cols) {
    doc.text(col.label, x, y + 3, { width: col.w - 4, align: col.align || "left" });
    x += col.w;
  }
  y += 15;
  doc.font("Helvetica").fontSize(7.5).fillColor("#17211d");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rowH = Math.max(11, doc.heightOfString(line.name, { width: cols[1].w - 4, lineGap: 0 }) + 2);
    if (y + rowH > maxY) {
      doc.addPage();
      y = INVOICE_MARGIN + 8;
      doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text("TAX INVOICE (continued)", INVOICE_MARGIN, y);
      y += 14;
      doc.fillColor("#fff").rect(m, y, INVOICE_W, 13).fill(BRAND);
      doc.fillColor("#fff").fontSize(7).font("Helvetica-Bold");
      x = m + 4;
      for (const col of cols) {
        doc.text(col.label, x, y + 3, { width: col.w - 4, align: col.align || "left" });
        x += col.w;
      }
      y += 15;
      doc.font("Helvetica").fontSize(7.5).fillColor("#17211d");
    }
    if (i % 2 === 0) {
      doc.fillColor("#f6f8f7").rect(m, y - 1, INVOICE_W, rowH + 1).fill();
    }
    doc.fillColor("#17211d");
    x = m + 4;
    const values = [
      line.sku,
      line.name,
      String(line.qty),
      money(line.unitWholesale),
      money(line.lineTotal),
    ];
    values.forEach((val, ci) => {
      const col = cols[ci];
      doc.text(val, x, y, { width: col.w - 4, align: col.align || "left", lineGap: 0 });
      x += col.w;
    });
    y += rowH;
  }
  doc.y = y + 4;
}

function drawInvoiceFooter(doc, order, bank, ref, tableEndY) {
  const m = INVOICE_MARGIN;
  const totals = order.totals || {};
  let y = Math.max(tableEndY + 6, INVOICE_FOOTER_Y);

  if (order.notes) {
    const noteY = Math.min(y - 28, tableEndY + 4);
    if (noteY + 22 <= INVOICE_FOOTER_Y) {
      doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("Notes", m, noteY);
      doc.fillColor("#17211d").font("Helvetica").fontSize(7.5).text(order.notes, m, noteY + 9, {
        width: INVOICE_W,
        lineGap: 0,
      });
    }
  }

  doc.moveTo(m, y).lineTo(PAGE_W - m, y).strokeColor(LINE).stroke();
  y += 8;

  const rows = [
    ["Subtotal ex GST", money(totals.subtotal)],
    ["GST (10%)", money(totals.gst)],
    ["Shipping", money(totals.shipping)],
    ["Total inc GST", money(totals.total)],
  ];
  for (const [label, value] of rows) {
    const bold = label.startsWith("Total");
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 9.5 : 8);
    doc.fillColor(bold ? BRAND : "#17211d").text(label, 350, y, { width: 120 });
    doc.text(value, 468, y, { width: 87, align: "right" });
    y += bold ? 13 : 11;
  }

  if (bank.configured) {
    y += 4;
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text("Bank transfer", m, y);
    doc.font("Helvetica").fontSize(7.5).fillColor("#17211d");
    doc.text(
      `${bank.accountName} · BSB ${bank.bsb} · Acc ${bank.accountNumber} · PayID ${bank.payId} · Ref ${ref}`,
      m,
      y + 9,
      { width: INVOICE_W, lineGap: 0 },
    );
    y += 20;
  }

  doc.fillColor(MUTED).fontSize(6.5).font("Helvetica").text(
    "Goods remain property of LeafLock™ until paid in full.",
    m,
    PAGE_H - INVOICE_MARGIN - 10,
    { width: INVOICE_W, align: "center" },
  );
}

async function generateInvoicePdf(order) {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const lines = expandOrderLines(order);
  const bank = bankDetails();
  const ref = paymentReference(order);

  drawCompactInvoiceHeader(doc, ref);
  drawCompactInvoiceMeta(doc, order);
  drawCompactPriceTable(doc, lines, INVOICE_FOOTER_Y - 8);
  drawInvoiceFooter(doc, order, bank, ref, doc.y);

  return pdfBuffer(doc);
}

function drawPickTable(doc, lines) {
  const pickX = MARGIN;
  const qtyX = MARGIN + 28;
  const skuX = MARGIN + 58;
  const nameX = MARGIN + 130;
  const nameW = CONTENT_W - 130;

  let y = doc.y + 4;
  doc.fillColor("#fff").rect(MARGIN, y, CONTENT_W, 16).fill(BRAND);
  doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
  doc.text("✓", pickX, y + 4, { width: 20, align: "center" });
  doc.text("QTY", qtyX, y + 4, { width: 28, align: "center" });
  doc.text("SKU", skuX, y + 4, { width: 68 });
  doc.text("PRODUCT", nameX, y + 4);
  y += 20;

  doc.font("Helvetica").fontSize(10).fillColor("#17211d");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (y > 720) {
      doc.addPage();
      y = MARGIN;
    }
    if (i % 2 === 0) {
      doc.fillColor("#f4f7f5").rect(MARGIN, y - 2, CONTENT_W, 20).fill();
    }
    doc.strokeColor(LINE).rect(MARGIN, y + 2, 14, 14).stroke();
    doc.fillColor("#17211d");
    doc.font("Helvetica-Bold").fontSize(11).text(String(line.qty), qtyX, y + 2, { width: 28, align: "center" });
    doc.font("Helvetica").fontSize(9).text(line.sku, skuX, y + 3, { width: 68 });
    const nameH = doc.heightOfString(line.name, { width: nameW });
    doc.font("Helvetica-Bold").fontSize(10).text(line.name, nameX, y + 2, { width: nameW });
    y += Math.max(22, nameH + 8);
  }
  doc.y = y + 6;
}

async function generateFulfillmentPdf(order) {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const contact = order.contact || {};
  const lines = expandOrderLines(order);
  const inv = order.invoiceNumber || order.id;
  const paid = order.paymentStatus === "paid";

  drawHeader(doc, "WAREHOUSE PICK & PACK", `Ref ${inv} · ${formatDate(order.createdAt)}`);

  // Ship-to box
  const boxY = doc.y;
  doc.fillColor("#f4f7f5").rect(MARGIN, boxY, CONTENT_W, 88).fill();
  doc.strokeColor(BRAND).lineWidth(2).rect(MARGIN, boxY, CONTENT_W, 88).stroke();
  doc.lineWidth(1);
  doc.fillColor(BRAND).fontSize(9).font("Helvetica-Bold").text("SHIP TO", MARGIN + 10, boxY + 10);
  doc.fillColor("#17211d").fontSize(13).font("Helvetica-Bold").text(
    contact.businessName || order.retailStockistName || "—",
    MARGIN + 10,
    boxY + 24,
    { width: CONTENT_W - 20 },
  );
  doc.font("Helvetica").fontSize(10);
  doc.text(contact.address || "— Confirm address with stockist", MARGIN + 10, boxY + 42, { width: CONTENT_W - 20 });
  doc.fontSize(9).fillColor(MUTED);
  doc.text(
    `${contact.fullName || "—"} · ${contact.phone || "no phone"} · ${contact.email || ""}`,
    MARGIN + 10,
    boxY + 68,
    { width: CONTENT_W - 20 },
  );
  doc.y = boxY + 98;

  // Status row
  doc.fillColor(paid ? "#1d5730" : "#8b4513").fontSize(9).font("Helvetica-Bold");
  doc.text(
    `${paid ? "PAID" : "AWAITING PAYMENT"} · ${order.paymentMethod || "invoice"} · ${lines.length} line(s) · Total ${money(order.totals?.total)}`,
    MARGIN,
    doc.y,
  );
  doc.y += 18;

  if (order.notes) {
    const noteY = doc.y;
    doc.fillColor("#fff8e6").rect(MARGIN, noteY, CONTENT_W, 40).fill();
    doc.strokeColor("#e6c84a").rect(MARGIN, noteY, CONTENT_W, 40).stroke();
    doc.fillColor("#5b4a00").fontSize(8).font("Helvetica-Bold").text("STOCKIST NOTES", MARGIN + 8, noteY + 6);
    doc.font("Helvetica").fontSize(9).text(order.notes, MARGIN + 8, noteY + 18, { width: CONTENT_W - 16 });
    doc.y = noteY + 48;
  }

  doc.fillColor(BRAND).fontSize(10).font("Helvetica-Bold").text("Items to pick", MARGIN, doc.y);
  doc.y += 12;
  drawPickTable(doc, lines);

  doc.fillColor(MUTED).fontSize(8).font("Helvetica").text(
    "Tick each line when picked. Pack securely. Dispatch after payment confirmed unless on credit terms.",
    MARGIN,
    doc.y + 8,
    { width: CONTENT_W },
  );

  return pdfBuffer(doc);
}

module.exports = {
  generateInvoicePdf,
  generateFulfillmentPdf,
  expandOrderLines,
};