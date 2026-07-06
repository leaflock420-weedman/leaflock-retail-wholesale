/**
 * Re-apply a pre-deploy snapshot to live (merge-only — never deletes records).
 * Usage: node scripts/restore-live-data.mjs [snapshot-file.json]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const envFile = path.join(root, "data", ".leaflock-render-env.json");
const snapDir = path.join(root, "data", "deploy-snapshots");
const latestPointer = path.join(snapDir, "latest-snapshot.json");
const site = process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";

function readAdminPassword() {
  if (process.env.ANALYTICS_ADMIN_PASSWORD) return process.env.ANALYTICS_ADMIN_PASSWORD;
  if (!fs.existsSync(envFile)) throw new Error("Missing ANALYTICS_ADMIN_PASSWORD and data/.leaflock-render-env.json");
  const json = JSON.parse(fs.readFileSync(envFile, "utf8").replace(/^\uFEFF/, ""));
  return json.ANALYTICS_ADMIN_PASSWORD;
}

function resolveSnapshotFile(argPath) {
  if (argPath && fs.existsSync(argPath)) return argPath;
  if (fs.existsSync(latestPointer)) {
    const pointer = JSON.parse(fs.readFileSync(latestPointer, "utf8"));
    if (pointer?.file && fs.existsSync(pointer.file)) return pointer.file;
  }
  if (!fs.existsSync(snapDir)) throw new Error("No deploy snapshots found");
  const files = fs
    .readdirSync(snapDir)
    .filter((f) => f.startsWith("snapshot-") && f.endsWith(".json"))
    .map((f) => ({ f, mtime: fs.statSync(path.join(snapDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) throw new Error("No deploy snapshots found");
  return path.join(snapDir, files[0].f);
}

async function adminToken(password) {
  const login = await fetch(`${site}/api/analytics/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!login.ok) throw new Error(`Admin login failed (${login.status})`);
  const { token } = await login.json();
  return token;
}

async function main() {
  const snapshotFile = resolveSnapshotFile(process.argv[2]);
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf8").replace(/^\uFEFF/, ""));
  const password = readAdminPassword();
  const token = await adminToken(password);

  const mergeRes = await fetch(`${site}/api/admin/data/merge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ snapshot }),
  });
  if (!mergeRes.ok) {
    const text = await mergeRes.text();
    throw new Error(`Merge failed (${mergeRes.status}): ${text}`);
  }
  const result = await mergeRes.json();
  const apps = result.snapshot?.files?.["applications.json"]?.applications?.length ?? "?";
  const stockists = result.snapshot?.files?.["retail-stockists.json"]?.retailStockists?.length ?? "?";
  console.log(`Restored from ${snapshotFile}`);
  console.log(`Merge results: ${(result.results || []).join("; ") || "no changes needed"}`);
  console.log(`Live now: ${apps} application(s), ${stockists} stockist(s)`);
}

main().catch((err) => {
  console.error("[restore-live-data]", err.message);
  process.exit(1);
});