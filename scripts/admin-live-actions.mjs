/**
 * Admin actions on live site: status check, password reset.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const envFile = path.join(root, "data", ".leaflock-render-env.json");
const site = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";

function readAdminPassword() {
  if (process.env.ANALYTICS_ADMIN_PASSWORD) return process.env.ANALYTICS_ADMIN_PASSWORD;
  const json = JSON.parse(fs.readFileSync(envFile, "utf8").replace(/^\uFEFF/, ""));
  return json.ANALYTICS_ADMIN_PASSWORD;
}

async function adminToken(password) {
  const login = await fetch(`${site}/api/analytics/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!login.ok) throw new Error(`Admin login failed (${login.status})`);
  return (await login.json()).token;
}

async function main() {
  const password = readAdminPassword();
  const token = await adminToken(password);
  const headers = { Authorization: `Bearer ${token}` };

  const setup = await fetch(`${site}/api/admin/setup-status`, { headers });
  const setupBody = await setup.json();
  console.log("dataDir env:", setupBody.dataDir);

  const snap = await fetch(`${site}/api/admin/data/snapshot`, { headers });
  const snapshot = await snap.json();
  const events = snapshot.files?.["events.json"]?.length ?? 0;
  const stockists = snapshot.files?.["retail-stockists.json"]?.retailStockists?.length ?? 0;
  console.log("runtime dataDir:", snapshot.dataDir);
  console.log(`live: ${stockists} stockists, ${events} analytics events`);

  const list = await fetch(`${site}/api/admin/retail-stockists`, { headers });
  const stockistList = await list.json();
  const target = (stockistList.retailStockists || []).find(
    (s) => s.email === "info@leaflock.com.au",
  );
  if (!target) throw new Error("info@leaflock.com.au stockist not found");

  const reset = await fetch(`${site}/api/admin/retail-stockists/${target.id}/send-password-reset`, {
    method: "POST",
    headers,
  });
  const resetBody = await reset.json();
  if (!reset.ok) throw new Error(`Reset failed: ${JSON.stringify(resetBody)}`);
  console.log("Password reset sent to info@leaflock.com.au");
  console.log("Reset link:", resetBody.resetUrl || resetBody.setupUrl);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});