const nodemailer = require("nodemailer");
const { attachmentPaths } = require("./compliance-documents");
const { termsUrl, privacyUrl, refundsUrl } = require("./wholesale-terms");

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

async function sendMail({ to, subject, html, text, attachments }) {
  const tx = transport();
  if (!tx || !to) return false;
  await tx.sendMail({ from: fromEmail(), to, subject, html, text, attachments });
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
      <h2 style="color:#1d5730">New retail store wholesale application</h2>
      <p><strong>${app.businessName}</strong> — ${app.fullName}</p>
      <ul>
        <li>Email: ${app.email}</li>
        <li>ABN: ${app.abn}</li>
        <li>Business licence / reg: ${app.pharmacyReg}</li>
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

async function notifyPharmacyApproved({ app, accessCode }) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px">
      <h2 style="color:#1d5730">LeafLock wholesale access approved</h2>
      <p>Hi ${app.fullName},</p>
      <p>Your wholesale account for <strong>${app.businessName}</strong> is approved.</p>
      <p style="font-size:18px;padding:14px;background:#eaf5ed;border-radius:8px"><strong>Access code:</strong> ${accessCode}</p>
      <p><a href="${portalUrl}/portal.html">Log in to the wholesale portal</a> to view pricing and place orders.</p>
      <p>Questions? Reply to info@leaflock.com.au</p>
    </div>`;
  return sendMail({
    to: app.email,
    subject: "Your LeafLock wholesale access code",
    html,
    text: `Approved! Access code: ${accessCode}. Portal: ${portalUrl}/portal.html`,
  });
}

async function sendCompliancePack({ to, pharmacyName, contactName }) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  const files = attachmentPaths();
  if (!files.length) {
    console.warn("[mail] compliance pack: no document files on disk");
    return false;
  }

  const name = contactName || "there";
  const business = pharmacyName || "your retail store";
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

async function notifyOrderConfirmation({ order, contactEmail }) {
  const to = contactEmail || order.contact?.email;
  if (!to) return false;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.55">
      <h2 style="color:#1d5730;margin:0 0 12px">LeafLock™ wholesale order confirmation</h2>
      <p>Hi ${order.contact?.fullName || "there"},</p>
      <p>We have received your wholesale order for <strong>${order.pharmacyName || order.contact?.businessName}</strong>.</p>
      <p style="padding:14px;background:#eaf5ed;border-radius:8px">
        <strong>Order reference:</strong> ${order.id}<br>
        <strong>Payment terms:</strong> ${order.paymentTerms || "Prepaid — payment in full before dispatch"}<br>
        <strong>Total inc GST:</strong> ${money(order.totals?.total)}
      </p>
      <p>Your invoice will follow separately. Dispatch occurs after payment is received in full unless alternate credit terms have been approved in writing.</p>
      <p><strong>Wholesale Terms &amp; Conditions:</strong> <a href="${termsUrl()}">${termsUrl()}</a></p>
      <p style="font-size:13px;color:#5c6963">
        <a href="${privacyUrl()}">Privacy Policy</a> · <a href="${refundsUrl()}">Refunds &amp; Returns</a>
      </p>
      <p>Questions? Reply to info@leaflock.com.au or call 0431 295 201.</p>
      <p style="color:#5c6963;font-size:13px;margin-top:24px">LeafLock &amp; Co Pty Ltd · Surfers Paradise, QLD · LeafLock<sup>TM</sup><br>Retention of title applies until paid in full.</p>
    </div>`;

  const text = [
    `Order ${order.id} confirmed for ${order.pharmacyName}.`,
    `Payment terms: ${order.paymentTerms}`,
    `Total: ${money(order.totals?.total)}`,
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
  notifyPharmacyApproved,
  sendCompliancePack,
  notifyOrderConfirmation,
  notifyAdminCreditApplication,
  emailConfigured,
  wholesaleEmail,
};