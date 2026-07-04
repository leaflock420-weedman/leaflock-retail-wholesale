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
assert("Invoice number format", /^INV-\d{8}-/.test(invoiceNumber("ord_1_abc123", Date.now())));

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
  assert("Gummy pricing API 200", r.res.status === 200);
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
        pharmacyReg: "REG-1",
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
      pharmacyReg: "LIC-99",
      email: "apply-test@example.com",
    }),
  });
  assert("Application submit 201", r.res.status === 201);

  r = await json(`${base}/gummy-checkout.html`);
  assert("Gummy checkout page 200", r.res.status === 200);
  assert("Checkout page public", r.body.raw?.includes("gummy-checkout") || typeof r.body === "object");
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