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
  "admin-audit.json",
  "wholesale-catalog.csv",
];

const pending = new Map();
const VERSIONED_FILES = new Set([
  "applications.json",
  "retail-stockists.json",
  "orders.json",
  "credit-applications.json",
  "wholesale-catalog.csv",
  "admin-audit.json",
]);
const VERSION_TTL_SECONDS = Number(process.env.REMOTE_DATA_VERSION_TTL_SECONDS || 90 * 24 * 60 * 60);
const state = {
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  restoredAt: null,
};

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
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

async function withRetry(work, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await work();
      state.lastSuccessAt = Date.now();
      state.lastError = null;
      return result;
    } catch (err) {
      lastError = err;
      state.lastErrorAt = Date.now();
      state.lastError = err.message;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastError;
}

async function saveRemote(baseName, payload) {
  await withRetry(() => command(["SET", `${KEY_PREFIX}:${baseName}`, String(payload)]));
  if (!VERSIONED_FILES.has(baseName)) return;
  const versionKey = `${KEY_PREFIX}:history:${baseName}:${Date.now()}`;
  await withRetry(() => command(["SET", versionKey, String(payload)]));
  await withRetry(() => command(["EXPIRE", versionKey, VERSION_TTL_SECONDS]));
}

function queueRemoteSave(filePath, payload) {
  if (!configured()) return;
  const baseName = path.basename(filePath);
  if (!REMOTE_FILES.includes(baseName)) return;

  const previous = pending.get(baseName) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => saveRemote(baseName, payload))
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
    const payload = await withRetry(() => command(["GET", `${KEY_PREFIX}:${baseName}`]));
    if (payload == null) continue;
    const filePath = path.join(dataDir, baseName);
    const tempPath = `${filePath}.${Date.now()}.remote.tmp`;
    fs.writeFileSync(tempPath, payload, "utf8");
    fs.renameSync(tempPath, filePath);
    restored.push(baseName);
  }
  console.log(`[remote-data] restored ${restored.length} file(s) from durable storage`);
  state.restoredAt = Date.now();
  return { configured: true, restored };
}

async function flushRemoteWrites() {
  const results = await Promise.allSettled([...pending.values()]);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  if (state.lastError && (!state.lastSuccessAt || state.lastErrorAt > state.lastSuccessAt)) {
    throw new Error(state.lastError);
  }
  return results.length;
}

function remoteDataStatus() {
  return {
    configured: configured(),
    pendingWrites: pending.size,
    ...state,
  };
}

module.exports = {
  REMOTE_FILES,
  configured,
  hydrateDataDir,
  queueRemoteSave,
  flushRemoteWrites,
  remoteDataStatus,
};
