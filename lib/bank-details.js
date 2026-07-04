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

function invoiceNumber(orderOrId, createdAt) {
  if (orderOrId && typeof orderOrId === "object" && orderOrId.invoiceNumber) {
    return orderOrId.invoiceNumber;
  }
  const orderId = typeof orderOrId === "object" ? orderOrId.id : orderOrId;
  const ts = createdAt || (typeof orderOrId === "object" ? orderOrId.createdAt : null) || Date.now();
  const stamp = new Date(ts).toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = String(orderId || "")
    .replace(/^ord_/, "")
    .slice(-6)
    .toUpperCase();
  return `INV-${stamp}-${suffix}`;
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