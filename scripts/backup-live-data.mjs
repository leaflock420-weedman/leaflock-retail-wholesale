/**
 * Download a full JSON snapshot from live admin before deploys.
 * Usage: node scripts/backup-live-data.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const envFile = path.join(root, "data", ".leaflock-render-env.json");
const site = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
const outDir = path.join(root, "data", "deploy-snapshots");

function readAdminPassword() {
  if (process.env.ANALYTICS_ADMIN_PASSWORD) return process.env.ANALYTICS_ADMIN_PASSWORD;
  if (!fs.existsSync(envFile)) throw new Error("Missing ANALYTICS_ADMIN_PASSWORD and data/.leaflock-render-env.json");
  const json = JSON.parse(fs.readFileSync(envFile, "utf8").replace(/^\uFEFF/, ""));
  return json.ANALYTICS_ADMIN_PASSWORD;
}

async function main() {
  const password = readAdminPassword();
  const login = await fetch(`${site}/api/analytics/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!login.ok) throw new Error(`Admin login failed (${login.status})`);
  const { token } = await login.json();
  await fetch(`${site}/api/admin/data/backup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const snapRes = await fetch(`${site}/api/admin/data/snapshot`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!snapRes.ok) throw new Error(`Snapshot failed (${snapRes.status})`);
  const snapshot = await snapRes.json();
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(
    path.join(outDir, "latest-snapshot.json"),
    JSON.stringify({ file, exportedAt: snapshot.exportedAt, savedAt: Date.now() }, null, 2),
  );
  const carryoverFile = path.join(root, "data", "live-carryover-snapshot.json");
  const carryover = JSON.parse(JSON.stringify(snapshot));
  const carryoverStockists = carryover.files?.["retail-stockists.json"]?.retailStockists;
  if (Array.isArray(carryoverStockists)) {
    for (const stockist of carryoverStockists) {
      delete stockist.passwordHash;
      delete stockist.passwordTokenHash;
      delete stockist.passwordSetupCodeHash;
      delete stockist.passwordTokenExpiresAt;
      delete stockist.passwordTokenPurpose;
      delete stockist.passwordSetAt;
      stockist.mustChangePassword = false;
    }
  }
  fs.writeFileSync(carryoverFile, JSON.stringify(carryover, null, 2));
  const apps = snapshot.files?.["applications.json"]?.applications?.length ?? 0;
  const pending =
    snapshot.files?.["applications.json"]?.applications?.filter((a) => a.status === "pending").length ?? 0;
  const stockists = snapshot.files?.["retail-stockists.json"]?.retailStockists?.length ?? 0;
  const events = snapshot.files?.["events.json"]?.length ?? 0;
  console.log(`Saved live data snapshot: ${file}`);
  console.log(`Captured: ${apps} application(s) (${pending} pending), ${stockists} stockist(s), ${events} analytics events`);
  console.log(`Carryover snapshot updated: ${carryoverFile}`);
}

main().catch((err) => {
  console.error("[backup-live-data]", err.message);
  process.exit(process.env.DEPLOY_STRICT ? 1 : 0);
});