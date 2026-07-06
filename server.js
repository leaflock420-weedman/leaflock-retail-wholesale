const fs = require("fs");
const path = require("path");

(function loadLocalEnv() {
  const file = path.join(__dirname, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
})();

const express = require("express");
const crypto = require("crypto");
const {
  recordEvent,
  summarize,
  buildDailyReportHtml,
  loadMeta,
  saveMeta,
} = require("./lib/analytics-store");
const {
  sendDailyReport,
  notifyAdminNewApplication,
  notifyRetailStockistApproved,
  notifyPasswordReset,
  sendCompliancePack,
  notifyOrderConfirmation,
  notifyAdminNewOrder,
  notifyAdminCreditApplication,
  emailConfigured,
} = require("./lib/mailer");
const { bankDetails } = require("./lib/bank-details");
const { verifyPassword } = require("./lib/portal-password");
const { TERMS_VERSION, paymentTermsLabel } = require("./lib/wholesale-terms");
const { submitCreditApplication } = require("./lib/credit-applications-store");
const {
  credentialsForPortal,
  documentsReady,
} = require("./lib/compliance-documents");
const { publicCredentialsPayload } = require("./lib/company-public");
const { getAdminPassword } = require("./lib/admin-config");
const {
  createAdminToken,
  adminAuthMiddleware,
} = require("./lib/admin-auth");
const { pricingForPortal, calculateOrder, calculateGummyOrder, gummyPricingPublic } = require("./lib/pricing");
const {
  findById,
  findByEmail,
  findByPasswordToken,
  recordLogin,
  recordFailedEmailLogin,
  submitApplication,
  approveApplication,
  rejectApplication,
  createPharmacy,
  sendPasswordReset,
  setPasswordWithToken,
  changePharmacyPassword,
  deletePharmacyAccount,
  setPharmacyStatus,
  publicPharmacy,
  adminPharmacyView,
  regenerateCheckoutAccessKey,
  wholesaleSummary,
  loadPharmacies,
  loadApplications,
  loadLoginLog,
  demoPortalInfo,
} = require("./lib/pharmacy-store");
const {
  createOrder,
  findOrder,
  updateOrder,
  listOrders,
  ordersSummary,
} = require("./lib/order-store");
const {
  createPortalToken,
  revokePortalToken,
  portalAuthMiddleware,
} = require("./lib/portal-auth");
const paypal = require("./lib/paypal");
const { blockSensitiveStatic, noStoreJson } = require("./lib/secure-static");
const {
  readCatalogCsvText,
  categoriesToCsv,
  saveCatalogCsv,
  catalogSourceLabel,
  catalogWritePath,
} = require("./lib/catalog-csv");
const { catalogForPortal, reloadCatalog } = require("./lib/wholesale-catalog");
const auspost = require("./lib/auspost-pac");
const gummyCheckoutAccess = require("./lib/gummy-checkout-access");

const app = express();
const PORT = Number(process.env.PORT) || 4173;
const ROOT = __dirname;
const REPORT_HOUR = Number(process.env.ANALYTICS_REPORT_HOUR || 7);
const SITE_HOST = (() => {
  try {
    return new URL(process.env.SITE_URL || "https://www.wholesale.leaflock.com.au").hostname.toLowerCase();
  } catch {
    return "www.wholesale.leaflock.com.au";
  }
})();

const portalAuth = portalAuthMiddleware(findById);
const adminAuth = adminAuthMiddleware;
const loginAttempts = new Map();
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_MAX = 20;
const APPLICATION_RATE_MAX = 8;
const GUMMY_CHECKOUT_RATE_MAX = 12;

function withRetailStockist(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (!payload.pharmacy) return payload;
  const { pharmacy, ...rest } = payload;
  return { ...rest, retailStockist: pharmacy };
}

function dispatchOrderEmails(order, { adminLabel, confirmCustomer = false } = {}) {
  if (!order) return;
  notifyAdminNewOrder({ order, statusLabel: adminLabel || "New wholesale order" }).catch((err) => {
    console.warn("[mail] admin order:", err.message);
  });
  if (confirmCustomer && order.contact?.email) {
    notifyOrderConfirmation({ order, contactEmail: order.contact.email }).catch((err) => {
      console.warn("[mail] order confirmation:", err.message);
    });
  }
}

function isGummyOnlyLineItems(lineItems) {
  return (
    !lineItems?.starterBundle &&
    Number(lineItems?.singlePacks || 0) === 0 &&
    Number(lineItems?.threePacks || 0) === 0 &&
    (Number(lineItems?.gummyIndividual || 0) > 0 || Number(lineItems?.mixedCartons || 0) > 0)
  );
}

function gummyPayPalDescription(order) {
  const parts = [];
  if (order.lineItems?.mixedCartons) {
    parts.push(`${order.lineItems.mixedCartons}× mixed carton (24)`);
  }
  if (order.lineItems?.gummyIndividual) {
    parts.push(`${order.lineItems.gummyIndividual}× 90g gummy mix`);
  }
  return `LeafLock DIY Gummy Mix — ${parts.join(", ") || order.id}`;
}

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
const HOST_ALIASES = {
  "wholesale.leaflock.com.au": true,
  "leaflock-retail-wholesale.onrender.com": true,
};

app.use((req, res, next) => {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  if (host !== SITE_HOST && HOST_ALIASES[host]) {
    return res.redirect(301, `https://${SITE_HOST}${req.originalUrl}`);
  }
  next();
});
app.use((req, res, next) => {
  const isGummyCheckout = req.path === "/gummy-checkout.html";
  const cspPayPal =
    " https://*.paypal.com https://*.paypalobjects.com https://c.paypal.com https://www.gstatic.com";
  const cspCore =
    `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.sandbox.paypal.com${cspPayPal}; frame-src https://www.paypal.com https://www.sandbox.paypal.com${cspPayPal}; connect-src 'self' https://www.paypal.com https://www.sandbox.paypal.com${cspPayPal}; img-src 'self' data: https:${cspPayPal}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com`;
  const frameAncestors = isGummyCheckout
    ? "frame-ancestors https://mail.google.com https://*.google.com https://leaflock.com.au https://*.leaflock.com.au *"
    : "";

  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!isGummyCheckout) {
    res.setHeader("X-Frame-Options", "DENY");
  }
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production" || process.env.RENDER) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  res.setHeader(
    "Content-Security-Policy",
    isGummyCheckout ? `${cspCore}; ${frameAncestors}` : cspCore,
  );
  next();
});
app.use(blockSensitiveStatic);

const NOINDEX_HTML =
  /^\/(portal|gummy-checkout|demo|help|set-password|forgot-password|credit-application)\.html$/i;
app.use((req, res, next) => {
  if (NOINDEX_HTML.test(req.path) || req.path.startsWith("/admin")) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  next();
});

// Never cache public gummy checkout — email links must always get the no-login page.
app.get("/gummy-checkout.html", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.sendFile(path.join(ROOT, "gummy-checkout.html"));
});

app.get("/assets/gummy-checkout.js", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.sendFile(path.join(ROOT, "assets", "gummy-checkout.js"));
});

app.use(express.static(ROOT));

function rateLimitKey(key, max) {
  const now = Date.now();
  const bucket = loginAttempts.get(key) || [];
  const recent = bucket.filter((t) => now - t < LOGIN_RATE_WINDOW_MS);
  recent.push(now);
  loginAttempts.set(key, recent);
  return recent.length <= max;
}

function rateLimitLogin(key) {
  return rateLimitKey(key, LOGIN_RATE_MAX);
}

function clientMeta(req) {
  return {
    ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
  };
}

// ——— Analytics ———

app.post("/api/analytics/collect", (req, res) => {
  try {
    recordEvent({
      ...req.body,
      userAgent: req.headers["user-agent"] || "",
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "collect failed" });
  }
});

app.post("/api/analytics/login", (req, res) => {
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    return res.status(503).json({ error: "Admin login not configured" });
  }
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (!rateLimitLogin(`admin:${ip}`)) {
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }
  const { password } = req.body || {};
  if (password !== adminPassword) {
    return res.status(401).json({ error: "Invalid password" });
  }
  res.json({ token: createAdminToken() });
});

app.get("/api/analytics/live", adminAuth, (req, res) => {
  res.json(summarize({ days: 1 }));
});

app.get("/api/analytics/summary", adminAuth, (req, res) => {
  const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
  res.json(summarize({ days }));
});

app.post("/api/analytics/send-report", adminAuth, async (req, res) => {
  const end = Date.now();
  const start = end - 24 * 60 * 60 * 1000;
  const summary = summarize({ days: 1, end });
  const dateLabel = new Date(start).toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const ok = await sendDailyReport({
    subject: `LeafLock Wholesale Traffic — ${dateLabel}`,
    html: buildDailyReportHtml(summary),
  });
  res.json({ sent: ok });
});

// ——— Portal auth & pricing (server-gated) ———

app.get("/api/demo/portal", (_req, res) => {
  res.status(404).json({ error: "Not available" });
});

app.post("/api/portal/login", (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    if (!rateLimitLogin(`portal:${ip}:${normalizedEmail}`)) {
      return res.status(429).json({ error: "Too many attempts. Try again later." });
    }

    const pharmacy = findByEmail(normalizedEmail);
    if (!pharmacy || !pharmacy.passwordHash || !verifyPassword(password, pharmacy.passwordHash)) {
      recordFailedEmailLogin(normalizedEmail, clientMeta(req));
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const publicInfo = recordLogin(pharmacy.id, clientMeta(req));
    const token = createPortalToken(pharmacy.id);
    res.json({ token, retailStockist: publicInfo });
  } catch (err) {
    console.error("[portal] login failed:", err);
    res.status(500).json({ error: "Portal login unavailable. Try again shortly." });
  }
});

app.post("/api/portal/forgot-password", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (!rateLimitLogin(`forgot:${ip}`)) {
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email required" });
  const pharmacy = findByEmail(email);
  if (pharmacy) {
    const result = sendPasswordReset(pharmacy.id);
    if (result?.setupToken) {
      const notify = pharmacy.passwordHash ? notifyPasswordReset : notifyRetailStockistApproved;
      const payload = pharmacy.passwordHash
        ? { pharmacy: result.pharmacy, resetToken: result.setupToken }
        : {
            app: {
              fullName: pharmacy.contactName || pharmacy.businessName,
              businessName: pharmacy.businessName,
              email: pharmacy.email,
            },
            setupToken: result.setupToken,
          };
      notify(payload).catch((err) => {
        console.warn("[mail] password reset:", err.message);
      });
    }
  }
  res.json({ ok: true, message: "If that email has an account, a reset link has been sent." });
});

app.post("/api/portal/set-password", (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: "Token and password required" });
  }
  const result = setPasswordWithToken(token, password);
  if (!result) return res.status(500).json({ error: "Could not save password" });
  if (result.error === "invalid_or_expired_token") {
    return res.status(400).json({ error: "This link is invalid or has expired. Request a new reset link." });
  }
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ ok: true, retailStockist: result.pharmacy });
});

app.get("/api/portal/password-token-status", (req, res) => {
  const token = String(req.query.token || "");
  const pharmacy = findByPasswordToken(token);
  if (!pharmacy) {
    return res.status(400).json({ valid: false });
  }
  res.json({
    valid: true,
    email: pharmacy.email,
    businessName: pharmacy.businessName,
    purpose: pharmacy.passwordTokenPurpose || "setup",
  });
});

app.post("/api/portal/change-password", portalAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password required" });
  }
  const result = changePharmacyPassword(req.portalPharmacy.id, currentPassword, newPassword);
  if (!result) return res.status(404).json({ error: "Account not found" });
  if (result.error === "incorrect_password") {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  if (result.error) return res.status(400).json({ error: result.error });
  revokePortalToken(req.portalToken);
  const token = createPortalToken(req.portalPharmacy.id);
  res.json({ ok: true, token, retailStockist: result });
});

app.post("/api/portal/delete-account", portalAuth, (req, res) => {
  const password = String(req.body?.password || "");
  if (!password) return res.status(400).json({ error: "Password required to delete your account" });
  const result = deletePharmacyAccount(req.portalPharmacy.id, password);
  if (!result) return res.status(404).json({ error: "Account not found" });
  if (result.error === "incorrect_password") {
    return res.status(401).json({ error: "Password is incorrect" });
  }
  if (result.error === "demo_account") {
    return res.status(400).json({ error: "Demo account cannot be deleted" });
  }
  revokePortalToken(req.portalToken);
  res.status(204).end();
});

app.get("/api/portal/bank-details", portalAuth, (req, res) => {
  res.json(bankDetails());
});

app.get("/api/portal/session", portalAuth, (req, res) => {
  res.json({ retailStockist: publicPharmacy(req.portalPharmacy) });
});

app.post("/api/portal/logout", portalAuth, (req, res) => {
  revokePortalToken(req.portalToken);
  res.status(204).end();
});

app.get("/api/pricing", portalAuth, noStoreJson, (req, res) => {
  res.json(pricingForPortal());
});

app.get("/api/company/credentials", (req, res) => {
  res.json(publicCredentialsPayload());
});

app.get("/api/portal/credentials", portalAuth, (req, res) => {
  res.json({
    ...credentialsForPortal(),
    partner: true,
  });
});

// ——— Access applications ———

app.post("/api/applications", (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (!rateLimitKey(`apply:${ip}`, APPLICATION_RATE_MAX)) {
    return res.status(429).json({ error: "Too many applications. Try again later." });
  }
  const body = req.body || {};
  const required = ["businessName", "fullName", "abn", "email"];
  for (const field of required) {
    if (!String(body[field] || "").trim()) {
      return res.status(400).json({ error: `Missing field: ${field}` });
    }
  }
  try {
    const application = submitApplication(body);
    notifyAdminNewApplication(application).catch((err) => {
      console.warn("[mail] application notify:", err.message);
    });
    res.status(201).json({ id: application.id, status: application.status });
  } catch (err) {
    console.error("[applications] submit:", err);
    res.status(500).json({ error: "Could not save application. Email info@leaflock.com.au" });
  }
});

// ——— Orders ———

app.post("/api/orders", portalAuth, (req, res) => {
  const body = req.body || {};
  const contact = body.contact || {};
  if (!body.termsAccepted) {
    return res.status(400).json({ error: "You must agree to the Wholesale Terms & Conditions." });
  }
  const required = ["businessName", "fullName", "abn", "email"];
  for (const field of required) {
    if (!String(contact[field] || "").trim()) {
      return res.status(400).json({ error: `Missing contact field: ${field}` });
    }
  }

  const lineItems = {
    singlePacks: Number(body.singlePacks) || 0,
    threePacks: Number(body.threePacks) || 0,
    gummyIndividual: Number(body.gummyIndividual) || 0,
    mixedCartons: Number(body.mixedCartons) || 0,
    starterBundle: Boolean(body.starterBundle),
    catalog: body.catalog && typeof body.catalog === "object" ? body.catalog : {},
  };

  const totals = calculateOrder(lineItems);
  if (totals.total <= 0) {
    return res.status(400).json({ error: "Order must include at least one product" });
  }

  const paymentMethod = body.paymentMethod || "invoice";
  const paymentTerms = paymentTermsLabel(req.portalPharmacy, { paymentMethod });

  const order = createOrder({
    pharmacyId: req.portalPharmacy.id,
    pharmacyName: req.portalPharmacy.businessName,
    contact: { ...contact, flavours: body.flavours || "" },
    lineItems,
    totals,
    notes: body.notes || "",
    paymentMethod,
    termsAccepted: true,
    termsVersion: TERMS_VERSION,
    paymentTerms,
  });

  if (paymentMethod === "invoice" || paymentMethod === "bank_transfer") {
    const label =
      paymentMethod === "bank_transfer" ? "New bank transfer order" : "New invoice order";
    dispatchOrderEmails(order, { adminLabel: label, confirmCustomer: true });
  }

  res.status(201).json({
    order: {
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      status: order.status,
      totals: order.totals,
      paymentTerms: order.paymentTerms,
    },
  });
});

app.post("/api/credit-applications", portalAuth, (req, res) => {
  const body = req.body || {};
  if (!body.termsAccepted) {
    return res.status(400).json({ error: "You must agree to the Wholesale Terms & Conditions." });
  }
  const required = ["businessName", "abn", "directorName", "directorEmail", "requestedTerms", "signatureName"];
  for (const field of required) {
    if (!String(body[field] || "").trim()) {
      return res.status(400).json({ error: `Missing field: ${field}` });
    }
  }
  if (body.signatureName.trim().toLowerCase() !== body.directorName.trim().toLowerCase()) {
    return res.status(400).json({ error: "Signature name must match director name." });
  }

  const app = submitCreditApplication({
    pharmacyId: req.portalPharmacy.id,
    businessName: body.businessName,
    abn: body.abn,
    directorName: body.directorName,
    directorEmail: body.directorEmail,
    requestedTerms: body.requestedTerms,
    tradeReference1: body.tradeReference1,
    tradeReference2: body.tradeReference2,
    notes: body.notes,
    signatureName: body.signatureName,
    termsVersion: TERMS_VERSION,
  });

  notifyAdminCreditApplication(app).catch((err) => {
    console.warn("[mail] credit application notify:", err.message);
  });

  res.status(201).json({ application: { id: app.id, status: app.status } });
});

// ——— PayPal sandbox ———

app.get("/api/paypal/config", portalAuth, (req, res) => {
  res.json({
    enabled: paypal.isConfigured(),
    clientId: paypal.clientId(),
    mode: paypal.mode(),
    sdkBaseUrl: paypal.sdkBaseUrl(),
  });
});

app.post("/api/paypal/create-order", portalAuth, async (req, res) => {
  if (!paypal.isConfigured()) {
    return res.status(503).json({ error: "PayPal not configured" });
  }

  const { orderId } = req.body || {};
  const order = findOrder(orderId);
  if (!order || order.pharmacyId !== req.portalPharmacy.id) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (order.paymentStatus === "paid") {
    return res.status(400).json({ error: "Order already paid" });
  }

  try {
    const ppOrder = await paypal.createPayPalOrder({
      orderId: order.id,
      total: order.totals.total,
    });
    updateOrder(order.id, {
      paypalOrderId: ppOrder.id,
      status: "awaiting_payment",
      paymentMethod: "paypal",
      paymentStatus: "pending",
    });
    res.json({ paypalOrderId: ppOrder.id });
  } catch (err) {
    console.error("[paypal] create-order:", err.message);
    res.status(502).json({ error: "Could not create PayPal order" });
  }
});

app.post("/api/paypal/capture-order", portalAuth, async (req, res) => {
  if (!paypal.isConfigured()) {
    return res.status(503).json({ error: "PayPal not configured" });
  }

  const { orderId, paypalOrderId } = req.body || {};
  const order = findOrder(orderId);
  if (!order || order.pharmacyId !== req.portalPharmacy.id) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (!paypalOrderId || order.paypalOrderId !== paypalOrderId) {
    return res.status(400).json({ error: "PayPal order mismatch" });
  }

  try {
    const capture = await paypal.capturePayPalOrder(paypalOrderId);
    const paid = paypal.captureAmount(capture);
    const expected = Number(order.totals?.total || 0).toFixed(2);
    if (paid == null || Number(paid).toFixed(2) !== expected) {
      console.error("[paypal] amount mismatch", { paid, expected, orderId: order.id });
      return res.status(400).json({ error: "Payment amount mismatch" });
    }
    const captureId = capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
    updateOrder(order.id, {
      status: "paid",
      paymentStatus: "paid",
      paypalCaptureId: captureId,
      paidAt: Date.now(),
    });
    dispatchOrderEmails(findOrder(order.id), {
      adminLabel: "Paid wholesale order (PayPal)",
      confirmCustomer: true,
    });
    res.json({ status: "paid", captureId });
  } catch (err) {
    console.error("[paypal] capture:", err.message);
    res.status(502).json({ error: "Payment capture failed" });
  }
});

// ——— Public gummy checkout (email links, confectionery stores — no portal login) ———

function isPublicGummyOrder(order) {
  return order?.source === "gummy-checkout" && (order.pharmacyId == null || order.pharmacyId === "");
}

app.get("/api/public/gummy-checkout/context", noStoreJson, gummyCheckoutAccess.requireGummyCheckoutAccess, (req, res) => {
  const pharmacy = req.gummyCheckoutPharmacy;
  res.json({
    source: req.gummyCheckoutAccess?.source || "unknown",
    businessName: pharmacy?.businessName || null,
    email: pharmacy?.email || null,
  });
});

app.get("/api/public/gummy-checkout/pricing", noStoreJson, gummyCheckoutAccess.requireGummyCheckoutAccess, (req, res) => {
  res.json(gummyPricingPublic());
});

app.get("/api/public/gummy-checkout/paypal-config", noStoreJson, gummyCheckoutAccess.requireGummyCheckoutAccess, (req, res) => {
  res.json({
    enabled: paypal.isConfigured(),
    clientId: paypal.clientId(),
    mode: paypal.mode(),
    sdkBaseUrl: paypal.sdkBaseUrl(),
  });
});

app.post("/api/public/gummy-checkout/orders", gummyCheckoutAccess.requireGummyCheckoutAccess, (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    if (!rateLimitKey(`gummy-checkout:${ip}`, GUMMY_CHECKOUT_RATE_MAX)) {
      return res.status(429).json({ error: "Too many checkout attempts. Try again shortly." });
    }

    const body = req.body || {};
    const contact = body.contact || {};
    for (const field of ["businessName", "fullName", "email", "address"]) {
      if (!String(contact[field] || "").trim()) {
        return res.status(400).json({ error: `Missing ${field}` });
      }
    }

    if (!body.termsAccepted) {
      return res.status(400).json({ error: "You must agree to the Wholesale Terms & Conditions." });
    }

    const lineItems = {
      singlePacks: 0,
      threePacks: 0,
      gummyIndividual: Math.max(0, Number(body.gummyIndividual) || 0),
      mixedCartons: Math.max(0, Number(body.mixedCartons) || 0),
      starterBundle: false,
    };

    if (!isGummyOnlyLineItems(lineItems)) {
      return res.status(400).json({ error: "Add at least one gummy mix product" });
    }

    const calculated = calculateGummyOrder(lineItems);
    if (calculated.total <= 0) {
      return res.status(400).json({ error: "Invalid order total" });
    }

    const totals = {
      subtotal: calculated.subtotal,
      gst: calculated.gst,
      shipping: calculated.shipping,
      total: calculated.total,
    };

    const stockist = req.gummyCheckoutPharmacy;
    const order = createOrder({
      pharmacyId: stockist?.id || null,
      pharmacyName: stockist?.businessName || contact.businessName,
      contact: { ...contact, flavours: body.flavours || "" },
      lineItems,
      totals,
      notes: body.notes || "Public gummy checkout",
      paymentMethod: "paypal",
      source: "gummy-checkout",
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      paymentTerms: paymentTermsLabel(null, { paymentMethod: "paypal" }),
    });

    res.status(201).json({
      order: {
        id: order.id,
        status: order.status,
        totals: order.totals,
      },
    });
  } catch (err) {
    console.error("[gummy-checkout] create order:", err);
    res.status(500).json({ error: "Could not save order. Try again or email info@leaflock.com.au" });
  }
});

app.post("/api/public/gummy-checkout/paypal/create", gummyCheckoutAccess.requireGummyCheckoutAccess, async (req, res) => {
  if (!paypal.isConfigured()) {
    return res.status(503).json({ error: "PayPal not configured" });
  }

  const { orderId } = req.body || {};
  const order = findOrder(orderId);
  if (!order || !isPublicGummyOrder(order)) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (!isGummyOnlyLineItems(order.lineItems)) {
    return res.status(400).json({ error: "Gummy mix orders only" });
  }
  if (order.paymentStatus === "paid") {
    return res.status(400).json({ error: "Order already paid" });
  }

  try {
    const ppOrder = await paypal.createPayPalOrder({
      orderId: order.id,
      total: order.totals.total,
      description: gummyPayPalDescription(order),
    });
    updateOrder(order.id, {
      paypalOrderId: ppOrder.id,
      status: "awaiting_payment",
      paymentMethod: "paypal",
      paymentStatus: "pending",
    });
    res.json({ paypalOrderId: ppOrder.id });
  } catch (err) {
    console.error("[paypal] public gummy create:", err.message);
    res.status(502).json({ error: "Could not create PayPal order" });
  }
});

app.post("/api/public/gummy-checkout/paypal/capture", gummyCheckoutAccess.requireGummyCheckoutAccess, async (req, res) => {
  if (!paypal.isConfigured()) {
    return res.status(503).json({ error: "PayPal not configured" });
  }

  const { orderId, paypalOrderId } = req.body || {};
  const order = findOrder(orderId);
  if (!order || !isPublicGummyOrder(order)) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (!paypalOrderId || order.paypalOrderId !== paypalOrderId) {
    return res.status(400).json({ error: "PayPal order mismatch" });
  }

  try {
    const capture = await paypal.capturePayPalOrder(paypalOrderId);
    const paid = paypal.captureAmount(capture);
    const expected = Number(order.totals?.total || 0).toFixed(2);
    if (paid == null || Number(paid).toFixed(2) !== expected) {
      console.error("[paypal] public gummy amount mismatch", { paid, expected, orderId: order.id });
      return res.status(400).json({ error: "Payment amount mismatch" });
    }
    const captureId = capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
    updateOrder(order.id, {
      status: "paid",
      paymentStatus: "paid",
      paypalCaptureId: captureId,
      paidAt: Date.now(),
    });
    dispatchOrderEmails(findOrder(order.id), {
      adminLabel: "Paid gummy mix order (PayPal)",
      confirmCustomer: true,
    });
    res.json({ status: "paid", captureId });
  } catch (err) {
    console.error("[paypal] public gummy capture:", err.message);
    res.status(502).json({ error: "Payment capture failed" });
  }
});

// ——— Admin wholesale ———

app.get("/api/admin/wholesale/summary", adminAuth, (req, res) => {
  res.json({
    ...wholesaleSummary(),
    orders: ordersSummary(),
  });
});

app.get("/api/admin/setup-status", adminAuth, (req, res) => {
  res.json({
    paypal: paypal.isConfigured(),
    paypalMode: paypal.mode(),
    email: emailConfigured(),
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    portalSalt: Boolean(process.env.PORTAL_CODE_SALT),
    siteUrl: process.env.SITE_URL || "https://www.wholesale.leaflock.com.au",
    adminPasswordFromEnv: Boolean(process.env.ANALYTICS_ADMIN_PASSWORD),
    portalSessionSecret: Boolean(process.env.PORTAL_SESSION_SECRET),
    adminSessionSecret: Boolean(process.env.ADMIN_SESSION_SECRET || process.env.PORTAL_SESSION_SECRET),
    dataDir: process.env.DATA_DIR || "data/",
    complianceDocuments: documentsReady(),
    httpsOnly: Boolean(process.env.NODE_ENV === "production" || process.env.RENDER),
    catalogItems: catalogForPortal().reduce((n, cat) => n + cat.items.length, 0),
    catalogCategories: catalogForPortal().length,
    catalogSource: catalogSourceLabel(),
    auspostPac: auspost.isConfigured(),
    auspostFromPostcode: auspost.fromPostcode(),
    gummyCheckoutKey: gummyCheckoutAccess.isCheckoutAccessConfigured(),
    stockistCheckoutKeys: loadPharmacies().pharmacies.filter(
      (p) => p.status === "active" && p.checkoutAccessKey,
    ).length,
  });
});

app.post("/api/admin/postage/quote", adminAuth, async (req, res) => {
  const result = await auspost.quoteDomesticParcel(req.body || {});
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result);
});

app.get("/api/admin/order-form-preview", adminAuth, noStoreJson, (_req, res) => {
  res.json(pricingForPortal());
});

app.get("/api/admin/catalog/download", adminAuth, (req, res) => {
  const csv = readCatalogCsvText() || categoriesToCsv(catalogForPortal());
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="wholesale-catalog-template.csv"');
  res.send(csv);
});

app.get("/api/admin/catalog/info", adminAuth, (req, res) => {
  const categories = catalogForPortal();
  res.json({
    source: catalogSourceLabel(),
    categories: categories.length,
    items: categories.reduce((n, cat) => n + cat.items.length, 0),
    updatedAt: (() => {
      const writePath = catalogWritePath();
      return fs.existsSync(writePath) ? fs.statSync(writePath).mtime.toISOString() : null;
    })(),
  });
});

app.post("/api/admin/catalog/upload", adminAuth, (req, res) => {
  const csv = req.body?.csv;
  if (!csv || typeof csv !== "string") {
    return res.status(400).json({ error: "Upload a CSV file (same columns as the download template)." });
  }
  const saved = saveCatalogCsv(csv);
  if (!saved.ok) {
    return res.status(400).json({ error: "Could not read spreadsheet", details: saved.errors });
  }
  const reloaded = reloadCatalog();
  res.json({
    ok: true,
    itemCount: saved.itemCount,
    categoryCount: saved.categoryCount,
    catalogItems: reloaded.items,
    source: catalogSourceLabel(),
  });
});

app.get("/api/admin/applications", adminAuth, (req, res) => {
  const status = req.query.status || null;
  let applications = loadApplications().applications;
  if (status) applications = applications.filter((a) => a.status === status);
  res.json({ applications });
});

app.post("/api/admin/applications/:id/approve", adminAuth, async (req, res) => {
  const result = approveApplication(req.params.id);
  if (!result) return res.status(404).json({ error: "Application not found" });
  if (result.error) return res.status(400).json({ error: result.error });
  try {
    result.emailSent = await notifyRetailStockistApproved({
      app: result.application,
      setupToken: result.setupToken,
    });
  } catch (err) {
    console.warn("[mail] approval notify:", err.message);
    result.emailSent = false;
  }
  res.json(withRetailStockist(result));
});

app.post("/api/admin/applications/:id/reject", adminAuth, (req, res) => {
  const app = rejectApplication(req.params.id);
  if (!app) return res.status(404).json({ error: "Application not found" });
  res.json({ application: app });
});

app.get("/api/admin/pharmacies", adminAuth, (req, res) => {
  const pharmacies = loadPharmacies().pharmacies.map(adminPharmacyView);
  res.json({ retailStockists: pharmacies });
});

app.post("/api/admin/pharmacies/:id/regenerate-checkout-key", adminAuth, (req, res) => {
  const result = regenerateCheckoutAccessKey(req.params.id);
  if (!result) return res.status(404).json({ error: "Retail stockist not found" });
  res.json(withRetailStockist(result));
});

app.post("/api/admin/pharmacies", adminAuth, (req, res) => {
  const body = req.body || {};
  if (!body.businessName || !body.email) {
    return res.status(400).json({ error: "businessName and email required" });
  }
  const result = createPharmacy(body);
  res.status(201).json(withRetailStockist(result));
});

app.post("/api/admin/pharmacies/:id/send-password-reset", adminAuth, async (req, res) => {
  const result = sendPasswordReset(req.params.id);
  if (!result) return res.status(404).json({ error: "Retail stockist not found" });
  try {
    result.emailSent = await notifyPasswordReset({
      pharmacy: result.pharmacy,
      resetToken: result.setupToken,
    });
  } catch (err) {
    console.warn("[mail] admin password reset:", err.message);
    result.emailSent = false;
  }
  res.json(withRetailStockist(result));
});

app.patch("/api/admin/pharmacies/:id", adminAuth, (req, res) => {
  const { status } = req.body || {};
  const pharmacy = setPharmacyStatus(req.params.id, status);
  if (!pharmacy) return res.status(404).json({ error: "Retail stockist not found" });
  res.json({ retailStockist: pharmacy });
});

app.post("/api/admin/pharmacies/:id/send-compliance", adminAuth, async (req, res) => {
  const pharmacy = findById(req.params.id);
  if (!pharmacy) return res.status(404).json({ error: "Retail stockist not found" });
  if (!pharmacy.email) return res.status(400).json({ error: "Retail stockist has no email" });
  if (!documentsReady()) return res.status(503).json({ error: "Compliance documents not available on server" });
  try {
    const sent = await sendCompliancePack({
      to: pharmacy.email,
      pharmacyName: pharmacy.businessName,
      contactName: pharmacy.businessName,
    });
    res.json({ sent, email: pharmacy.email });
  } catch (err) {
    console.warn("[mail] compliance pack:", err.message);
    res.status(502).json({ error: "Failed to send compliance documents" });
  }
});

app.post("/api/admin/applications/:id/send-compliance", adminAuth, async (req, res) => {
  const apps = loadApplications();
  const application = apps.applications.find((a) => a.id === req.params.id);
  if (!application) return res.status(404).json({ error: "Application not found" });
  if (!application.email) return res.status(400).json({ error: "Application has no email" });
  if (!documentsReady()) return res.status(503).json({ error: "Compliance documents not available on server" });
  try {
    const sent = await sendCompliancePack({
      to: application.email,
      pharmacyName: application.businessName,
      contactName: application.fullName,
    });
    res.json({ sent, email: application.email });
  } catch (err) {
    console.warn("[mail] compliance pack:", err.message);
    res.status(502).json({ error: "Failed to send compliance documents" });
  }
});

app.get("/api/admin/orders", adminAuth, (req, res) => {
  const orders = listOrders({
    status: req.query.status || null,
    pharmacyId: req.query.pharmacyId || null,
    limit: Number(req.query.limit) || 200,
  });
  res.json({ orders });
});

app.patch("/api/admin/orders/:id", adminAuth, (req, res) => {
  const { status, paymentStatus } = req.body || {};
  const patch = {};
  if (status) patch.status = status;
  if (paymentStatus) patch.paymentStatus = paymentStatus;
  const order = updateOrder(req.params.id, patch);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
});

app.get("/api/admin/login-log", adminAuth, (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 100);
  const entries = loadLoginLog().entries.slice(-limit).reverse();
  res.json({ entries });
});

// ——— Daily report cron ———

async function maybeSendDailyReport() {
  const now = new Date();
  if (now.getHours() !== REPORT_HOUR) return;

  const meta = loadMeta();
  const todayKey = now.toISOString().slice(0, 10);
  if (meta.lastDailyReport === todayKey) return;

  const summary = summarize({ days: 1 });
  const dateLabel = new Date(now.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sent = await sendDailyReport({
    subject: `LeafLock Wholesale Traffic — ${dateLabel}`,
    html: buildDailyReportHtml(summary),
  });

  if (sent) {
    saveMeta({ ...meta, lastDailyReport: todayKey });
    console.log(`[analytics] Daily report emailed for ${todayKey}`);
  }
}

setInterval(maybeSendDailyReport, 60 * 1000);
setTimeout(maybeSendDailyReport, 5000);

app.listen(PORT, "0.0.0.0", () => {
  try {
    loadPharmacies();
  } catch (err) {
    console.error("[retail] Startup retail stockist seed failed:", err.message);
  }
  console.log(`LeafLock Retail Stockist Wholesale + Analytics at http://0.0.0.0:${PORT}`);
  console.log(`Admin dashboard: http://0.0.0.0:${PORT}/admin/`);
  console.log(`Portal: http://0.0.0.0:${PORT}/portal.html`);
  if (paypal.isConfigured()) {
    console.log(`[paypal] ${paypal.mode()} checkout enabled`);
  } else {
    console.log("[paypal] Not configured — set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on Render");
  }
});