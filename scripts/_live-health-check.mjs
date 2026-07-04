import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const require = createRequire(import.meta.url);
const nodemailer = require("nodemailer");

const BASE = process.env.SITE_URL || "https://med.leaflock.com.au";
const envPath = path.join(root, "data", ".leaflock-render-env.json");
const env = JSON.parse((await readFile(envPath, "utf8")).replace(/^\uFEFF/, ""));

const results = [];

function ok(label, pass, detail = "") {
  results.push({ label, pass, detail });
  console.log(`${pass ? "OK" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
}

// Security headers
const head = await fetch(BASE);
const h = head.headers;
ok("HTTPS + HSTS", h.get("strict-transport-security")?.includes("max-age"));
ok("CSP header", Boolean(h.get("content-security-policy")));
ok("X-Frame-Options DENY", h.get("x-frame-options") === "DENY");
ok("X-Content-Type-Options", h.get("x-content-type-options") === "nosniff");

const dataBlock = await fetch(`${BASE}/data/pharmacies.json`);
ok("/data/ blocked", dataBlock.status === 404);

const pricingBlock = await fetch(`${BASE}/api/pricing`);
ok("Pricing gated (401)", pricingBlock.status === 401);

const portalBad = await fetch(`${BASE}/api/portal/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: "INVALID-CODE-TEST" }),
});
ok("Portal rejects bad code", portalBad.status === 401);

// Admin login + setup status
const adminLogin = await fetch(`${BASE}/api/analytics/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: env.ANALYTICS_ADMIN_PASSWORD }),
});
const adminBody = await adminLogin.json();
ok("Admin password configured", adminLogin.status !== 503);
ok("Admin login works", adminLogin.status === 200 && Boolean(adminBody.token));

if (adminBody.token) {
  const setup = await fetch(`${BASE}/api/admin/setup-status`, {
    headers: { Authorization: `Bearer ${adminBody.token}` },
  });
  const s = await setup.json();
  ok("PayPal configured", s.paypal === true, `mode=${s.paypalMode}`);
  ok("PayPal LIVE mode", s.paypalMode === "live");
  ok("SMTP configured", s.smtpConfigured === true);
  ok("Email notifications", s.email === true);
  ok("Portal session secret", s.portalSessionSecret === true);
  ok("Admin session secret", s.adminSessionSecret === true);
  ok("Portal code salt", s.portalSalt === true);
  ok("HTTPS security mode", s.httpsOnly === true);
}

// PayPal Live API auth
const ppAuth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");
const ppToken = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
  method: "POST",
  headers: {
    Authorization: `Basic ${ppAuth}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const ppData = await ppToken.json();
ok("PayPal Live API token", ppToken.ok && Boolean(ppData.access_token));

// SMTP verify (no send — avoids extra inbox noise)
const tx = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT || 587),
  secure: false,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});
try {
  await tx.verify();
  ok("SMTP connection (med@)", true);
} catch (err) {
  ok("SMTP connection (med@)", false, err.message);
}

console.log("\n--- Summary ---");
const failed = results.filter((r) => !r.pass);
if (failed.length === 0) {
  console.log("All checks passed.");
} else {
  console.log(`${failed.length} check(s) failed:`);
  failed.forEach((f) => console.log(`  - ${f.label}: ${f.detail || "failed"}`));
  process.exit(1);
}