/**
 * Full live verification: setup, stockists, login API, key pages.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envFile = path.join(root, "data", ".leaflock-render-env.json");
const site = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
const env = JSON.parse(fs.readFileSync(envFile, "utf8").replace(/^\uFEFF/, ""));

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function adminToken() {
  const login = await fetch(`${site}/api/analytics/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: env.ANALYTICS_ADMIN_PASSWORD }),
  });
  const body = await login.json();
  if (!login.ok || !body.token) throw new Error("Admin login failed");
  return body.token;
}

async function main() {
  console.log("\n=== Live pages ===");
  for (const path of ["/", "/portal.html", "/play-login.html", "/request-access.html", "/admin/"]) {
    const res = await fetch(`${site}${path}`);
    ok(`${path} returns 200`, res.status === 200, String(res.status));
  }

  const accessJs = await (await fetch(`${site}/assets/access.js`)).text();
  ok("Portal JS uses ping not probe", accessJs.includes("/api/portal/ping") && !accessJs.includes("__probe__"));

  const adminJs = await (await fetch(`${site}/admin/admin.js?v=20260709a`)).text();
  ok("Admin shows login email on failures", adminJs.includes("loginLogAccount"));

  console.log("\n=== Live API ===");
  const ping = await fetch(`${site}/api/portal/ping`);
  ok("Portal ping", ping.ok);

  const token = await adminToken();
  const h = { Authorization: `Bearer ${token}` };

  const setup = await (await fetch(`${site}/api/admin/setup-status`, { headers: h })).json();
  ok("SMTP configured", setup.smtpConfigured);
  ok("PayPal live", setup.paypal && setup.paypalMode === "live");
  console.log(`  dataDir runtime: ${setup.dataDir} (env: ${setup.dataDirEnv})`);

  const stockists = await (await fetch(`${site}/api/admin/retail-stockists`, { headers: h })).json();
  const active = (stockists.retailStockists || []).filter((s) => s.status === "active");
  const noPassword = active.filter((s) => !s.passwordSet);
  console.log(`\n=== Stockists (${active.length} active) ===`);
  for (const s of active) {
    console.log(`  ${s.businessName} | ${s.email} | password: ${s.passwordSet ? "yes" : "NO"}`);
  }
  ok("LeafLock account has password", active.some((s) => s.email === "secretsolutions2016@gmail.com" && s.passwordSet));

  const logRes = await fetch(`${site}/api/admin/login-log?limit=5`, { headers: h });
  const log = await logRes.json();
  ok("Login log API", Array.isArray(log.entries));

  console.log("\n=== Portal login rejects bad password ===");
  const badLogin = await fetch(`${site}/api/portal/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-a-real-user@example.com", password: "wrong" }),
  });
  ok("Bad login returns 401", badLogin.status === 401);

  if (noPassword.length) {
    console.log(`\n⚠ ${noPassword.length} active stockist(s) without password — sending reset emails...`);
    for (const s of noPassword) {
      if (s.email === "demo@leaflock.com.au") continue;
      const reset = await fetch(`${site}/api/admin/retail-stockists/${s.id}/send-password-reset`, {
        method: "POST",
        headers: h,
      });
      const body = await reset.json();
      ok(`Reset email to ${s.email}`, reset.ok, body.error || "");
    }
  }

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll live checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});