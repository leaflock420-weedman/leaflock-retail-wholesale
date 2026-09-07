const fs = require("fs");
const path = require("path");

const REST_URL = String(process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const REST_TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN || "");
const KEY_PREFIX = String(process.env.REMOTE_DATA_PREFIX || "leaflock:retail-wholesale:v1");

const REMOTE_FILES = [
  "applications.json",
  "retail-stockists.json",
  "orders.json",
  "login-log.json",
  "credit-applications.json",
  "events.json",
  "meta.json",
  "wholesale-catalog.csv",
];

const pending = new Map();

function configured() {
  return Boolean(REST_URL && REST_TOKEN);
}

function keyFor(filePath) {
  return `${KEY_PREFIX}:${path.basename(filePath)}`;
}

async function command(parts) {
  const response = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parts),
  });
  if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

function queueRemoteSave(filePath, payload) {
  if (!configured()) return;
  const baseName = path.basename(filePath);
  if (!REMOTE_FILES.includes(baseName)) return;

  const previous = pending.get(baseName) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => command(["SET", keyFor(filePath), String(payload)]))
    .catch((err) => console.error(`[remote-data] save failed ${baseName}:`, err.message))
    .finally(() => {
      if (pending.get(baseName) === next) pending.delete(baseName);
    });
  pending.set(baseName, next);
}

async function hydrateDataDir(dataDir) {
  if (!configured()) {
    console.warn("[remote-data] durable storage is not configured");
    return { configured: false, restored: [] };
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const restored = [];
  for (const baseName of REMOTE_FILES) {
    const payload = await command(["GET", `${KEY_PREFIX}:${baseName}`]);
    if (payload == null) continue;
    const filePath = path.join(dataDir, baseName);
    const tempPath = `${filePath}.${Date.now()}.remote.tmp`;
    fs.writeFileSync(tempPath, payload, "utf8");
    fs.renameSync(tempPath, filePath);
    restored.push(baseName);
  }
  console.log(`[remote-data] restored ${restored.length} file(s) from durable storage`);
  return { configured: true, restored };
}

async function flushRemoteWrites() {
  await Promise.allSettled([...pending.values()]);
}

module.exports = {
  REMOTE_FILES,
  configured,
  hydrateDataDir,
  queueRemoteSave,
  flushRemoteWrites,
};
