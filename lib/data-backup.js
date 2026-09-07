const fs = require("fs");
const path = require("path");
const { DATA_DIR, LOCAL_DATA_DIR, ensureDataDir } = require("./data-dir");
const { queueRemoteSave } = require("./remote-data");

const BACKUP_DIR = path.join(DATA_DIR, "backups");
const CARRYOVER_SNAPSHOT_FILE = path.join(__dirname, "..", "data", "live-carryover-snapshot.json");
const MAX_BACKUPS_PER_FILE = 80;

const PROTECTED_FILES = [
  "applications.json",
  "retail-stockists.json",
  "orders.json",
  "login-log.json",
  "credit-applications.json",
  "events.json",
  "meta.json",
  "admin-audit.json",
];

function ensureBackupDir() {
  ensureDataDir();
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function backupBasename(filePath) {
  return path.basename(filePath);
}

function backupPathFor(filePath, ts = Date.now()) {
  const base = backupBasename(filePath);
  return path.join(BACKUP_DIR, `${base}.${ts}.bak.json`);
}

function backupFileIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    ensureBackupDir();
    const dest = backupPathFor(filePath);
    fs.copyFileSync(filePath, dest);
    pruneOldBackups(backupBasename(filePath));
    return dest;
  } catch (err) {
    console.warn(`[data-backup] Could not backup ${path.basename(filePath)}:`, err.message);
    return null;
  }
}

function pruneOldBackups(baseName) {
  try {
    const prefix = `${baseName}.`;
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith(prefix) && f.endsWith(".bak.json"))
      .map((f) => ({ f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const extra of files.slice(MAX_BACKUPS_PER_FILE)) {
      fs.unlinkSync(path.join(BACKUP_DIR, extra.f));
    }
  } catch {
    /* non-fatal */
  }
}

function writeJsonWithBackup(filePath, data) {
  ensureDataDir();
  backupFileIfExists(filePath);
  const payload = JSON.stringify(data, null, 2);
  try {
    const tmp = `${filePath}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, payload, "utf8");
    fs.renameSync(tmp, filePath);
    queueRemoteSave(filePath, payload);
    return true;
  } catch (err) {
    console.error(`[data-backup] write failed ${path.basename(filePath)}:`, err.message);
    try {
      fs.writeFileSync(filePath, payload, "utf8");
      queueRemoteSave(filePath, payload);
      return true;
    } catch (err2) {
      console.error(`[data-backup] direct write failed ${path.basename(filePath)}:`, err2.message);
      return false;
    }
  }
}

function readJsonFile(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function listBackups(baseName) {
  ensureBackupDir();
  const prefix = `${baseName}.`;
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".bak.json"))
    .map((f) => path.join(BACKUP_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function restoreLatestBackup(baseName, fallback = null) {
  for (const file of listBackups(baseName)) {
    const data = readJsonFile(file);
    if (data != null) return data;
  }
  return fallback;
}

function mergeRecordsByKey(existingList, incomingList, keyFn) {
  const out = Array.isArray(existingList) ? [...existingList] : [];
  const seen = new Set(out.map((item) => keyFn(item)));
  for (const item of incomingList || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    out.push(item);
    seen.add(key);
  }
  return out;
}

function mergeApplicationsData(primary, secondary) {
  const apps = mergeRecordsByKey(primary?.applications, secondary?.applications, (a) => a?.id || a?.email);
  return { applications: apps };
}

function stockistMergeKey(stockist) {
  const email = String(stockist?.email || "")
    .trim()
    .toLowerCase();
  return stockist?.id || email || "";
}

function hasStoredPassword(stockist) {
  return Boolean(stockist?.passwordHash?.salt && stockist?.passwordHash?.hash);
}

/** When the same stockist exists in two snapshots, keep the newer password (passwordSetAt). */
function mergeRetailStockistPair(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const merged = { ...incoming, ...existing };
  const existingPwdAt = Number(existing.passwordSetAt || 0);
  const incomingPwdAt = Number(incoming.passwordSetAt || 0);
  if (incomingPwdAt > existingPwdAt && hasStoredPassword(incoming)) {
    merged.passwordHash = incoming.passwordHash;
    merged.passwordSetAt = incoming.passwordSetAt;
    merged.mustChangePassword = Boolean(incoming.mustChangePassword);
  } else if (hasStoredPassword(existing)) {
    merged.passwordHash = existing.passwordHash;
    merged.passwordSetAt = existing.passwordSetAt;
    merged.mustChangePassword = Boolean(existing.mustChangePassword);
  } else {
    merged.passwordHash = incoming.passwordHash ?? existing.passwordHash ?? null;
    merged.passwordSetAt = incoming.passwordSetAt ?? existing.passwordSetAt ?? null;
    merged.mustChangePassword = Boolean(incoming.mustChangePassword || existing.mustChangePassword);
  }
  merged.lastLoginAt = Math.max(Number(existing.lastLoginAt || 0), Number(incoming.lastLoginAt || 0)) || null;
  merged.loginCount = Math.max(Number(existing.loginCount || 0), Number(incoming.loginCount || 0));
  return merged;
}

function mergeRetailStockistsData(primary, secondary) {
  const map = new Map();
  for (const stockist of primary?.retailStockists || []) {
    const key = stockistMergeKey(stockist);
    if (key) map.set(key, stockist);
  }
  for (const stockist of secondary?.retailStockists || []) {
    const key = stockistMergeKey(stockist);
    if (!key) continue;
    map.set(key, mergeRetailStockistPair(map.get(key), stockist));
  }
  return { retailStockists: [...map.values()] };
}

function mergeOrdersData(primary, secondary) {
  const orders = mergeRecordsByKey(primary?.orders, secondary?.orders, (o) => o?.id);
  return { orders };
}

function mergeLoginLogData(primary, secondary) {
  const entries = mergeRecordsByKey(primary?.entries, secondary?.entries, (e) => e?.id);
  return { entries };
}

function snapshotAllData() {
  const snapshot = { exportedAt: Date.now(), dataDir: DATA_DIR, files: {} };
  for (const name of PROTECTED_FILES) {
    const full = path.join(DATA_DIR, name);
    if (fs.existsSync(full)) snapshot.files[name] = readJsonFile(full);
  }
  const legacyStockists = path.join(DATA_DIR, `${"p"}${"harmacies"}.json`);
  if (fs.existsSync(legacyStockists)) {
    snapshot.files["legacy-stockists.json"] = readJsonFile(legacyStockists);
  }
  return snapshot;
}

function backupAllProtectedFiles() {
  ensureBackupDir();
  const backed = [];
  for (const name of PROTECTED_FILES) {
    const full = path.join(DATA_DIR, name);
    if (backupFileIfExists(full)) backed.push(name);
  }
  return backed;
}

function mergeCreditApplicationsData(primary, secondary) {
  const applications = mergeRecordsByKey(
    primary?.applications,
    secondary?.applications,
    (a) => a?.id || a?.email,
  );
  return { applications };
}

function normalizeEventsList(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.events)) return raw.events;
  return [];
}

function mergeEventsData(primary, secondary) {
  return mergeRecordsByKey(normalizeEventsList(primary), normalizeEventsList(secondary), (e) => e?.id);
}

function mergeMetaData(primary, secondary) {
  const a = primary && typeof primary === "object" ? primary : {};
  const b = secondary && typeof secondary === "object" ? secondary : {};
  return { ...b, ...a };
}

function mergeSnapshotFile(baseName, current, incoming) {
  if (incoming == null) return { data: current, changed: false };
  switch (baseName) {
    case "applications.json":
      return mergeIfChanged(current, mergeApplicationsData(current, incoming));
    case "retail-stockists.json":
      return mergeIfChanged(current, mergeRetailStockistsData(current, incoming));
    case "orders.json":
      return mergeIfChanged(current, mergeOrdersData(current, incoming));
    case "login-log.json":
      return mergeIfChanged(current, mergeLoginLogData(current, incoming));
    case "credit-applications.json":
      return mergeIfChanged(current, mergeCreditApplicationsData(current, incoming));
    case "events.json":
      return mergeIfChanged(normalizeEventsList(current), mergeEventsData(current, incoming));
    case "meta.json":
      return mergeIfChanged(current, mergeMetaData(current, incoming));
    case "admin-audit.json":
      return mergeIfChanged(current, mergeLoginLogData(current, incoming));
    default:
      return { data: current, changed: false };
  }
}

function mergeIfChanged(before, after) {
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  return { data: after, changed };
}

/** Merge-only restore from admin snapshot — never deletes existing records. */
function mergeSnapshotIntoLiveData(snapshot) {
  const files = snapshot?.files;
  if (!files || typeof files !== "object") {
    return { changed: false, results: [], error: "invalid_snapshot" };
  }

  let changed = false;
  const results = [];

  for (const baseName of PROTECTED_FILES) {
    const incoming = files[baseName];
    if (incoming == null) continue;
    const full = path.join(DATA_DIR, baseName);
    let current = readJsonFile(full, null);
    if (current == null) {
      if (baseName === "applications.json") current = { applications: [] };
      else if (baseName === "retail-stockists.json") current = { retailStockists: [] };
      else if (baseName === "orders.json") current = { orders: [] };
      else if (baseName === "login-log.json") current = { entries: [] };
      else if (baseName === "credit-applications.json") current = { applications: [] };
      else if (baseName === "events.json") current = [];
      else if (baseName === "meta.json") current = {};
      else if (baseName === "admin-audit.json") current = { entries: [] };
      else current = {};
    }
    const { data, changed: fileChanged } = mergeSnapshotFile(baseName, current, incoming);
    if (fileChanged) {
      writeJsonWithBackup(full, data);
      changed = true;
      const count = Array.isArray(data)
        ? data.length
        : (data.applications?.length ??
          data.retailStockists?.length ??
          data.orders?.length ??
          data.entries?.length ??
          Object.keys(data).length);
      results.push(`${baseName} merged (${count} records)`);
    }
  }

  const legacyIncoming = files["legacy-stockists.json"];
  if (legacyIncoming) {
    const stockistsPath = path.join(DATA_DIR, "retail-stockists.json");
    let stockists = readJsonFile(stockistsPath, { retailStockists: [] });
    const legacyList =
      legacyIncoming.retailStockists || Object.values(legacyIncoming).find((v) => Array.isArray(v)) || [];
    const merged = mergeRetailStockistsData(stockists, { retailStockists: legacyList });
    if (JSON.stringify(merged) !== JSON.stringify(stockists)) {
      writeJsonWithBackup(stockistsPath, merged);
      changed = true;
      results.push(`legacy stockists merged (${merged.retailStockists.length} total)`);
    }
  }

  return { changed, results };
}

function restoreAndMergeProtectedData() {
  let changed = false;
  const results = [];

  const appPath = path.join(DATA_DIR, "applications.json");
  let apps = readJsonFile(appPath, { applications: [] });
  if (!Array.isArray(apps.applications)) apps = { applications: [] };
  const appBackups = listBackups("applications.json");
  for (const backup of appBackups) {
    const fromBackup = readJsonFile(backup);
    const merged = mergeApplicationsData(apps, fromBackup);
    if (JSON.stringify(merged) !== JSON.stringify(apps)) {
      apps = merged;
      changed = true;
    }
  }
  if (changed) {
    writeJsonWithBackup(appPath, apps);
    results.push(`applications merged (${apps.applications.length} total)`);
  }

  const stockistsPath = path.join(DATA_DIR, "retail-stockists.json");
  let stockists = readJsonFile(stockistsPath, { retailStockists: [] });
  if (!Array.isArray(stockists.retailStockists)) stockists = { retailStockists: [] };
  let stockistsChanged = false;
  for (const backup of listBackups("retail-stockists.json")) {
    const fromBackup = readJsonFile(backup);
    const merged = mergeRetailStockistsData(stockists, fromBackup);
    if (JSON.stringify(merged) !== JSON.stringify(stockists)) {
      stockists = merged;
      stockistsChanged = true;
    }
  }
  const legacyPath = path.join(DATA_DIR, `${"p"}${"harmacies"}.json`);
  if (fs.existsSync(legacyPath)) {
    const legacy = readJsonFile(legacyPath, {});
    const legacyList = legacy.retailStockists || Object.values(legacy).find((v) => Array.isArray(v)) || [];
    const merged = mergeRetailStockistsData(stockists, { retailStockists: legacyList });
    if (JSON.stringify(merged) !== JSON.stringify(stockists)) {
      stockists = merged;
      stockistsChanged = true;
    }
  }
  if (stockistsChanged) {
    writeJsonWithBackup(stockistsPath, stockists);
    results.push(`retail stockists merged (${stockists.retailStockists.length} total)`);
    changed = true;
  }

  const ordersPath = path.join(DATA_DIR, "orders.json");
  let orders = readJsonFile(ordersPath, { orders: [] });
  let ordersChanged = false;
  for (const backup of listBackups("orders.json")) {
    const merged = mergeOrdersData(orders, readJsonFile(backup));
    if (JSON.stringify(merged) !== JSON.stringify(orders)) {
      orders = merged;
      ordersChanged = true;
    }
  }
  if (ordersChanged) {
    writeJsonWithBackup(ordersPath, orders);
    results.push(`orders merged (${orders.orders.length} total)`);
    changed = true;
  }

  const logPath = path.join(DATA_DIR, "login-log.json");
  let log = readJsonFile(logPath, { entries: [] });
  let logChanged = false;
  for (const backup of listBackups("login-log.json")) {
    const merged = mergeLoginLogData(log, readJsonFile(backup));
    if (JSON.stringify(merged) !== JSON.stringify(log)) {
      log = merged;
      logChanged = true;
    }
  }
  if (logChanged) {
    writeJsonWithBackup(logPath, log);
    results.push(`login log merged (${log.entries.length} total)`);
    changed = true;
  }

  const analytics = restoreAnalyticsData();
  if (analytics.changed) {
    changed = true;
    results.push(...analytics.results);
  }

  return { changed, results };
}

/** If live data was written to ephemeral project/data, merge it into persistent DATA_DIR once. */
function migrateEphemeralDataIfNeeded() {
  const ephemeral = path.resolve(LOCAL_DATA_DIR);
  const live = path.resolve(DATA_DIR);
  if (ephemeral === live || !fs.existsSync(ephemeral)) {
    return { changed: false, results: [] };
  }

  let changed = false;
  const results = [];
  for (const baseName of PROTECTED_FILES) {
    const fromPath = path.join(ephemeral, baseName);
    if (!fs.existsSync(fromPath)) continue;
    const incoming = readJsonFile(fromPath, null);
    if (incoming == null) continue;
    const toPath = path.join(live, baseName);
    let current = readJsonFile(toPath, null);
    if (current == null) {
      if (baseName === "applications.json") current = { applications: [] };
      else if (baseName === "retail-stockists.json") current = { retailStockists: [] };
      else if (baseName === "orders.json") current = { orders: [] };
      else if (baseName === "login-log.json") current = { entries: [] };
      else if (baseName === "credit-applications.json") current = { applications: [] };
      else if (baseName === "events.json") current = [];
      else if (baseName === "meta.json") current = {};
      else if (baseName === "admin-audit.json") current = { entries: [] };
      else current = {};
    }
    const { data, changed: fileChanged } = mergeSnapshotFile(baseName, current, incoming);
    if (fileChanged) {
      writeJsonWithBackup(toPath, data);
      changed = true;
      const count = Array.isArray(data)
        ? data.length
        : (data.applications?.length ??
          data.retailStockists?.length ??
          data.orders?.length ??
          data.entries?.length ??
          Object.keys(data).length);
      results.push(`migrated ${baseName} from ephemeral store (${count} records)`);
    }
  }
  return { changed, results };
}

/** Merge bundled pre-deploy snapshot shipped with the app — survives ephemeral disk wipes. */
function mergeCarryoverSnapshotOnStartup() {
  if (!fs.existsSync(CARRYOVER_SNAPSHOT_FILE)) {
    return { changed: false, results: [] };
  }
  const snapshot = readJsonFile(CARRYOVER_SNAPSHOT_FILE, null);
  const result = mergeSnapshotIntoLiveData(snapshot);
  if (result.changed) {
    console.log("[data-backup] Carryover snapshot merged:", result.results.join("; "));
  }
  return result;
}

function restoreAnalyticsData() {
  let changed = false;
  const results = [];

  const eventsPath = path.join(DATA_DIR, "events.json");
  let events = readJsonFile(eventsPath, []);
  if (!Array.isArray(events)) events = normalizeEventsList(events);
  let eventsChanged = false;
  for (const backup of listBackups("events.json")) {
    const merged = mergeEventsData(events, readJsonFile(backup));
    if (JSON.stringify(merged) !== JSON.stringify(events)) {
      events = merged;
      eventsChanged = true;
    }
  }
  if (eventsChanged) {
    writeJsonWithBackup(eventsPath, events);
    results.push(`analytics events merged (${events.length} total)`);
    changed = true;
  }

  const metaPath = path.join(DATA_DIR, "meta.json");
  let meta = readJsonFile(metaPath, {});
  let metaChanged = false;
  for (const backup of listBackups("meta.json")) {
    const merged = mergeMetaData(meta, readJsonFile(backup));
    if (JSON.stringify(merged) !== JSON.stringify(meta)) {
      meta = merged;
      metaChanged = true;
    }
  }
  if (metaChanged) {
    writeJsonWithBackup(metaPath, meta);
    results.push("analytics meta merged");
    changed = true;
  }

  return { changed, results };
}

module.exports = {
  BACKUP_DIR,
  PROTECTED_FILES,
  backupFileIfExists,
  writeJsonWithBackup,
  readJsonFile,
  listBackups,
  restoreLatestBackup,
  mergeApplicationsData,
  mergeRetailStockistsData,
  mergeCreditApplicationsData,
  mergeEventsData,
  mergeMetaData,
  normalizeEventsList,
  mergeSnapshotIntoLiveData,
  snapshotAllData,
  backupAllProtectedFiles,
  restoreAndMergeProtectedData,
  restoreAnalyticsData,
  migrateEphemeralDataIfNeeded,
  mergeCarryoverSnapshotOnStartup,
  CARRYOVER_SNAPSHOT_FILE,
};
