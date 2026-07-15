function bankDetails() {
  const name = process.env.BANK_ACCOUNT_NAME || "LL PYT LTD";
  const bsb = process.env.BANK_BSB || "734216";
  const account = process.env.BANK_ACCOUNT_NUMBER || "740617";
  const payId = process.env.BANK_PAY_ID || "0431892625";
  return {
    accountName: name,
    bsb,
    accountNumber: account,
    payId,
    configured: Boolean(bsb && account),
  };
}

/** Short ref for bank payments, e.g. LL0715A3F2 (10 chars — easy to type). */
function invoiceNumber(orderOrId, createdAt) {
  if (orderOrId && typeof orderOrId === "object" && orderOrId.invoiceNumber) {
    return orderOrId.invoiceNumber;
  }
  const orderId = typeof orderOrId === "object" ? orderOrId.id : orderOrId;
  const ts = createdAt || (typeof orderOrId === "object" ? orderOrId.createdAt : null) || Date.now();
  const d = new Date(ts);
  const mmdd =
    String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  const suffix = String(orderId || "")
    .replace(/^ord_/, "")
    .replace(/[^a-fA-F0-9]/g, "")
    .slice(-4)
    .toUpperCase();
  const tail = suffix.length === 4 ? suffix : cryptoSuffix();
  return `LL${mmdd}${tail}`;
}

function cryptoSuffix() {
  try {
    const crypto = require("crypto");
    return crypto.randomBytes(2).toString("hex").toUpperCase();
  } catch {
    return String(Date.now()).slice(-4).toUpperCase();
  }
}

function paymentReference(orderOrId) {
  return invoiceNumber(orderOrId);
}

function bankDetailsHtml(orderOrId) {
  const bank = bankDetails();
  const ref = paymentReference(orderOrId);
  if (!bank.configured) {
    return `<p>Bank transfer details will be provided on your invoice. Use <strong>Invoice No ${ref}</strong> as your payment reference.</p>`;
  }
  return `
    <p style="padding:14px;background:#f6f4ef;border-radius:8px;line-height:1.6">
      <strong>Bank transfer (EFT)</strong><br>
      To: ${bank.accountName}<br>
      BSB: ${bank.bsb}<br>
      Account: ${bank.accountNumber}<br>
      PayID: ${bank.payId}<br>
      <strong>Invoice No (reference):</strong> ${ref}
    </p>`;
}

function bankDetailsText(orderOrId) {
  const bank = bankDetails();
  const ref = paymentReference(orderOrId);
  if (!bank.configured) {
    return `Bank details on invoice. Invoice No: ${ref}`;
  }
  return [
    "Bank transfer:",
    `To: ${bank.accountName}`,
    `BSB: ${bank.bsb}`,
    `Account: ${bank.accountNumber}`,
    `PayID: ${bank.payId}`,
    `Invoice No (reference): ${ref}`,
  ].join("\n");
}

module.exports = { bankDetails, invoiceNumber, paymentReference, bankDetailsHtml, bankDetailsText };