const PDFDocument = require("pdfkit");
const { PUBLIC_COMPANY } = require("./company-public");
const { bankDetails, paymentReference } = require("./bank-details");
const { expandOrderLines, money } = require("./order-lines");

const BRAND = "#1d5730";
const MUTED = "#5c6963";
const LINE = "#d8e0da";

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

function drawHeader(doc, title) {
  doc.fillColor(BRAND).fontSize(20).font("Helvetica-Bold").text("LeafLock™ Wholesale", 50, 45);
  doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(PUBLIC_COMPANY.legalName, 50, 68);
  doc.text(`ACN ${PUBLIC_COMPANY.acn} · Surfers Paradise, QLD 4217`, 50, 80);
  doc.fillColor(BRAND).fontSize(16).font("Helvetica-Bold").text(title, 50, 108);
  doc.moveTo(50, 128).lineTo(545, 128).strokeColor(LINE).stroke();
  doc.y = 140;
}

function drawMetaBlock(doc, rows, x, width) {
  const startY = doc.y;
  let y = startY;
  for (const [label, value] of rows) {
    doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text(label, x, y, { width });
    doc.fillColor("#17211d").fontSize(10).font("Helvetica").text(String(value || "—"), x, y + 11, { width });
    y += 30;
  }
  doc.y = Math.max(doc.y, y);
  return startY;
}

function drawLineTable(doc, lines, { pickPack = false } = {}) {
  const tableTop = doc.y + 8;
  const cols = pickPack
    ? [
        { label: "Pick", width: 28, align: "center" },
        { label: "SKU", width: 62 },
        { label: "Product", width: 200 },
        { label: "Qty", width: 40, align: "right" },
        { label: "Unit ex GST", width: 72, align: "right" },
        { label: "Line ex GST", width: 72, align: "right" },
      ]
    : [
        { label: "SKU", width: 70 },
        { label: "Description", width: 230 },
        { label: "Qty", width: 40, align: "right" },
        { label: "Unit ex GST", width: 72, align: "right" },
        { label: "Line ex GST", width: 72, align: "right" },
      ];

  let x = 50;
  doc.fillColor(BRAND).fontSize(8).font("Helvetica-Bold");
  for (const col of cols) {
    doc.text(col.label, x, tableTop, { width: col.width, align: col.align || "left" });
    x += col.width;
  }

  let y = tableTop + 16;
  doc.font("Helvetica").fontSize(9).fillColor("#17211d");

  for (const line of lines) {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    x = 50;
    const rowValues = pickPack
      ? ["☐", line.sku, line.name, String(line.qty), money(line.unitWholesale), money(line.lineTotal)]
      : [line.sku, line.name, String(line.qty), money(line.unitWholesale), money(line.lineTotal)];

    rowValues.forEach((value, i) => {
      const col = cols[i];
      doc.text(value, x, y, { width: col.width, align: col.align || "left" });
      x += col.width;
    });
    y += 18;
  }

  doc.y = y + 10;
}

function drawTotals(doc, order) {
  const totals = order.totals || {};
  const xLabel = 360;
  const xValue = 470;
  let y = doc.y + 6;

  doc.moveTo(50, y).lineTo(545, y).strokeColor(LINE).stroke();
  y += 12;

  const rows = [
    ["Subtotal ex GST", money(totals.subtotal)],
    ["GST (10%)", money(totals.gst)],
    ["Shipping", money(totals.shipping)],
    ["Total inc GST", money(totals.total)],
  ];

  for (const [label, value] of rows) {
    const bold = label.startsWith("Total");
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10);
    doc.fillColor(bold ? BRAND : "#17211d").text(label, xLabel, y, { width: 100 });
    doc.text(value, xValue, y, { width: 75, align: "right" });
    y += bold ? 20 : 16;
  }
  doc.y = y;
}

async function generateInvoicePdf(order) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const contact = order.contact || {};
  const lines = expandOrderLines(order);
  const inv = order.invoiceNumber || order.id;
  const bank = bankDetails();

  drawHeader(doc, "TAX INVOICE");

  const leftMeta = [
    ["Invoice No", inv],
    ["Order reference", order.id],
    ["Date", formatDate(order.createdAt)],
    ["Payment method", order.paymentMethod || "invoice"],
    ["Payment terms", order.paymentTerms || "Prepaid before dispatch"],
  ];
  const rightMeta = [
    ["Bill to", contact.businessName || order.retailStockistName],
    ["Contact", `${contact.fullName || ""}${contact.phone ? ` · ${contact.phone}` : ""}`],
    ["Email", contact.email],
    ["ABN", contact.abn],
    ["Delivery address", contact.address || "—"],
  ];

  const blockY = doc.y;
  drawMetaBlock(doc, leftMeta, 50, 240);
  drawMetaBlock(doc, rightMeta, 310, 235);
  doc.y = Math.max(doc.y, blockY + 120);

  doc.fillColor(BRAND).fontSize(11).font("Helvetica-Bold").text("Line items (ex GST)", 50, doc.y);
  doc.y += 14;
  drawLineTable(doc, lines);
  drawTotals(doc, order);

  if (order.notes) {
    doc.moveDown(0.5);
    doc.fillColor(BRAND).fontSize(9).font("Helvetica-Bold").text("Order notes", 50, doc.y);
    doc.fillColor("#17211d").font("Helvetica").fontSize(9).text(order.notes, 50, doc.y + 12, { width: 495 });
    doc.y += 28;
  }

  doc.moveDown(0.5);
  doc.fillColor(MUTED).fontSize(9).font("Helvetica-Bold").text("Payment — bank transfer (EFT)", 50, doc.y);
  doc.y += 12;
  if (bank.configured) {
    doc.font("Helvetica").fontSize(9).fillColor("#17211d");
    doc.text(`Account name: ${bank.accountName}`, 50, doc.y);
    doc.text(`BSB: ${bank.bsb}  ·  Account: ${bank.accountNumber}  ·  PayID: ${bank.payId}`, 50, doc.y + 12);
    doc.text(`Payment reference (Invoice No): ${paymentReference(order)}`, 50, doc.y + 24);
    doc.y += 40;
  }

  doc.fillColor(MUTED).fontSize(8).text(
    "Goods remain property of LeafLock™ until paid in full. Retention of title applies. Not medical advice.",
    50,
    doc.page.height - 60,
    { width: 495, align: "center" },
  );

  return pdfBuffer(doc);
}

async function generateFulfillmentPdf(order) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const contact = order.contact || {};
  const lines = expandOrderLines(order);
  const inv = order.invoiceNumber || order.id;

  drawHeader(doc, "WAREHOUSE PICK & PACK");

  doc.fillColor("#8b4513").fontSize(10).font("Helvetica-Bold").text("INTERNAL — print or forward to warehouse", 50, 118);
  doc.y = 140;

  const meta = [
    ["Invoice / pick No", inv],
    ["Order reference", order.id],
    ["Created", formatDate(order.createdAt)],
    ["Stockist", order.retailStockistName || contact.businessName],
    ["Ship to", contact.businessName || order.retailStockistName],
    ["Contact", `${contact.fullName || "—"} · ${contact.phone || "no phone"}`],
    ["Email", contact.email || "—"],
    ["Delivery address", contact.address || "— (confirm with stockist)"],
    ["Payment", `${order.paymentMethod || "invoice"} · ${order.paymentStatus || "unpaid"}`],
    ["Status", order.status || "submitted"],
  ];

  for (const [label, value] of meta) {
    doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text(label, 50, doc.y, { width: 120 });
    doc.fillColor("#17211d").fontSize(10).font("Helvetica").text(String(value || "—"), 170, doc.y, { width: 375 });
    doc.y += 22;
  }

  if (order.notes) {
    doc.moveDown(0.3);
    doc.rect(50, doc.y, 495, 36).fillAndStroke("#fff8e6", "#f0d78c");
    doc.fillColor("#5b4a00").fontSize(9).font("Helvetica-Bold").text("Stockist notes:", 58, doc.y + 8);
    doc.font("Helvetica").text(order.notes, 58, doc.y + 20, { width: 478 });
    doc.y += 44;
  }

  doc.moveDown(0.3);
  doc.fillColor(BRAND).fontSize(11).font("Helvetica-Bold").text("Items to pick", 50, doc.y);
  doc.y += 14;
  drawLineTable(doc, lines, { pickPack: true });
  drawTotals(doc, order);

  doc.moveDown(0.8);
  doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(
    "Check each line, pack securely, and mark despatched in admin when complete.",
    50,
    doc.y,
    { width: 495 },
  );

  return pdfBuffer(doc);
}

module.exports = {
  generateInvoicePdf,
  generateFulfillmentPdf,
  expandOrderLines,
};