const PDFDocument = require("pdfkit");
const { PUBLIC_COMPANY } = require("./company-public");
const { bankDetails, paymentReference } = require("./bank-details");
const { expandOrderLines, money } = require("./order-lines");

const BRAND = "#1d5730";
const MUTED = "#5c6963";
const LINE = "#d8e0da";
const PAGE_W = 595;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

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

function drawInvoiceMeta(doc, order) {
  const contact = order.contact || {};
  const inv = order.invoiceNumber || order.id;

  const left = [
    ["Invoice No", inv],
    ["Order ref", order.id],
    ["Date", formatDate(order.createdAt)],
    ["Payment", order.paymentMethod || "invoice"],
  ];
  const right = [
    ["Bill to", contact.businessName || order.retailStockistName],
    ["Contact", contact.fullName || "—"],
    ["ABN", contact.abn || "—"],
    ["Deliver to", contact.address || "—"],
  ];

  let y = doc.y;
  for (const [label, value] of left) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text(label, MARGIN, y);
    doc.fillColor("#17211d").fontSize(9).font("Helvetica").text(String(value), MARGIN, y + 10, { width: 240 });
    y += 28;
  }
  let y2 = doc.y;
  for (const [label, value] of right) {
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Bold").text(label, 310, y2);
    doc.fillColor("#17211d").fontSize(9).font("Helvetica").text(String(value), 310, y2 + 10, { width: 235 });
    y2 += 28;
  }
  doc.y = Math.max(y, y2) + 8;
}

function drawPriceTable(doc, lines) {
  const cols = [
    { label: "SKU", w: 72 },
    { label: "Description", w: 228 },
    { label: "Qty", w: 36, align: "right" },
    { label: "Unit ex GST", w: 72, align: "right" },
    { label: "Line ex GST", w: 72, align: "right" },
  ];

  let y = doc.y + 4;
  doc.fillColor(BRAND).fontSize(8).font("Helvetica-Bold");
  let x = MARGIN;
  for (const col of cols) {
    doc.text(col.label, x, y, { width: col.w, align: col.align || "left" });
    x += col.w;
  }
  y += 14;
  doc.font("Helvetica").fontSize(9).fillColor("#17211d");

  for (const line of lines) {
    if (y > 700) {
      doc.addPage();
      y = MARGIN;
    }
    x = MARGIN;
    const values = [
      line.sku,
      line.name,
      String(line.qty),
      money(line.unitWholesale),
      money(line.lineTotal),
    ];
    values.forEach((val, i) => {
      const col = cols[i];
      doc.text(val, x, y, { width: col.w, align: col.align || "left", lineGap: 1 });
      x += col.w;
    });
    y += Math.max(16, doc.heightOfString(line.name, { width: 228 }) + 4);
  }
  doc.y = y + 8;
}

function drawTotals(doc, order) {
  const totals = order.totals || {};
  let y = doc.y + 4;
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(LINE).stroke();
  y += 10;

  const rows = [
    ["Subtotal ex GST", money(totals.subtotal)],
    ["GST (10%)", money(totals.gst)],
    ["Shipping", money(totals.shipping)],
    ["Total inc GST", money(totals.total)],
  ];
  for (const [label, value] of rows) {
    const bold = label.startsWith("Total");
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10);
    doc.fillColor(bold ? BRAND : "#17211d").text(label, 360, y, { width: 110 });
    doc.text(value, 470, y, { width: 75, align: "right" });
    y += bold ? 18 : 14;
  }
  doc.y = y;
}

async function generateInvoicePdf(order) {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const lines = expandOrderLines(order);
  const inv = order.invoiceNumber || order.id;
  const bank = bankDetails();
  const ref = paymentReference(order);

  drawHeader(doc, "TAX INVOICE", `Payment reference: ${ref}`);
  drawInvoiceMeta(doc, order);

  doc.fillColor(BRAND).fontSize(10).font("Helvetica-Bold").text("Line items (ex GST)", MARGIN, doc.y);
  doc.y += 12;
  drawPriceTable(doc, lines);
  drawTotals(doc, order);

  if (order.notes) {
    doc.moveDown(0.4);
    doc.fillColor(BRAND).fontSize(8).font("Helvetica-Bold").text("Notes", MARGIN, doc.y);
    doc.fillColor("#17211d").font("Helvetica").fontSize(9).text(order.notes, MARGIN, doc.y + 10, { width: CONTENT_W });
    doc.y += 24;
  }

  if (bank.configured) {
    doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text("Bank transfer", MARGIN, doc.y);
    doc.font("Helvetica").fontSize(9).fillColor("#17211d");
    doc.text(`${bank.accountName} · BSB ${bank.bsb} · Acc ${bank.accountNumber} · PayID ${bank.payId}`, MARGIN, doc.y + 10, {
      width: CONTENT_W,
    });
    doc.text(`Reference: ${ref}`, MARGIN, doc.y + 22);
  }

  doc.fillColor(MUTED).fontSize(7).text(
    "Goods remain property of LeafLock™ until paid in full.",
    MARGIN,
    doc.page.height - 50,
    { width: CONTENT_W, align: "center" },
  );

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