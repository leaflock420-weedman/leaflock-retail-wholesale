const fs = require("fs");
const path = require("path");
const { DATA_DIR, ensureDataDir } = require("./data-dir");

const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS_PER_FILE = 80;

const PROTECTED_FILES = [
  "applications.json",
  "retail-stockists.json",
  "orders.json",
  "login-log.json",
  "credit-applications.json",
  "events.json",
  "meta.json",
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
    return true;
  } catch (err) {
    console.error(`[data-backup] write failed ${path.basename(filePath)}:`, err.message);
    try {
      fs.writeFileSync(filePath, payload, "utf8");
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

function mergeRetailStockistsData(primary, secondary) {
  const retailStockists = mergeRecordsByKey(
    primary?.retailStockists,
    secondary?.retailStockists,
    (s) => s?.id || s?.email,
  );
  return { retailStockists };
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
  snapshotAllData,
  backupAllProtectedFiles,
  restoreAndMergeProtectedData,
};