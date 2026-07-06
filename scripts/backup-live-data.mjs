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
  console.log(`Saved live data snapshot: ${file}`);
}

main().catch((err) => {
  console.warn("[backup-live-data]", err.message);
  process.exit(0);
});