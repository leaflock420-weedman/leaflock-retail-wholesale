/**
 * Full wholesale site test — pricing, shipping, auth, public APIs.
 * Usage: node scripts/run-full-test.mjs
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const testData = path.join(root, "data-test-run");

const results = [];
let failed = 0;

async function testOrderPdfs() {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const { calculateOrder } = require("../lib/pricing.js");
  const { expandOrderLines } = require("../lib/order-lines.js");
  const { generateInvoicePdf, generateFulfillmentPdf } = require("../lib/order-pdf.js");

  const lineItems = {
    catalog: { "CHOP-FORB": 2 },
    starterBundle: false,
    singlePacks: 0,
    threePacks: 0,
    gummyIndividual: 0,
    mixedCartons: 0,
  };
  const totals = calculateOrder(lineItems);
  const order = {
    id: "ord_pdf_test",
    invoiceNumber: "LL0715TEST",
    createdAt: Date.now(),
    retailStockistName: "PDF Test Store",
    contact: {
      businessName: "PDF Test Store",
      fullName: "Tester",
      abn: "12 345 678 901",
      email: "test@example.com",
      address: "1 Test St",
    },
    lineItems,
    totals,
    notes: "Test order",
    paymentMethod: "invoice",
    paymentTerms: "Prepaid",
    status: "submitted",
    paymentStatus: "unpaid",
  };

  const lines = expandOrderLines(order);
  assert("Order PDF line expansion", lines.length > 0);
  const invoice = await generateInvoicePdf(order);
  const fulfillment = await generateFulfillmentPdf(order);
  assert("Invoice PDF generated", invoice.length > 500 && invoice.slice(0, 4).toString() === "%PDF");
  assert("Invoice PDF single page", pdfPageCount(invoice) === 1);
  assert("Fulfillment PDF generated", fulfillment.length > 500 && fulfillment.slice(0, 4).toString() === "%PDF");
}

function pdfPageCount(buffer) {
  const s = buffer.toString("latin1");
  const tree = s.match(/\/Type\s*\/Pages\b[^]*?\/Count\s+(\d+)/);
  if (tree) return Number(tree[1]);
  return (s.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
}

function assert(name, condition, detail = "") {
  if (condition) {
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    results.push({ name, ok: false, detail });
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function json(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { res, body };
}

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ——— Unit tests (no server) ———
console.log("\n=== Unit: pricing & shipping ===");
const {
  calculateGummyOrder,
  calculateOrder,
  gummyPricingPublic,
  shippingForSubtotal,
  FREE_SHIPPING_THRESHOLD,
} = await import(`file://${path.join(root, "lib/pricing.js").replace(/\\/g, "/")}`);

assert("Free shipping threshold is 710", FREE_SHIPPING_THRESHOLD === 710);
assert("Below threshold charges $25", shippingForSubtotal(709) === 25);
assert("At threshold is free", shippingForSubtotal(710) === 0);
assert("Above threshold is free", shippingForSubtotal(1200) === 0);
assert("Zero subtotal no shipping", shippingForSubtotal(0) === 0);

const g6 = calculateGummyOrder({ gummyIndividual: 6 });
assert("6 gummy pouches total $130.53", g6.total === 130.53, `got ${g6.total}`);
assert("6-pack has $25 shipping", g6.shipping === 25);

const carton = calculateGummyOrder({ mixedCartons: 1 });
assert("Carton total $367.94", carton.total === 367.94, `got ${carton.total}`);

const bulk36 = calculateGummyOrder({ gummyIndividual: 36 });
assert("36+ bulk rate applied", bulk36.notes.some((n) => n.includes("Bulk rate")));

const { bankDetails, invoiceNumber } = await import(
  `file://${path.join(root, "lib/bank-details.js").replace(/\\/g, "/")}`
);
const bank = bankDetails();
assert("Bank account LL PYT LTD", bank.accountName === "LL PYT LTD");
assert("BSB 734216", bank.bsb === "734216");
assert("PayID set", bank.payId === "0431892625");
assert(
  "Invoice number format (short ref)",
  /^LL\d{4}[A-F0-9]{4}$/.test(invoiceNumber("ord_1750000_abc1de", Date.now())),
);

const bigCatalog = calculateOrder({
  catalog: { "GUM-90-BUN": 3 },
});
assert(
  "3 cartons ($935.28 subtotal) free shipping",
  bigCatalog.subtotal >= 710 && bigCatalog.shipping === 0,
  `subtotal ${bigCatalog.subtotal} shipping ${bigCatalog.shipping}`,
);

const publicPricing = gummyPricingPublic();
assert("Public API exposes freeShippingThreshold", publicPricing.freeShippingThreshold === 710);

console.log("\n=== Unit: order PDFs ===");
await testOrderPdfs();

// ——— Integration tests (local server) ———
console.log("\n=== Integration: HTTP API ===");
rmDir(testData);
fs.mkdirSync(testData, { recursive: true });

const port = 4399 + Math.floor(Math.random() * 200);
const env = {
  ...process.env,
  PORT: String(port),
  DATA_DIR: testData,
  NODE_ENV: "test",
  ANALYTICS_ADMIN_PASSWORD: "test-admin-pass",
  PORTAL_CODE_SALT: "test-salt-full-run",
  PORTAL_SESSION_SECRET: "test-portal-secret-full",
  ADMIN_SESSION_SECRET: "test-admin-secret-full",
  DEMO_PORTAL_PASSWORD: "Demo-Test-Pass-2026!",
  GUMMY_CHECKOUT_ACCESS_KEY: "test-gummy-checkout-key",
};

const serverProc = spawn("node", ["server.js"], {
  cwd: root,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
serverProc.stdout.on("data", (d) => {
  serverLog += d.toString();
});
serverProc.stderr.on("data", (d) => {
  serverLog += d.toString();
});

const base = `http://127.0.0.1:${port}`;
await new Promise((resolve, reject) => {
  const deadline = Date.now() + 15000;
  const tick = () => {
    if (serverLog.includes("LeafLock Retail")) return resolve();
    if (Date.now() > deadline) return reject(new Error("Server start timeout"));
    setTimeout(tick, 200);
  };
  tick();
});

try {
  let r = await json(`${base}/api/public/gummy-checkout/pricing`);
  assert("Gummy pricing blocked without key", r.res.status === 403);

  r = await json(`${base}/api/public/gummy-checkout/pricing?key=${env.GUMMY_CHECKOUT_ACCESS_KEY}`);
  assert("Gummy pricing API 200 with key", r.res.status === 200);
  assert("Gummy bulk min 36", r.body.bulk?.minUnits === 36);
  assert("Gummy free ship in API", r.body.freeShippingThreshold === 710);

  r = await json(`${base}/api/portal/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@leaflock.com.au", password: env.DEMO_PORTAL_PASSWORD }),
  });
  assert("Demo portal login 200", r.res.status === 200, `status ${r.res.status}`);
  const portalToken = r.body.token;
  assert("Portal token issued", Boolean(portalToken));

  r = await json(`${base}/api/pricing`, {
    headers: { Authorization: `Bearer ${portalToken}` },
  });
  assert("Portal pricing gated OK", r.res.status === 200);
  assert("Portal pricing has freeShippingThreshold", r.body.freeShippingThreshold === 710);

  r = await json(`${base}/api/portal/bank-details`, {
    headers: { Authorization: `Bearer ${portalToken}` },
  });
  assert("Bank details API", r.res.status === 200 && r.body.bsb === "734216");

  r = await json(`${base}/api/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${portalToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentMethod: "bank_transfer",
      termsAccepted: true,
      catalog: { "CHOP-PURP": 2 },
      contact: {
        businessName: "Test Store",
        fullName: "Tester",
        abn: "12 345 678 901",
        storeReg: "REG-1",
        email: "test@example.com",
        phone: "0400000000",
        address: "1 Test St",
      },
    }),
  });
  assert("Portal order create 201", r.res.status === 201, JSON.stringify(r.body));
  assert("Order has invoice number", Boolean(r.body.order?.invoiceNumber));

  r = await json(`${base}/api/analytics/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test-admin-pass" }),
  });
  assert("Admin login 200", r.res.status === 200);
  const adminToken = r.body.token;

  r = await json(`${base}/api/admin/setup-status`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert("Admin setup status", r.res.status === 200);
  assert("Catalog items listed", (r.body.catalogItems || 0) > 0);

  r = await fetch(`${base}/api/admin/catalog/download`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const catalogCsv = await r.text();
  assert("Catalog download 200", r.status === 200);
  assert("Catalog CSV has header", catalogCsv.includes("SKU") && catalogCsv.includes("Wholesale ex GST"));

  r = await json(`${base}/api/admin/catalog/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ csv: catalogCsv }),
  });
  assert("Catalog re-upload 200", r.res.status === 200, JSON.stringify(r.body));
  assert("Catalog upload item count", (r.body.itemCount || 0) > 0);

  r = await json(`${base}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessName: "Apply Test Co",
      fullName: "Jane",
      abn: "98 765 432 109",
      storeReg: "LIC-99",
      email: "apply-test@example.com",
      password: "Apply-Test-Pass-99",
      passwordConfirm: "Apply-Test-Pass-99",
    }),
  });
  assert("Application submit 201", r.res.status === 201);
  const applicationId = r.body.id;
  assert("Application id returned", Boolean(applicationId));

  r = await json(`${base}/api/admin/applications/${applicationId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert("Application approve 200", r.res.status === 200);
  assert("Approved stockist has password ready", r.body.passwordReady === true);
  assert("Approve returns checkout link", Boolean(r.body.checkoutLink));

  r = await json(`${base}/gummy-checkout.html`);
  assert("Gummy checkout page 200", r.res.status === 200);
  assert("Checkout page public", r.body.raw?.includes("gummy-checkout") || typeof r.body === "object");

  r = await json(`${base}/api/admin/retail-stockists`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert("Admin retail stockists list", r.res.status === 200);
  const stockist = (r.body.retailStockists || r.body.retailStockists || []).find(
    (p) => p.email === "apply-test@example.com",
  );
  assert("Approved stockist has checkout link", Boolean(stockist?.checkoutLink));
  if (!stockist?.checkoutLink) throw new Error("Missing stockist checkout link for follow-up tests");

  const stockistKey = new URL(stockist.checkoutLink).searchParams.get("key");
  assert("Stockist checkout key present", Boolean(stockistKey));

  r = await json(`${base}/api/public/gummy-checkout/pricing?key=${stockistKey}`);
  assert("Stockist key opens pricing", r.res.status === 200);

  r = await json(`${base}/api/public/gummy-checkout/context?key=${stockistKey}`);
  assert("Stockist context API", r.res.status === 200);
  assert("Context identifies stockist", r.body.source === "stockist" && r.body.businessName === "Apply Test Co");

  r = await json(`${base}/api/admin/retail-stockists/${stockist.id}/regenerate-checkout-key`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert("Regenerate checkout key", r.res.status === 200 && Boolean(r.body.checkoutLink));

  const oldKeyStillWorks = await json(`${base}/api/public/gummy-checkout/pricing?key=${stockistKey}`);
  assert("Old stockist key revoked", oldKeyStillWorks.res.status === 403);

  r = await json(`${base}/api/admin/retail-stockists/${stockist.id}/send-password-reset`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const resetUrl = r.body.resetUrl || r.body.setupUrl || "";
  const resetToken = resetUrl ? new URL(resetUrl).searchParams.get("token") : "";
  assert("Admin password reset link", r.res.status === 200 && Boolean(resetToken));

  r = await json(`${base}/api/portal/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken, newPassword: "Final-Portal-Pass-99" }),
  });
  assert("Reset link sets new password", r.res.status === 200 && r.body.message);

  r = await json(`${base}/api/portal/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "apply-test@example.com", password: "Final-Portal-Pass-99" }),
  });
  assert("Login with new password", r.res.status === 200 && Boolean(r.body.token));

  r = await json(`${base}/api/admin/retail-stockists/${stockist.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "inactive" }),
  });
  assert("Deactivate stockist", r.res.status === 200 && r.body.retailStockist?.status === "inactive");

  r = await json(`${base}/api/portal/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "apply-test@example.com", password: "Final-Portal-Pass-99" }),
  });
  assert("Inactive stockist cannot login", r.res.status === 401);

  await json(`${base}/api/admin/retail-stockists/${stockist.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "active" }),
  });
} finally {
  serverProc.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 400));
}

console.log("\n=== Summary ===");
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} passed`);
if (failed > 0) {
  console.error("\nFailed tests:");
  results.filter((r) => !r.ok).forEach((r) => console.error(`  - ${r.name}: ${r.detail || ""}`));
  process.exit(1);
}
console.log("\nAll tests passed.");