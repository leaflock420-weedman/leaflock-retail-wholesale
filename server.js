const fs = require("fs");
const path = require("path");

// LL Wholesale isolated copy — load .env.local without affecting production project
const envLocal = path.join(__dirname, ".env.local");
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

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
  notifyPharmacyApproved,
  sendCompliancePack,
  emailConfigured,
} = require("./lib/mailer");
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
const { pricingForPortal, calculateOrder } = require("./lib/pricing");
const {
  findByCode,
  findById,
  recordLogin,
  recordFailedLogin,
  submitApplication,
  approveApplication,
  rejectApplication,
  createPharmacy,
  regenerateCode,
  setPharmacyStatus,
  publicPharmacy,
  wholesaleSummary,
  loadPharmacies,
  loadApplications,
  loadLoginLog,
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

const app = express();
const PORT = Number(process.env.PORT) || 4173;
const ROOT = __dirname;
const REPORT_HOUR = Number(process.env.ANALYTICS_REPORT_HOUR || 7);
const SITE_HOST = (() => {
  try {
    return new URL(process.env.SITE_URL || "https://med.leaflock.com.au").hostname.toLowerCase();
  } catch {
    return "med.leaflock.com.au";
  }
})();

const portalAuth = portalAuthMiddleware(findById);
const adminAuth = adminAuthMiddleware;
const loginAttempts = new Map();
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_MAX = 20;
const APPLICATION_RATE_MAX = 8;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  if (host === `www.${SITE_HOST}`) {
    return res.redirect(301, `https://${SITE_HOST}${req.originalUrl}`);
  }
  next();
});
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production" || process.env.RENDER) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.sandbox.paypal.com; frame-src https://www.paypal.com https://www.sandbox.paypal.com; connect-src 'self' https://www.paypal.com https://www.sandbox.paypal.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:",
  );
  next();
});
app.use((req, res, next) => {
  if (/^\/data(\/|$)/.test(req.path) || /^\/private(\/|$)/.test(req.path) || /^\/\.env/.test(req.path)) {
    return res.status(404).end();
  }
  next();
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

app.post("/api/portal/login", (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (!rateLimitLogin(`portal:${ip}`)) {
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }
  const { code } = req.body || {};
  if (!code || !String(code).trim()) {
    return res.status(400).json({ error: "Access code required" });
  }

  const pharmacy = findByCode(code);
  if (!pharmacy) {
    recordFailedLogin(code, clientMeta(req));
    return res.status(401).json({ error: "Invalid access code" });
  }

  const publicInfo = recordLogin(pharmacy.id, clientMeta(req));
  const token = createPortalToken(pharmacy.id);
  res.json({ token, pharmacy: publicInfo });
});

app.get("/api/portal/session", portalAuth, (req, res) => {
  res.json({ pharmacy: publicPharmacy(req.portalPharmacy) });
});

app.post("/api/portal/logout", portalAuth, (req, res) => {
  revokePortalToken(req.portalToken);
  res.status(204).end();
});

app.get("/api/pricing", portalAuth, (req, res) => {
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
  const required = ["businessName", "fullName", "abn", "pharmacyReg", "email"];
  for (const field of required) {
    if (!String(body[field] || "").trim()) {
      return res.status(400).json({ error: `Missing field: ${field}` });
    }
  }
  const application = submitApplication(body);
  notifyAdminNewApplication(application).catch((err) => {
    console.warn("[mail] application notify:", err.message);
  });
  res.status(201).json({ id: application.id, status: application.status });
});

// ——— Orders ———

app.post("/api/orders", portalAuth, (req, res) => {
  const body = req.body || {};
  const contact = body.contact || {};
  const required = ["businessName", "fullName", "abn", "pharmacyReg", "email"];
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
  };

  const totals = calculateOrder(lineItems);
  if (totals.total <= 0) {
    return res.status(400).json({ error: "Order must include at least one product" });
  }

  const order = createOrder({
    pharmacyId: req.portalPharmacy.id,
    pharmacyName: req.portalPharmacy.businessName,
    contact: { ...contact, flavours: body.flavours || "" },
    lineItems,
    totals,
    notes: body.notes || "",
    paymentMethod: body.paymentMethod || "invoice",
  });

  res.status(201).json({ order: { id: order.id, status: order.status, totals: order.totals } });
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
    res.json({ status: "paid", captureId });
  } catch (err) {
    console.error("[paypal] capture:", err.message);
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
    siteUrl: process.env.SITE_URL || "https://med.leaflock.com.au",
    adminPasswordFromEnv: Boolean(process.env.ANALYTICS_ADMIN_PASSWORD),
    portalSessionSecret: Boolean(process.env.PORTAL_SESSION_SECRET),
    adminSessionSecret: Boolean(process.env.ADMIN_SESSION_SECRET || process.env.PORTAL_SESSION_SECRET),
    dataDir: process.env.DATA_DIR || "data/",
    complianceDocuments: documentsReady(),
    httpsOnly: Boolean(process.env.NODE_ENV === "production" || process.env.RENDER),
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
    result.emailSent = await notifyPharmacyApproved({
      app: result.application,
      accessCode: result.accessCode,
    });
  } catch (err) {
    console.warn("[mail] approval notify:", err.message);
    result.emailSent = false;
  }
  res.json(result);
});

app.post("/api/admin/applications/:id/reject", adminAuth, (req, res) => {
  const app = rejectApplication(req.params.id);
  if (!app) return res.status(404).json({ error: "Application not found" });
  res.json({ application: app });
});

app.get("/api/admin/pharmacies", adminAuth, (req, res) => {
  const pharmacies = loadPharmacies().pharmacies.map(publicPharmacy);
  res.json({ pharmacies });
});

app.post("/api/admin/pharmacies", adminAuth, (req, res) => {
  const body = req.body || {};
  if (!body.businessName || !body.email) {
    return res.status(400).json({ error: "businessName and email required" });
  }
  const result = createPharmacy(body);
  res.status(201).json(result);
});

app.post("/api/admin/pharmacies/:id/regenerate-code", adminAuth, (req, res) => {
  const result = regenerateCode(req.params.id);
  if (!result) return res.status(404).json({ error: "Retailer not found" });
  res.json(result);
});

app.patch("/api/admin/pharmacies/:id", adminAuth, (req, res) => {
  const { status } = req.body || {};
  const pharmacy = setPharmacyStatus(req.params.id, status);
  if (!pharmacy) return res.status(404).json({ error: "Retailer not found" });
  res.json({ pharmacy });
});

app.post("/api/admin/pharmacies/:id/send-compliance", adminAuth, async (req, res) => {
  const pharmacy = findById(req.params.id);
  if (!pharmacy) return res.status(404).json({ error: "Retailer not found" });
  if (!pharmacy.email) return res.status(400).json({ error: "Retailer has no email" });
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
  console.log(`LeafLock Retail Wholesale + Analytics at http://0.0.0.0:${PORT}`);
  console.log(`Admin dashboard: http://0.0.0.0:${PORT}/admin/`);
  if (paypal.isConfigured()) {
    console.log(`[paypal] ${paypal.mode()} checkout enabled`);
  } else {
    console.log("[paypal] Not configured — set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on Render");
  }
});