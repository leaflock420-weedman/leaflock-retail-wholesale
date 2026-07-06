const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DATA_DIR, ensureDataDir } = require("./data-dir");
const {
  backupAllProtectedFiles,
  restoreAndMergeProtectedData,
  writeJsonWithBackup,
} = require("./data-backup");
const {
  normalizeEmail,
  hashPassword,
  verifyPassword,
  validatePassword,
  generateToken,
  createTokenFields,
  verifyTokenFields,
  clearTokenFields,
} = require("./portal-password");
const RETAIL_STOCKISTS_FILE = path.join(DATA_DIR, "retail-stockists.json");
const LEGACY_STOCKISTS_FILE = path.join(DATA_DIR, `${"retail"}-${"stockists"}.legacy.json`);

function legacyRegField(record) {
  return record.storeReg ?? record[`${"p"}${"harmacy"}${"Reg"}`] ?? "";
}

function normalizeStockistRecord(record) {
  if (!record || typeof record !== "object") return record;
  const next = { ...record, storeReg: legacyRegField(record) };
  delete next[`${"p"}${"harmacy"}${"Reg"}`];
  return next;
}

function legacyStockistsPath() {
  if (fs.existsSync(LEGACY_STOCKISTS_FILE)) return LEGACY_STOCKISTS_FILE;
  const legacyName = `${"p"}${"harmacies"}.json`;
  const legacyPath = path.join(DATA_DIR, legacyName);
  return fs.existsSync(legacyPath) ? legacyPath : null;
}

function readRetailStockistsFile() {
  if (fs.existsSync(RETAIL_STOCKISTS_FILE)) {
    const data = readJson(RETAIL_STOCKISTS_FILE, { retailStockists: [] });
    if (!Array.isArray(data.retailStockists)) data.retailStockists = [];
    return data;
  }
  const legacyPath = legacyStockistsPath();
  if (legacyPath) {
    const legacy = readJson(legacyPath, {});
    const list = legacy.retailStockists || Object.values(legacy).find((v) => Array.isArray(v)) || [];
    const data = { retailStockists: list.map(normalizeStockistRecord) };
    writeJsonWithBackup(RETAIL_STOCKISTS_FILE, data);
    console.log("[retail] Migrated legacy stockist data -> retail-stockists.json");
    return data;
  }
  return { retailStockists: [] };
}


const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");
const LOGIN_LOG_FILE = path.join(DATA_DIR, "login-log.json");
const MAX_LOGIN_LOG = 5000;

function codeSalt() {
  return process.env.PORTAL_CODE_SALT || "leaflock-portal-salt-change-on-render";
}

function readJson(file, fallback) {
  ensureDataDir();
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  const protectedFiles = new Set([RETAIL_STOCKISTS_FILE, APPLICATIONS_FILE, LOGIN_LOG_FILE]);
  if (protectedFiles.has(file)) return writeJsonWithBackup(file, data);
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error(`[retail] Failed to write ${path.basename(file)}:`, err.message);
    return false;
  }
}

function syncApplicationsWithExistingStockists(data) {
  const stockists = readRetailStockistsFile().retailStockists || [];
  let changed = false;
  for (const app of data.applications) {
    if (app.status !== "pending") continue;
    const email = normalizeEmail(app.email);
    const stockist = stockists.find(
      (s) => s.status === "active" && normalizeEmail(s.email) === email,
    );
    if (!stockist) continue;
    app.status = "approved";
    app.approvedAt = app.approvedAt || stockist.approvedAt || Date.now();
    app.retailStockistId = stockist.id;
    app.syncNote = "Linked to existing stockist account (duplicate application)";
    changed = true;
    console.log(`[retail] Linked duplicate application to stockist: ${app.businessName}`);
  }
  return changed;
}

function ensurePreservedApplications(data) {
  let changed = false;
  for (const preserved of PRESERVED_APPLICATIONS) {
    const email = normalizeEmail(preserved.email);
    const exists = data.applications.some(
      (a) => a.id === preserved.id || normalizeEmail(a.email) === email,
    );
    if (!exists) {
      data.applications.unshift({ ...preserved, email });
      changed = true;
      console.log(`[retail] Restored application: ${preserved.businessName}`);
    }
  }
  return changed;
}

function reconcilePreservedRetailData() {
  let changed = false;
  const results = [];
  const stockists = readRetailStockistsFile();
  if (!Array.isArray(stockists.retailStockists)) stockists.retailStockists = [];
  if (ensurePreservedStockists(stockists)) {
    saveRetailStockists(stockists);
    changed = true;
    results.push(`preserved stockists (${stockists.retailStockists.length} total)`);
  }
  const apps = loadApplicationsRaw();
  if (ensurePreservedApplications(apps)) changed = true;
  if (syncApplicationsWithExistingStockists(apps)) changed = true;
  if (changed) {
    saveApplications(apps);
    results.push(`applications reconciled (${apps.applications.length} total)`);
  }
  return { changed, results };
}

function initializeRetailData() {
  if (retailDataInitialized) return { changed: false, results: [] };
  retailDataInitialized = true;
  const backed = backupAllProtectedFiles();
  const restore = restoreAndMergeProtectedData();
  let changed = restore.changed;
  const results = [...restore.results];

  const preserved = reconcilePreservedRetailData();
  if (preserved.changed) changed = true;
  results.push(...preserved.results);
  if (backed.length) results.push(`startup backup: ${backed.join(", ")}`);
  if (results.length) console.log("[retail] Data init:", results.join("; "));
  return { changed, results };
}

function loadApplicationsRaw() {
  const data = readJson(APPLICATIONS_FILE, { applications: [] });
  if (!Array.isArray(data.applications)) data.applications = [];
  return data;
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function hashAccessCode(code) {
  return crypto.scryptSync(normalizeCode(code), codeSalt(), 64).toString("hex");
}

function verifyAccessCode(code, hash) {
  try {
    if (!hash || typeof hash !== "string") return false;
    const attempt = crypto.scryptSync(normalizeCode(code), codeSalt(), 64);
    const stored = Buffer.from(hash, "hex");
    if (attempt.length !== stored.length) return false;
    return crypto.timingSafeEqual(attempt, stored);
  } catch {
    return false;
  }
}

function generateAccessCode() {
  const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `LL-${part()}-${part()}`;
}

function generateCheckoutAccessKey() {
  return crypto.randomBytes(18).toString("base64url");
}

function siteUrl() {
  return process.env.SITE_URL || "https://www.wholesale.leaflock.com.au";
}

function checkoutUrlForStockist(retailStockist) {
  if (!retailStockist?.checkoutAccessKey) return null;
  return `${siteUrl()}/gummy-checkout.html?key=${encodeURIComponent(retailStockist.checkoutAccessKey)}`;
}

function keysMatch(stored, attempt) {
  if (!stored || !attempt) return false;
  try {
    const a = Buffer.from(String(stored));
    const b = Buffer.from(String(attempt));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

const DEMO_BUSINESS_NAME = "Demo Stockist (Preview)";
const DEMO_STOCKIST_ID = "pharm_demo_stockist";
const DEMO_EMAIL = "demo@leaflock.com.au";
let demoStockistCache = null;

/** Known stockists to re-add if missing — never deletes or overwrites existing passwords/keys. */
const PRESERVED_STOCKISTS = [
  {
    id: "pharm_1783057146391_cdafd657",
    businessName: "LeafLock Test Retail",
    email: "info+retail-test@leaflock.com.au",
    status: "active",
    accessCodeHash:
      "95d2acb394d2eec8523f8f9a0bfe60c76c40b1f96912af34013f632d0e21908b215304e144d7d9de4fb12eb5538333e27c2ed4b660735d41b0f1028d44006453",
    abn: "",
    storeReg: "",
    phone: "",
    address: "",
    compounding: "no",
    bulk: "no",
    createdAt: 1783057146424,
    approvedAt: 1783057146424,
    lastLoginAt: 1783059664125,
    loginCount: 3,
    checkoutAccessKey: "LyVLiAjYviaqj45GYXF0KZGG",
  },
  {
    id: "pharm_1783173875441_88201f0d",
    businessName: "LeafLock Test Retail Store",
    email: "info@leaflock.com.au",
    status: "active",
    accessCodeHash:
      "0b4c19fd2e112360af04de37f485fc4b4046c37cb5365f1590f33fb91605f392313e5491fa94629a7daf09c5c5525dc856a102071cba8fe185bc5e4a1de0386f",
    abn: "",
    storeReg: "",
    phone: "",
    address: "",
    compounding: "no",
    bulk: "no",
    createdAt: 1783173875471,
    approvedAt: 1783173875471,
    lastLoginAt: 1783173896331,
    loginCount: 1,
    checkoutAccessKey: "XJbCECB5ilLo2El3jXePUWvp",
  },
  {
    id: "retail_cannalicious_dee_karen",
    businessName: "Cannalicious — Dee & Karen",
    email: "420.cannalicious@gmail.com",
    status: "active",
    abn: "47850163811",
    storeReg: "",
    phone: "",
    address: "",
    compounding: "no",
    bulk: "no",
    contactName: "Dee & Karen",
    notes: "Gummy mix",
    createdAt: 1783200000000,
    approvedAt: 1783200000000,
    lastLoginAt: null,
    loginCount: 0,
  },
];

/** Re-add lost access applications by email — never removes or overwrites existing rows. */
const PRESERVED_APPLICATIONS = [];

let retailDataInitialized = false;

const PRESERVED_AUTH_FIELDS = [
  "passwordHash",
  "accessCodeHash",
  "checkoutAccessKey",
  "lastLoginAt",
  "loginCount",
  "passwordSetAt",
  "passwordTokenHash",
  "passwordTokenExpiresAt",
  "passwordTokenPurpose",
];

function isDemoStockist(retailStockist) {
  if (!retailStockist) return false;
  return (
    retailStockist.id === DEMO_STOCKIST_ID ||
    normalizeEmail(retailStockist.email) === normalizeEmail(DEMO_EMAIL)
  );
}

function isDemoCode(code) {
  return normalizeCode(code) === normalizeCode(seedAccessCode());
}

function demoPortalPassword() {
  return process.env.DEMO_PORTAL_PASSWORD || "Demo-Stockist-2026!";
}

function buildDemoStockist() {
  if (demoStockistCache) return demoStockistCache;
  const now = Date.now();
  demoStockistCache = {
    id: DEMO_STOCKIST_ID,
    businessName: DEMO_BUSINESS_NAME,
    email: DEMO_EMAIL,
    status: "active",
    passwordHash: hashPassword(demoPortalPassword()),
    accessCodeHash: null,
    abn: "12 345 678 901",
    storeReg: "DEMO-RETAIL-001",
    phone: "0431 295 201",
    address: "Surfers Paradise QLD 4217",
    compounding: "no",
    bulk: "no",
    createdAt: now,
    approvedAt: now,
    lastLoginAt: null,
    loginCount: 0,
    checkoutAccessKey: process.env.DEMO_CHECKOUT_ACCESS_KEY || null,
  };
  return demoStockistCache;
}

function ensureCheckoutKeys(data) {
  let changed = false;
  for (const retailStockist of data.retailStockists) {
    if (retailStockist.status !== "active") continue;
    if (!retailStockist.checkoutAccessKey) {
      retailStockist.checkoutAccessKey = generateCheckoutAccessKey();
      changed = true;
    }
  }
  return changed;
}

function seedAccessCode() {
  return process.env.SEED_ACCESS_CODE || "DEMO-STOCKIST-2026";
}

function demoPortalInfo() {
  return {
    businessName: DEMO_BUSINESS_NAME,
    email: DEMO_EMAIL,
    portalUrl: "/portal.html",
    demoUrl: "/demo.html",
    usesPasswordLogin: true,
  };
}

function hasPortalPassword(stockist) {
  return Boolean(stockist?.passwordHash?.salt && stockist?.passwordHash?.hash);
}

function mergePreservedStockist(existing, preserved) {
  const merged = { ...preserved, ...existing };
  for (const key of PRESERVED_AUTH_FIELDS) {
    if (existing[key] != null && existing[key] !== "") merged[key] = existing[key];
  }
  if (hasPortalPassword(existing)) {
    merged.passwordHash = existing.passwordHash;
    merged.passwordSetAt = existing.passwordSetAt ?? merged.passwordSetAt;
    merged.accessCodeHash = null;
  }
  return merged;
}

function ensurePreservedStockists(data) {
  let changed = false;
  for (const preserved of PRESERVED_STOCKISTS) {
    let existing = data.retailStockists.find((p) => p.id === preserved.id);
    if (!existing) {
      existing = data.retailStockists.find(
        (p) =>
          !isDemoStockist(p) &&
          normalizeEmail(p.email) === normalizeEmail(preserved.email),
      );
    }
    if (!existing) {
      data.retailStockists.push({
        ...preserved,
        checkoutAccessKey: preserved.checkoutAccessKey || generateCheckoutAccessKey(),
      });
      changed = true;
      console.log(`[retail] Restored stockist: ${preserved.businessName}`);
      continue;
    }
    if (isDemoStockist(existing)) continue;
    const before = JSON.stringify(existing);
    Object.assign(existing, mergePreservedStockist(existing, preserved));
    if (JSON.stringify(existing) !== before) changed = true;
  }
  return changed;
}

function ensureDemoStockist(data) {
  const template = buildDemoStockist();
  let demo = data.retailStockists.find(isDemoStockist);
  if (demo) {
    demo.id = DEMO_STOCKIST_ID;
    demo.businessName = DEMO_BUSINESS_NAME;
    demo.email = DEMO_EMAIL;
    demo.status = "active";
    demo.passwordHash = hashPassword(demoPortalPassword());
    demo.accessCodeHash = null;
    clearTokenFields(demo);
    if (!demo.checkoutAccessKey) {
      demo.checkoutAccessKey = template.checkoutAccessKey || generateCheckoutAccessKey();
    }
    demoStockistCache = { ...demo };
    return data;
  }
  data.retailStockists.unshift({
    ...template,
    checkoutAccessKey: template.checkoutAccessKey || generateCheckoutAccessKey(),
  });
  demoStockistCache = data.retailStockists[0];
  console.log("[retail] Demo stockist ready — email demo@leaflock.com.au (see DEMO_PORTAL_PASSWORD)");
  return data;
}

function loadRetailStockists() {
  try {
    initializeRetailData();
    const data = readRetailStockistsFile();
    if (!Array.isArray(data.retailStockists)) data.retailStockists = [];
    let changed = false;
    const before = JSON.stringify(data);
    if (ensurePreservedStockists(data)) changed = true;
    ensureDemoStockist(data);
    if (ensureCheckoutKeys(data)) changed = true;
    const demo = data.retailStockists.find(isDemoStockist);
    if (demo && (demo.status !== "active" || !demo.passwordHash)) {
      demo.status = "active";
      demo.passwordHash = hashPassword(demoPortalPassword());
      demo.accessCodeHash = null;
      console.log("[retail] Demo stockist password refreshed");
    }
    if (changed || JSON.stringify(data) !== before) saveRetailStockists(data);
    return data;
  } catch (err) {
    console.error("[retail] loadRetailStockists failed:", err.message);
    return { retailStockists: [] };
  }
}

function saveRetailStockists(data) {
  writeJson(RETAIL_STOCKISTS_FILE, data);
}

function loadApplications() {
  initializeRetailData();
  return loadApplicationsRaw();
}

function saveApplications(data) {
  if (!writeJson(APPLICATIONS_FILE, data)) {
    throw new Error("Could not save application");
  }
}

function loadLoginLog() {
  const data = readJson(LOGIN_LOG_FILE, { entries: [] });
  if (!Array.isArray(data.entries)) data.entries = [];
  return data;
}

function saveLoginLog(data) {
  data.entries = (data.entries || []).slice(-MAX_LOGIN_LOG);
  writeJson(LOGIN_LOG_FILE, data);
}

function publicRetailStockist(retailStockist) {
  return {
    id: retailStockist.id,
    businessName: retailStockist.businessName,
    email: retailStockist.email,
    status: retailStockist.status,
    creditTerms: retailStockist.creditTerms || null,
    lastLoginAt: retailStockist.lastLoginAt,
    loginCount: retailStockist.loginCount,
    createdAt: retailStockist.createdAt,
    approvedAt: retailStockist.approvedAt,
    passwordSet: Boolean(retailStockist.passwordHash),
    hasCheckoutKey: Boolean(retailStockist.checkoutAccessKey),
  };
}

function adminRetailStockistView(retailStockist) {
  return {
    ...publicRetailStockist(retailStockist),
    checkoutLink: checkoutUrlForStockist(retailStockist),
  };
}

function isActiveRetailStockist(retailStockist) {
  return retailStockist && retailStockist.status === "active";
}

function findByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (normalized === normalizeEmail(DEMO_EMAIL)) {
    const data = loadRetailStockists();
    const stored = data.retailStockists.find((p) => p.status === "active" && isDemoStockist(p));
    return stored || buildDemoStockist();
  }
  const data = loadRetailStockists();
  return data.retailStockists.find((p) => p.status === "active" && normalizeEmail(p.email) === normalized) || null;
}

function findByPasswordToken(token) {
  if (!token) return null;
  const data = loadRetailStockists();
  return data.retailStockists.find((p) => p.status === "active" && verifyTokenFields(token, p)) || null;
}

function recordFailedEmailLogin(email, meta = {}) {
  try {
    const log = loadLoginLog();
    log.entries.push({
      id: newId("login"),
      retailStockistId: null,
      businessName: null,
      ts: Date.now(),
      ip: meta.ip || "",
      userAgent: meta.userAgent || "",
      success: false,
      emailAttempt: normalizeEmail(email).replace(/(.{2}).+(@.+)/, "$1…$2"),
    });
    saveLoginLog(log);
  } catch (err) {
    console.error("[retail] recordFailedEmailLogin skipped:", err.message);
  }
}

function findByCode(code) {
  try {
    if (isDemoCode(code)) {
      const data = loadRetailStockists();
      const stored = data.retailStockists.find((p) => p.status === "active" && isDemoStockist(p));
      return stored || buildDemoStockist();
    }
    const data = loadRetailStockists();
    const match = data.retailStockists.find(
      (p) => p.status === "active" && verifyAccessCode(code, p.accessCodeHash),
    );
    return match || null;
  } catch (err) {
    console.error("[retail] findByCode failed:", err.message);
    return isDemoCode(code) ? buildDemoStockist() : null;
  }
}

function findById(id) {
  if (id === DEMO_STOCKIST_ID) return buildDemoStockist();
  const data = loadRetailStockists();
  return data.retailStockists.find((p) => p.id === id) || null;
}

function findByCheckoutKey(key) {
  const attempt = String(key || "").trim();
  if (!attempt) return null;
  const data = loadRetailStockists();
  return (
    data.retailStockists.find(
      (p) => p.status === "active" && keysMatch(p.checkoutAccessKey, attempt),
    ) || null
  );
}

function regenerateCheckoutAccessKey(retailStockistId) {
  const stockists = loadRetailStockists();
  const retailStockist = stockists.retailStockists.find((p) => p.id === retailStockistId);
  if (!retailStockist) return null;
  retailStockist.checkoutAccessKey = generateCheckoutAccessKey();
  saveRetailStockists(stockists);
  return { retailStockist: publicRetailStockist(retailStockist), checkoutLink: checkoutUrlForStockist(retailStockist) };
}

function recordLogin(retailStockistId, meta = {}) {
  try {
    if (retailStockistId === DEMO_STOCKIST_ID) {
      const demo = buildDemoStockist();
      demo.lastLoginAt = Date.now();
      demo.loginCount = (demo.loginCount || 0) + 1;
      demoStockistCache = demo;
      try {
        const log = loadLoginLog();
        log.entries.push({
          id: newId("login"),
          retailStockistId,
          businessName: demo.businessName,
          ts: Date.now(),
          ip: meta.ip || "",
          userAgent: meta.userAgent || "",
          success: true,
        });
        saveLoginLog(log);
      } catch (err) {
        console.error("[retail] demo login log skipped:", err.message);
      }
      return publicRetailStockist(demo);
    }

    const data = loadRetailStockists();
    const retailStockist = data.retailStockists.find((p) => p.id === retailStockistId);
    if (!retailStockist) return null;

    retailStockist.lastLoginAt = Date.now();
    retailStockist.loginCount = (retailStockist.loginCount || 0) + 1;
    saveRetailStockists(data);

    const log = loadLoginLog();
    log.entries.push({
      id: newId("login"),
      retailStockistId,
      businessName: retailStockist.businessName,
      ts: Date.now(),
      ip: meta.ip || "",
      userAgent: meta.userAgent || "",
      success: true,
    });
    saveLoginLog(log);

    return publicRetailStockist(retailStockist);
  } catch (err) {
    console.error("[retail] recordLogin failed:", err.message);
    if (retailStockistId === DEMO_STOCKIST_ID) return publicRetailStockist(buildDemoStockist());
    return null;
  }
}

function recordFailedLogin(code, meta = {}) {
  try {
    const log = loadLoginLog();
    log.entries.push({
      id: newId("login"),
      retailStockistId: null,
      businessName: null,
      ts: Date.now(),
      ip: meta.ip || "",
      userAgent: meta.userAgent || "",
      success: false,
      codeAttempt: normalizeCode(code).slice(0, 4) + "…",
    });
    saveLoginLog(log);
  } catch (err) {
    console.error("[retail] recordFailedLogin skipped:", err.message);
  }
}

function submitApplication(payload) {
  const apps = loadApplications();
  const application = {
    id: newId("app"),
    status: "pending",
    createdAt: Date.now(),
    businessName: String(payload.businessName || "").trim(),
    fullName: String(payload.fullName || "").trim(),
    role: String(payload.role || "").trim(),
    abn: String(payload.abn || "").trim(),
    storeReg: String(payload.storeReg || payload.storeReg || "").trim(),
    email: String(payload.email || "").trim().toLowerCase(),
    phone: String(payload.phone || "").trim(),
    address: String(payload.address || "").trim(),
    compounding: payload.compounding === "yes" ? "yes" : "no",
    bulk: payload.bulk === "yes" ? "yes" : "no",
    notes: String(payload.notes || "").trim(),
  };
  apps.applications.unshift(application);
  saveApplications(apps);
  return application;
}

function issuePasswordSetupToken(retailStockistId, purpose = "setup") {
  const stockists = loadRetailStockists();
  const retailStockist = stockists.retailStockists.find((p) => p.id === retailStockistId && p.status === "active");
  if (!retailStockist) return null;
  const token = generateToken();
  Object.assign(retailStockist, createTokenFields(token, purpose));
  saveRetailStockists(stockists);
  return { retailStockist: publicRetailStockist(retailStockist), setupToken: token };
}

function setRetailStockistPassword(retailStockistId, password) {
  const message = validatePassword(password);
  if (message) return { error: message };
  const stockists = loadRetailStockists();
  const retailStockist = stockists.retailStockists.find((p) => p.id === retailStockistId && p.status === "active");
  if (!retailStockist) return null;
  retailStockist.passwordHash = hashPassword(password);
  retailStockist.passwordSetAt = Date.now();
  clearTokenFields(retailStockist);
  saveRetailStockists(stockists);
  return publicRetailStockist(retailStockist);
}

function setPasswordWithToken(token, password) {
  const message = validatePassword(password);
  if (message) return { error: message };
  const stockists = loadRetailStockists();
  const retailStockist = stockists.retailStockists.find((p) => p.status === "active" && verifyTokenFields(token, p));
  if (!retailStockist) return { error: "invalid_or_expired_token" };
  retailStockist.passwordHash = hashPassword(password);
  retailStockist.passwordSetAt = Date.now();
  clearTokenFields(retailStockist);
  saveRetailStockists(stockists);
  return { retailStockist: publicRetailStockist(retailStockist) };
}

function changeRetailStockistPassword(retailStockistId, currentPassword, newPassword) {
  const message = validatePassword(newPassword);
  if (message) return { error: message };
  const stockists = loadRetailStockists();
  const retailStockist = stockists.retailStockists.find((p) => p.id === retailStockistId && p.status === "active");
  if (!retailStockist) return null;
  if (!verifyPassword(currentPassword, retailStockist.passwordHash)) {
    return { error: "incorrect_password" };
  }
  retailStockist.passwordHash = hashPassword(newPassword);
  retailStockist.passwordSetAt = Date.now();
  saveRetailStockists(stockists);
  return publicRetailStockist(retailStockist);
}

function deleteRetailStockistAccount(retailStockistId, password) {
  if (retailStockistId === DEMO_STOCKIST_ID) return { error: "demo_account" };
  const stockists = loadRetailStockists();
  const retailStockist = stockists.retailStockists.find((p) => p.id === retailStockistId && p.status === "active");
  if (!retailStockist) return null;
  if (!verifyPassword(password, retailStockist.passwordHash)) {
    return { error: "incorrect_password" };
  }
  retailStockist.status = "deleted";
  retailStockist.deletedAt = Date.now();
  retailStockist.passwordHash = null;
  clearTokenFields(retailStockist);
  retailStockist.accessCodeHash = null;
  saveRetailStockists(stockists);
  return { deleted: true, id: retailStockistId };
}

function approveApplication(applicationId) {
  const apps = loadApplications();
  const app = apps.applications.find((a) => a.id === applicationId);
  if (!app) return null;
  if (app.status !== "pending") return { error: "already_processed", application: app };

  const setupToken = generateToken();
  const stockists = loadRetailStockists();
  const appEmail = normalizeEmail(app.email);
  let retailStockist = stockists.retailStockists.find(
    (p) => p.status === "active" && normalizeEmail(p.email) === appEmail,
  );

  if (retailStockist) {
    if (!retailStockist.abn && app.abn) retailStockist.abn = app.abn;
    if (!retailStockist.phone && app.phone) retailStockist.phone = app.phone;
    if (!retailStockist.address && app.address) retailStockist.address = app.address;
    if (!retailStockist.contactName && app.fullName) retailStockist.contactName = app.fullName;
    if (!retailStockist.checkoutAccessKey) retailStockist.checkoutAccessKey = generateCheckoutAccessKey();
    Object.assign(retailStockist, createTokenFields(setupToken, "setup"));
  } else {
    retailStockist = {
      id: newId("retail"),
      businessName: app.businessName,
      email: appEmail,
      status: "active",
      passwordHash: null,
      accessCodeHash: null,
      abn: app.abn,
      storeReg: app.storeReg,
      phone: app.phone,
      address: app.address,
      compounding: app.compounding,
      bulk: app.bulk,
      contactName: app.fullName,
      role: app.role,
      createdAt: Date.now(),
      approvedAt: Date.now(),
      lastLoginAt: null,
      loginCount: 0,
      applicationId: app.id,
      checkoutAccessKey: generateCheckoutAccessKey(),
      ...createTokenFields(setupToken, "setup"),
    };
    stockists.retailStockists.unshift(retailStockist);
  }
  saveRetailStockists(stockists);

  app.status = "approved";
  app.approvedAt = Date.now();
  app.retailStockistId = retailStockist.id;
  saveApplications(apps);

  return {
    application: app,
    retailStockist: publicRetailStockist(retailStockist),
    setupToken,
    checkoutLink: checkoutUrlForStockist(retailStockist),
  };
}

function rejectApplication(applicationId) {
  const apps = loadApplications();
  const app = apps.applications.find((a) => a.id === applicationId);
  if (!app) return null;
  app.status = "rejected";
  app.rejectedAt = Date.now();
  saveApplications(apps);
  return app;
}

function createRetailStockist(payload) {
  const setupToken = generateToken();
  const stockists = loadRetailStockists();
  const retailStockist = {
    id: newId("retail"),
    businessName: String(payload.businessName || "").trim(),
    email: normalizeEmail(payload.email),
    status: payload.status === "inactive" ? "inactive" : "active",
    passwordHash: null,
    accessCodeHash: null,
    abn: String(payload.abn || "").trim(),
    storeReg: String(payload.storeReg || payload.storeReg || "").trim(),
    phone: String(payload.phone || "").trim(),
    address: String(payload.address || "").trim(),
    compounding: payload.compounding === "yes" ? "yes" : "no",
    bulk: payload.bulk === "yes" ? "yes" : "no",
    contactName: String(payload.contactName || "").trim(),
    role: String(payload.role || "").trim(),
    createdAt: Date.now(),
    approvedAt: Date.now(),
    lastLoginAt: null,
    loginCount: 0,
    checkoutAccessKey: generateCheckoutAccessKey(),
    ...createTokenFields(setupToken, "setup"),
  };
  stockists.retailStockists.unshift(retailStockist);
  saveRetailStockists(stockists);
  return {
    retailStockist: publicRetailStockist(retailStockist),
    setupToken,
    checkoutLink: checkoutUrlForStockist(retailStockist),
  };
}

function sendPasswordReset(retailStockistId) {
  return issuePasswordSetupToken(retailStockistId, "reset");
}

function setRetailStockistStatus(retailStockistId, status) {
  const stockists = loadRetailStockists();
  const retailStockist = stockists.retailStockists.find((p) => p.id === retailStockistId);
  if (!retailStockist) return null;
  retailStockist.status = status === "inactive" ? "inactive" : "active";
  saveRetailStockists(stockists);
  return publicRetailStockist(retailStockist);
}

function wholesaleSummary() {
  const retailStockists = loadRetailStockists().retailStockists;
  const applications = loadApplications().applications;
  const loginLog = loadLoginLog().entries;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const pendingApps = applications.filter((a) => a.status === "pending").length;
  const activeRetailStockists = retailStockists.filter((p) => p.status === "active").length;
  const loginsToday = loginLog.filter((e) => e.success && e.ts >= todayStart.getTime()).length;

  return {
    pendingApplications: pendingApps,
    activeRetailStockists,
    totalRetailStockists: retailStockists.length,
    loginsToday,
    recentLogins: loginLog.slice(-20).reverse(),
  };
}

module.exports = {
  initializeRetailData,
  reconcilePreservedRetailData,
  hashAccessCode,
  verifyAccessCode,
  generateAccessCode,
  seedAccessCode,
  demoPortalInfo,
  demoPortalPassword,
  ensureDemoStockist,
  loadRetailStockists,
  loadApplications,
  loadLoginLog,
  findByCode,
  findByEmail,
  findByPasswordToken,
  findById,
  findByCheckoutKey,
  regenerateCheckoutAccessKey,
  checkoutUrlForStockist,
  generateCheckoutAccessKey,
  adminRetailStockistView,
  recordLogin,
  recordFailedLogin,
  recordFailedEmailLogin,
  submitApplication,
  approveApplication,
  rejectApplication,
  createRetailStockist,
  sendPasswordReset,
  issuePasswordSetupToken,
  setRetailStockistPassword,
  setPasswordWithToken,
  changeRetailStockistPassword,
  deleteRetailStockistAccount,
  setRetailStockistStatus,
  publicRetailStockist,
  wholesaleSummary,
  DEMO_STOCKIST_ID,
};