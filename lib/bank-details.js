function bankDetails() {
  const name = process.env.BANK_ACCOUNT_NAME || "LeafLock & Co Pty Ltd";
  const bsb = process.env.BANK_BSB || "";
  const account = process.env.BANK_ACCOUNT_NUMBER || "";
  const bank = process.env.BANK_NAME || "";
  const prefix = process.env.BANK_REFERENCE_PREFIX || "LL";
  return {
    accountName: name,
    bsb,
    accountNumber: account,
    bankName: bank,
    referencePrefix: prefix,
    configured: Boolean(bsb && account),
  };
}

function paymentReference(orderId) {
  const { referencePrefix } = bankDetails();
  const id = String(orderId || "").replace(/^ord_/, "").slice(-8).toUpperCase();
  return `${referencePrefix}-${id}`;
}

function bankDetailsHtml(orderId) {
  const bank = bankDetails();
  if (!bank.configured) {
    return `<p>Bank transfer details will be provided on your invoice. Use order reference <strong>${paymentReference(orderId)}</strong> when paying.</p>`;
  }
  return `
    <p style="padding:14px;background:#f6f4ef;border-radius:8px;line-height:1.6">
      <strong>Bank transfer (EFT)</strong><br>
      Account name: ${bank.accountName}<br>
      ${bank.bankName ? `Bank: ${bank.bankName}<br>` : ""}
      BSB: ${bank.bsb}<br>
      Account: ${bank.accountNumber}<br>
      <strong>Reference:</strong> ${paymentReference(orderId)}
    </p>`;
}

function bankDetailsText(orderId) {
  const bank = bankDetails();
  const ref = paymentReference(orderId);
  if (!bank.configured) {
    return `Bank details on invoice. Reference: ${ref}`;
  }
  return [
    "Bank transfer:",
    `Account: ${bank.accountName}`,
    bank.bankName ? `Bank: ${bank.bankName}` : null,
    `BSB: ${bank.bsb}`,
    `Account no: ${bank.accountNumber}`,
    `Reference: ${ref}`,
  ]
    .filter(Boolean)
    .join("\n");
}

module.exports = { bankDetails, paymentReference, bankDetailsHtml, bankDetailsText };