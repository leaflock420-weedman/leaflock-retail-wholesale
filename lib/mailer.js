const nodemailer = require("nodemailer");
const { attachmentPaths } = require("./compliance-documents");
const { termsUrl, privacyUrl, refundsUrl } = require("./wholesale-terms");
const { bankDetailsHtml, bankDetailsText } = require("./bank-details");

function transport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

function wholesaleEmail() {
  return process.env.WHOLESALE_EMAIL_TO || process.env.ANALYTICS_EMAIL_TO || "info@leaflock.com.au";
}

function fromEmail() {
  return process.env.ANALYTICS_EMAIL_FROM || process.env.SMTP_USER || "info@leaflock.com.au";
}

async function sendMail({ to, subject, html, text, attachments, replyTo }) {
  const tx = transport();
  if (!tx || !to) return false;
  await tx.sendMail({
    from: fromEmail(),
    to,
    replyTo: replyTo || undefined,
    subject,
    html,
    text,
    attachments,
  });
  return true;
}

async function sendDailyReport({ subject, html }) {
  const to = process.env.ANALYTICS_EMAIL_TO || process.env.SMTP_USER;
  if (!to) {
    console.warn("[analytics] Email not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS, ANALYTICS_EMAIL_TO");
    return false;
  }
  return sendMail({ to, subject, html });
}

async function notifyAdminNewApplication(app) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px">
      <h2 style="color:#1d5730">New retail stockist wholesale application</h2>
      <p><strong>${app.businessName}</strong> — ${app.fullName}</p>
      <ul>
        <li>Email: ${app.email}</li>
        <li>ABN: ${app.abn}</li>
        ${app.storeReg ? `<li>Business licence / reg: ${app.storeReg}</li>` : ""}
        <li>Bulk supply: ${app.bulk}</li>
      </ul>
      <p>${app.notes || "No notes"}</p>
      <p><a href="${portalUrl}/admin/">Approve in admin dashboard → Wholesale</a></p>
    </div>`;
  return sendMail({
    to: wholesaleEmail(),
    subject: `New wholesale application — ${app.businessName}`,
    html,
    text: `New application from ${app.businessName} (${app.email}). Approve at ${portalUrl}/admin/`,
  });
}

function passwordSetupUrl(token) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  return `${portalUrl}/set-password.html?token=${encodeURIComponent(token)}`;
}

async function notifyRetailStockistApproved({ app, setupToken }) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  const setupUrl = passwordSetupUrl(setupToken);
  const forgotUrl = `${portalUrl}/forgot-password.html`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.55">
      <h2 style="color:#1d5730">LeafLock wholesale access approved</h2>
      <p>Hi ${app.fullName},</p>
      <p>Your wholesale account for <strong>${app.businessName}</strong> is approved.</p>
      <p>Create your <strong>private password</strong>, then sign in anytime to view pricing and place orders.</p>
      <p style="padding:14px;background:#eaf5ed;border-radius:8px">
        <a href="${setupUrl}" style="font-weight:700;color:#1d5730">Set your portal password →</a>
      </p>
      <p>Login email: <strong>${app.email}</strong><br>
      Portal: <a href="${portalUrl}/portal.html">${portalUrl}/portal.html</a><br>
      Forgot password later? <a href="${forgotUrl}">${forgotUrl}</a></p>
      <p>Setup link expires in 48 hours. Questions? Reply to info@leaflock.com.au</p>
    </div>`;
  return sendMail({
    to: app.email,
    subject: "Your LeafLock wholesale account is approved — set your password",
    html,
    text: `Approved for ${app.businessName}. Set password: ${setupUrl}. Login: ${app.email} at ${portalUrl}/portal.html Forgot: ${forgotUrl}`,
  });
}

async function notifyPasswordReset({ retailStockist, resetToken }) {
  const resetUrl = passwordSetupUrl(resetToken);
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.55">
      <h2 style="color:#1d5730">Reset your LeafLock wholesale password</h2>
      <p>Hi,</p>
      <p>We received a request to reset the password for <strong>${retailStockist.businessName}</strong> (${retailStockist.email}).</p>
      <p style="padding:14px;background:#eaf5ed;border-radius:8px">
        <a href="${resetUrl}" style="font-weight:700;color:#1d5730">Choose a new password →</a>
      </p>
      <p>If you did not request this, ignore this email. The link expires in 48 hours.</p>
    </div>`;
  return sendMail({
    to: retailStockist.email,
    subject: "Reset your LeafLock wholesale password",
    html,
    text: `Reset password for ${retailStockist.businessName}: ${resetUrl}`,
  });
}

async function sendCompliancePack({ to, retailStockistName, contactName }) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  const files = attachmentPaths();
  if (!files.length) {
    console.warn("[mail] compliance pack: no document files on disk");
    return false;
  }

  const name = contactName || "there";
  const business = retailStockistName || "your retail stockist";
  const attachmentList = files
    .map((f) => `<li>${f.label}</li>`)
    .join("");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.55">
      <h2 style="color:#1d5730;margin:0 0 12px">LeafLock wholesale compliance documents</h2>
      <p>Hi ${name},</p>
      <p>As requested, please find attached the compliance documents for <strong>${business}</strong>.</p>
      <p><strong>Attached (${files.length} files):</strong></p>
      <ul>${attachmentList}</ul>
      <p><strong>Next steps</strong></p>
      <ol>
        <li>Review the Stockist NDA &amp; Confidentiality Agreement, sign, and return to <a href="mailto:info@leaflock.com.au">info@leaflock.com.au</a>.</li>
        <li>Read the Master Compliance Pack for DIY Gummy Mix handling and wholesale obligations.</li>
        <li>Keep all materials confidential — for approved wholesale accounts only.</li>
      </ol>
      <p>Questions? Reply to this email or call 0431 295 201.</p>
      <p style="color:#5c6963;font-size:13px;margin-top:24px">LeafLock &amp; Co Pty Ltd · Surfers Paradise, QLD · LeafLock<sup>TM</sup></p>
    </div>`;

  const text = [
    `Hi ${name},`,
    "",
    `Attached compliance documents for ${business}:`,
    ...files.map((f) => `- ${f.label}`),
    "",
    "1. Review and return the signed Stockist NDA to info@leaflock.com.au",
    "2. Read the Master Compliance Pack",
    `3. Portal access: ${portalUrl}/portal.html`,
    "",
    "LeafLock & Co Pty Ltd",
  ].join("\n");

  return sendMail({
    to,
    subject: `LeafLock compliance documents — ${business}`,
    html,
    text,
    attachments: files.map((f) => ({
      filename: f.filename,
      path: f.path,
      contentType: "application/pdf",
    })),
  });
}

function emailConfigured() {
  return Boolean(transport() && wholesaleEmail());
}

function money(value) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value || 0);
}

function orderLineSummary(order) {
  const li = order.lineItems || {};
  const parts = [];
  if (li.gummyIndividual) parts.push(`${li.gummyIndividual}× 90g gummy mix`);
  if (li.mixedCartons) parts.push(`${li.mixedCartons}× mixed carton (24)`);
  if (li.singlePacks) parts.push(`${li.singlePacks}× humidity singles`);
  if (li.threePacks) parts.push(`${li.threePacks}× humidity 3-packs`);
  if (li.starterBundle) parts.push("Starter retail bundle");
  if (li.catalog && typeof li.catalog === "object") {
    for (const [sku, qty] of Object.entries(li.catalog)) {
      if (Number(qty) > 0) parts.push(`${qty}× ${sku}`);
    }
  }
  if (order.flavours) parts.push(`Flavours: ${order.flavours}`);
  return parts.length ? parts.join(" · ") : "See admin dashboard for line items";
}

async function notifyAdminNewOrder({ order, statusLabel = "New wholesale order" }) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  const contact = order.contact || {};
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.55">
      <h2 style="color:#1d5730;margin:0 0 12px">${statusLabel}</h2>
      <p><strong>${order.retailStockistName || contact.businessName || "Store"}</strong></p>
      <p style="padding:14px;background:#eaf5ed;border-radius:8px">
        <strong>Order:</strong> ${order.id}<br>
        <strong>Invoice No:</strong> ${order.invoiceNumber || order.id}<br>
        <strong>Source:</strong> ${order.source || "portal"}<br>
        <strong>Status:</strong> ${order.status || "submitted"} / ${order.paymentStatus || "unpaid"}<br>
        <strong>Payment:</strong> ${order.paymentMethod || "invoice"}<br>
        <strong>Total inc GST:</strong> ${money(order.totals?.total)}<br>
        <strong>Items:</strong> ${orderLineSummary(order)}
      </p>
      <ul>
        <li>Contact: ${contact.fullName || "—"}</li>
        <li>Email: ${contact.email || "—"}</li>
        <li>Phone: ${contact.phone || "—"}</li>
        <li>Address: ${contact.address || "—"}</li>
      </ul>
      ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ""}
      <p><a href="${portalUrl}/admin/">Open admin dashboard</a></p>
    </div>`;

  const text = [
    `${statusLabel}: ${order.id}`,
    order.retailStockistName || contact.businessName,
    orderLineSummary(order),
    `Total: ${money(order.totals?.total)}`,
    `${contact.fullName} · ${contact.email}`,
  ].join("\n");

  return sendMail({
    to: wholesaleEmail(),
    replyTo: contact.email || undefined,
    subject: `${statusLabel} — ${contact.businessName || order.retailStockistName} (${order.id})`,
    html,
    text,
  });
}

async function notifyOrderConfirmation({ order, contactEmail }) {
  const to = contactEmail || order.contact?.email;
  if (!to) return false;

  const method = order.paymentMethod || "invoice";
  const paymentBlock =
    method === "bank_transfer"
      ? `${bankDetailsHtml(order.id)}<p>Please pay by bank transfer using the reference above. We will email a tax invoice for your Xero records.</p>`
      : method === "invoice"
        ? `<p>We will email your tax invoice shortly for your records (Xero, MYOB, etc.). Pay by bank transfer or as instructed on the invoice.</p>${bankDetailsHtml(order.id)}`
        : `<p>Payment received via PayPal. A receipt and invoice summary are on file.</p>`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.55">
      <h2 style="color:#1d5730;margin:0 0 12px">LeafLock™ wholesale order confirmation</h2>
      <p>Hi ${order.contact?.fullName || "there"},</p>
      <p>We have received your wholesale order for <strong>${order.retailStockistName || order.contact?.businessName}</strong>.</p>
      <p style="padding:14px;background:#eaf5ed;border-radius:8px">
        <strong>Order reference:</strong> ${order.id}<br>
        <strong>Invoice No:</strong> ${order.invoiceNumber || order.id}<br>
        <strong>Payment method:</strong> ${method === "bank_transfer" ? "Bank transfer (EFT)" : method === "paypal" ? "PayPal" : "Invoice / EFT"}<br>
        <strong>Payment terms:</strong> ${order.paymentTerms || "Prepaid — payment in full before dispatch"}<br>
        <strong>Total inc GST:</strong> ${money(order.totals?.total)}<br>
        <strong>Items:</strong> ${orderLineSummary(order)}
      </p>
      ${paymentBlock}
      <p>Dispatch occurs after payment is received in full unless alternate credit terms have been approved in writing.</p>
      <p><strong>Wholesale Terms &amp; Conditions:</strong> <a href="${termsUrl()}">${termsUrl()}</a></p>
      <p style="font-size:13px;color:#5c6963">
        <a href="${privacyUrl()}">Privacy Policy</a> · <a href="${refundsUrl()}">Refunds &amp; Returns</a>
      </p>
      <p>Questions? Reply to this email or contact info@leaflock.com.au · 0431 295 201.</p>
      <p style="color:#5c6963;font-size:13px;margin-top:24px">LeafLock &amp; Co Pty Ltd · Surfers Paradise, QLD · LeafLock<sup>TM</sup><br>Retention of title applies until paid in full.</p>
    </div>`;

  const text = [
    `Order ${order.id} confirmed for ${order.retailStockistName}.`,
    `Payment: ${method}`,
    `Payment terms: ${order.paymentTerms}`,
    `Total: ${money(order.totals?.total)}`,
    bankDetailsText(order.id),
    `Terms: ${termsUrl()}`,
  ].join("\n");

  return sendMail({
    to,
    subject: `LeafLock order confirmation — ${order.id}`,
    html,
    text,
  });
}

async function notifyAdminCreditApplication(app) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px">
      <h2 style="color:#1d5730">New wholesale credit application</h2>
      <p><strong>${app.businessName}</strong> — ABN ${app.abn}</p>
      <ul>
        <li>Requested: ${app.requestedTerms}</li>
        <li>Director: ${app.directorName} (${app.directorEmail})</li>
        <li>Signed: ${app.signatureName}</li>
      </ul>
      <p>${app.notes || "No notes"}</p>
      <p><a href="${portalUrl}/admin/">Review in admin</a></p>
    </div>`;
  return sendMail({
    to: wholesaleEmail(),
    subject: `Credit application — ${app.businessName} (${app.requestedTerms})`,
    html,
    text: `Credit app from ${app.businessName} for ${app.requestedTerms}`,
  });
}

module.exports = {
  sendDailyReport,
  notifyAdminNewApplication,
  notifyRetailStockistApproved,
  /** @deprecated */

  notifyPasswordReset,
  sendCompliancePack,
  notifyOrderConfirmation,
  notifyAdminNewOrder,
  notifyAdminCreditApplication,
  emailConfigured,
  wholesaleEmail,
  passwordSetupUrl,
};