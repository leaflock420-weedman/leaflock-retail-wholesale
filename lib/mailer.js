const nodemailer = require("nodemailer");
const fs = require("fs/promises");
const { attachmentPaths } = require("./compliance-documents");
const { termsUrl, privacyUrl, refundsUrl } = require("./wholesale-terms");
const { bankDetailsHtml, bankDetailsText } = require("./bank-details");
const { generateInvoicePdf, generateFulfillmentPdf } = require("./order-pdf");
const { expandOrderLines } = require("./order-lines");

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
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

function wholesaleEmail() {
  return process.env.WHOLESALE_EMAIL_TO || process.env.ANALYTICS_EMAIL_TO || "info+retail@leaflock.com.au";
}

function fromEmail() {
  return process.env.ANALYTICS_EMAIL_FROM || process.env.SMTP_USER || "info@leaflock.com.au";
}

async function sendMail({ to, subject, html, text, attachments, replyTo }) {
  if (process.env.RESEND_API_KEY) {
    const resendAttachments = await Promise.all(
      (attachments || []).map(async (attachment) => ({
        filename: attachment.filename,
        content: Buffer.isBuffer(attachment.content)
          ? attachment.content.toString("base64")
          : attachment.content
            ? Buffer.from(attachment.content).toString("base64")
            : (await fs.readFile(attachment.path)).toString("base64"),
      })),
    );
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `LeafLock Wholesale <${fromEmail()}>`,
        to: Array.isArray(to) ? to : [to],
        reply_to: replyTo || undefined,
        subject,
        html,
        text,
        attachments: resendAttachments.length ? resendAttachments : undefined,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend email failed (${response.status}): ${detail.slice(0, 300)}`);
    }
    return true;
  }
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

function passwordSetupUrl({ token, email } = {}) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  if (token) return `${portalUrl}/set-password.html?token=${encodeURIComponent(token)}`;
  if (email) return `${portalUrl}/set-password.html?email=${encodeURIComponent(email)}`;
  return `${portalUrl}/set-password.html`;
}

function stockistWelcomeHtml({ name, businessName, email, setupUrl, portalLoginUrl, forgotUrl, passwordReady }) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const intro =
    "Welcome to LeafLock Wholesale. I'm grateful for your interest in wanting to stock our range of products.";

  if (passwordReady) {
    return `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.6">
      <h2 style="color:#1d5730;margin:0 0 16px">Welcome to LeafLock Wholesale</h2>
      <p>${greeting}</p>
      <p>${intro}</p>
      <p>Your account for <strong>${businessName}</strong> is ready. Sign in with the password you chose to view pricing and place orders.</p>
      <p style="margin:24px 0;padding:16px 20px;background:#eaf5ed;border-radius:8px;text-align:center">
        <a href="${portalLoginUrl}" style="display:inline-block;padding:12px 24px;background:#1d5730;color:#fff;text-decoration:none;font-weight:700;border-radius:6px">Sign in to the portal</a>
      </p>
      <p style="font-size:14px;color:#5c6963">Login email: <strong>${email}</strong><br>
      Forgot password? <a href="${forgotUrl}" style="color:#1d5730">${forgotUrl}</a></p>
      <p style="font-size:14px;color:#5c6963;margin-top:24px">Questions? Reply to this email or contact info@leaflock.com.au</p>
      <p style="font-size:12px;color:#8a9690;margin-top:20px">LeafLock &amp; Co Pty Ltd · Surfers Paradise, QLD</p>
    </div>`;
  }

  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.6">
      <h2 style="color:#1d5730;margin:0 0 16px">Welcome to LeafLock Wholesale</h2>
      <p>${greeting}</p>
      <p>${intro}</p>
      <p>Please create your password for easy wholesale ordering — then sign in anytime to view pricing and submit orders for <strong>${businessName}</strong>.</p>
      <p style="margin:24px 0;padding:16px 20px;background:#eaf5ed;border-radius:8px;text-align:center">
        <a href="${setupUrl}" style="display:inline-block;padding:12px 24px;background:#1d5730;color:#fff;text-decoration:none;font-weight:700;border-radius:6px">Create your portal password</a>
      </p>
      <p style="font-size:14px;color:#5c6963">Login email: <strong>${email}</strong><br>
      Portal: <a href="${portalLoginUrl}" style="color:#1d5730">${portalLoginUrl}</a><br>
      Link expires in 48 hours. Forgot password later? <a href="${forgotUrl}" style="color:#1d5730">${forgotUrl}</a></p>
      <p style="font-size:14px;color:#5c6963;margin-top:24px">Questions? Reply to this email or contact info@leaflock.com.au</p>
      <p style="font-size:12px;color:#8a9690;margin-top:20px">LeafLock &amp; Co Pty Ltd · Surfers Paradise, QLD</p>
    </div>`;
}

async function notifyRetailStockistApproved({ app, setupToken, passwordReady }) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  const portalLoginUrl = `${portalUrl}/portal.html?email=${encodeURIComponent(app.email)}`;
  const forgotUrl = `${portalUrl}/forgot-password.html`;
  const setupUrl = setupToken ? passwordSetupUrl({ token: setupToken, email: app.email }) : null;

  const html = stockistWelcomeHtml({
    name: app.fullName || app.contactName,
    businessName: app.businessName,
    email: app.email,
    setupUrl,
    portalLoginUrl,
    forgotUrl,
    passwordReady: passwordReady || !setupToken,
  });

  const subject = passwordReady || !setupToken
    ? `Welcome to LeafLock Wholesale — ${app.businessName}`
    : `Welcome to LeafLock Wholesale — create your password`;

  const text = passwordReady || !setupToken
    ? [
        "Welcome to LeafLock Wholesale.",
        "I'm grateful for your interest in wanting to stock our range of products.",
        `Sign in at ${portalLoginUrl}`,
        `Email: ${app.email}`,
      ].join("\n")
    : [
        "Welcome to LeafLock Wholesale.",
        "I'm grateful for your interest in wanting to stock our range of products.",
        "Please create your password for easy wholesale ordering.",
        `Set password: ${setupUrl}`,
        `Email: ${app.email}`,
      ].join("\n");

  return sendMail({ to: app.email, subject, html, text });
}

async function notifyNewStockistWelcome({ retailStockist, setupToken }) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  const email = retailStockist.email;
  const portalLoginUrl = `${portalUrl}/portal.html?email=${encodeURIComponent(email)}`;
  const forgotUrl = `${portalUrl}/forgot-password.html`;
  const setupUrl = passwordSetupUrl({ token: setupToken, email });

  const html = stockistWelcomeHtml({
    name: retailStockist.contactName,
    businessName: retailStockist.businessName,
    email,
    setupUrl,
    portalLoginUrl,
    forgotUrl,
    passwordReady: false,
  });

  return sendMail({
    to: email,
    subject: `Welcome to LeafLock Wholesale — create your password`,
    html,
    text: [
      "Welcome to LeafLock Wholesale.",
      "I'm grateful for your interest in wanting to stock our range of products.",
      "Please create your password for easy wholesale ordering.",
      `Set password: ${setupUrl}`,
      `Email: ${email}`,
    ].join("\n"),
  });
}

async function notifyTemporaryPasswordReset({ retailStockist, temporaryPassword }) {
  const portalUrl = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
  const portalLoginUrl = `${portalUrl}/portal.html?email=${encodeURIComponent(retailStockist.email)}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.55">
      <h2 style="color:#1d5730">Your LeafLock wholesale password has been reset</h2>
      <p>Hi,</p>
      <p>Use this <strong>temporary password</strong> to sign in for <strong>${retailStockist.businessName}</strong>:</p>
      <p style="padding:16px;background:#fff8e6;border:2px solid #e6c84a;border-radius:8px;font-size:1.2rem;line-height:1.6">
        <strong>Temporary password:</strong><br>
        <span style="font-size:1.5rem;font-weight:900;letter-spacing:0.08em;color:#1d5730">${temporaryPassword}</span>
      </p>
      <p style="padding:14px;background:#eaf5ed;border-radius:8px">
        <a href="${portalLoginUrl}" style="font-weight:700;color:#1d5730">Sign in to the wholesale portal →</a>
      </p>
      <p>Login email: <strong>${retailStockist.email}</strong></p>
      <p>After you sign in, you will be asked to choose a <strong>new private password</strong> immediately. That becomes your password going forward.</p>
      <p>If you did not request this, contact info@leaflock.com.au.</p>
    </div>`;
  return sendMail({
    to: retailStockist.email,
    subject: `LeafLock wholesale — temporary password (${retailStockist.businessName})`,
    html,
    text: [
      `Temporary password for ${retailStockist.businessName}: ${temporaryPassword}`,
      `Sign in at ${portalLoginUrl}`,
      `Email: ${retailStockist.email}`,
      "You will be prompted to choose a new password immediately after signing in.",
    ].join("\n"),
  });
}

async function notifyPasswordReset({ retailStockist, resetToken }) {
  const resetUrl = passwordSetupUrl({ token: resetToken, email: retailStockist.email });
  const portalLoginUrl = `${process.env.SITE_URL || "https://www.wholesale.leaflock.com.au"}/portal.html?email=${encodeURIComponent(retailStockist.email)}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.55">
      <h2 style="color:#1d5730">Reset your LeafLock wholesale password</h2>
      <p>Hi,</p>
      <p>Reset the password for <strong>${retailStockist.businessName}</strong> (${retailStockist.email}).</p>
      <p style="padding:14px;background:#eaf5ed;border-radius:8px">
        <a href="${resetUrl}" style="font-weight:700;color:#1d5730">Create your new password →</a>
      </p>
      <p>Click the button, enter your new password once, then sign in at the portal.</p>
      <p>Sign in after reset: <a href="${portalLoginUrl}">${portalLoginUrl}</a></p>
      <p>If you did not request this, ignore this email. Link expires in 48 hours.</p>
    </div>`;
  return sendMail({
    to: retailStockist.email,
    subject: "Reset your LeafLock wholesale password",
    html,
    text: [
      `Reset password for ${retailStockist.businessName}.`,
      `Create new password: ${resetUrl}`,
      `Then sign in: ${portalLoginUrl}`,
      `Email: ${retailStockist.email}`,
    ].join("\n"),
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
  return Boolean((process.env.RESEND_API_KEY || transport()) && wholesaleEmail());
}

async function verifyEmailTransport() {
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Resend API returned ${response.status}`);
      return { ok: true, provider: "resend" };
    } catch (err) {
      return { ok: false, provider: "resend", error: err.message };
    }
  }
  const tx = transport();
  if (!tx) return { ok: false, error: "SMTP credentials are not configured" };
  try {
    await tx.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    tx.close();
  }
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

function orderLinesTableHtml(order) {
  const lines = expandOrderLines(order);
  if (!lines.length) return "<p>No line items</p>";
  const rows = lines
    .map(
      (line) =>
        `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e8ece9;text-align:center;font-weight:700">${line.qty}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e8ece9;font-family:monospace;font-size:12px">${line.sku}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e8ece9">${line.name}</td>
        </tr>`,
    )
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
      <thead>
        <tr style="background:#1d5730;color:#fff">
          <th style="padding:8px 10px;text-align:center;width:48px">Qty</th>
          <th style="padding:8px 10px;text-align:left;width:90px">SKU</th>
          <th style="padding:8px 10px;text-align:left">Product</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function notifyAdminNewOrder({ order, statusLabel = "New wholesale order" }) {
  const contact = order.contact || {};
  const inv = order.invoiceNumber || order.id;
  const store = order.retailStockistName || contact.businessName || "Store";
  const paid = order.paymentStatus === "paid";

  let fulfillmentPdf;
  try {
    fulfillmentPdf = await generateFulfillmentPdf(order);
  } catch (err) {
    console.warn("[mail] fulfillment PDF:", err.message);
  }

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.5">
      <h2 style="color:#1d5730;margin:0 0 8px;font-size:20px">Warehouse order — ${inv}</h2>
      <p style="margin:0 0 16px;color:#5c6963;font-size:14px">${statusLabel}</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
        <tr><td style="padding:6px 0;color:#5c6963;width:120px">Stockist</td><td style="padding:6px 0;font-weight:700">${store}</td></tr>
        <tr><td style="padding:6px 0;color:#5c6963">Ref</td><td style="padding:6px 0;font-weight:700;font-family:monospace">${inv}</td></tr>
        <tr><td style="padding:6px 0;color:#5c6963">Payment</td><td style="padding:6px 0">${paid ? "✓ Paid" : "Awaiting payment"} · ${order.paymentMethod || "invoice"}</td></tr>
        <tr><td style="padding:6px 0;color:#5c6963">Total</td><td style="padding:6px 0;font-weight:700">${money(order.totals?.total)} inc GST</td></tr>
        <tr><td style="padding:6px 0;color:#5c6963;vertical-align:top">Ship to</td><td style="padding:6px 0">${contact.address || "—"}<br><span style="color:#5c6963;font-size:13px">${contact.fullName || ""} · ${contact.phone || ""}</span></td></tr>
      </table>

      ${order.notes ? `<p style="padding:12px 14px;background:#fff8e6;border-left:4px solid #e6c84a;margin:0 0 16px;font-size:14px"><strong>Notes:</strong> ${order.notes}</p>` : ""}

      <h3 style="color:#1d5730;font-size:15px;margin:0 0 4px">Pick list</h3>
      ${orderLinesTableHtml(order)}

      <p style="font-size:14px;color:#5c6963;margin:16px 0 0">
        <strong>Attached:</strong> ${inv}-pick-pack.pdf — print or forward to warehouse.
      </p>
    </div>`;

  const lines = expandOrderLines(order);
  const text = [
    `WAREHOUSE ORDER ${inv}`,
    store,
    `Ship to: ${contact.address || "—"}`,
    `${contact.fullName || ""} · ${contact.phone || ""}`,
    paid ? "PAID" : "AWAITING PAYMENT",
    `Total: ${money(order.totals?.total)}`,
    "",
    "PICK LIST:",
    ...lines.map((l) => `${l.qty}x ${l.sku} — ${l.name}`),
    order.notes ? `\nNotes: ${order.notes}` : "",
    fulfillmentPdf ? "\n(Pick & pack PDF attached)" : "",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const attachments = fulfillmentPdf
    ? [{ filename: `${inv}-pick-pack.pdf`, content: fulfillmentPdf, contentType: "application/pdf" }]
    : undefined;

  return sendMail({
    to: wholesaleEmail(),
    replyTo: contact.email || undefined,
    subject: `Warehouse — ${inv} — ${store}`,
    html,
    text,
    attachments,
  });
}

async function notifyOrderConfirmation({ order, contactEmail }) {
  const to = contactEmail || order.contact?.email;
  if (!to) return false;

  const method = order.paymentMethod || "invoice";
  const inv = order.invoiceNumber || order.id;
  let invoicePdf;
  try {
    invoicePdf = await generateInvoicePdf(order);
  } catch (err) {
    console.warn("[mail] invoice PDF:", err.message);
  }

  const paymentBlock =
    method === "bank_transfer"
      ? `${bankDetailsHtml(order)}<p>Please pay by bank transfer using <strong>Invoice No ${inv}</strong> as your payment reference. Your detailed tax invoice is attached.</p>`
      : method === "invoice"
        ? `<p>Your detailed tax invoice is <strong>attached to this email</strong> (PDF) for your records — Xero, MYOB, etc. Pay by bank transfer using the details below.</p>${bankDetailsHtml(order)}`
        : `<p>Payment received via PayPal. Your tax invoice PDF is attached for your records.</p>`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px;line-height:1.55">
      <h2 style="color:#1d5730;margin:0 0 12px">LeafLock™ wholesale order confirmation</h2>
      <p>Hi ${order.contact?.fullName || "there"},</p>
      <p>We have received your wholesale order for <strong>${order.retailStockistName || order.contact?.businessName}</strong>.</p>
      <p style="padding:14px;background:#eaf5ed;border-radius:8px">
        <strong>Order reference:</strong> ${order.id}<br>
        <strong>Invoice No:</strong> ${inv}<br>
        <strong>Payment method:</strong> ${method === "bank_transfer" ? "Bank transfer (EFT)" : method === "paypal" ? "PayPal" : "Invoice / EFT"}<br>
        <strong>Payment terms:</strong> ${order.paymentTerms || "Prepaid — payment in full before dispatch"}<br>
        <strong>Total inc GST:</strong> ${money(order.totals?.total)}<br>
        <strong>Items:</strong> ${orderLineSummary(order)}
      </p>
      <p><strong>Attached:</strong> ${inv}-invoice.pdf — line-by-line tax invoice with payment details.</p>
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
    `Invoice No: ${inv}`,
    `Payment: ${method}`,
    `Payment terms: ${order.paymentTerms}`,
    `Total: ${money(order.totals?.total)}`,
    invoicePdf ? `Attached: ${inv}-invoice.pdf` : "",
    bankDetailsText(order),
    `Terms: ${termsUrl()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const attachments = invoicePdf
    ? [
        {
          filename: `${inv}-invoice.pdf`,
          content: invoicePdf,
          contentType: "application/pdf",
        },
      ]
    : undefined;

  return sendMail({
    to,
    subject: `LeafLock order confirmation — ${inv}`,
    html,
    text,
    attachments,
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
  notifyNewStockistWelcome,
  /** @deprecated */

  notifyTemporaryPasswordReset,
  notifyPasswordReset,
  sendCompliancePack,
  notifyOrderConfirmation,
  notifyAdminNewOrder,
  notifyAdminCreditApplication,
  emailConfigured,
  verifyEmailTransport,
  wholesaleEmail,
  passwordSetupUrl,
};
