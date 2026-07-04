const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DATA_DIR, ensureDataDir } = require("./data-dir");
const PHARMACIES_FILE = path.join(DATA_DIR, "pharmacies.json");
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
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function hashAccessCode(code) {
  return crypto.scryptSync(normalizeCode(code), codeSalt(), 64).toString("hex");
}

function verifyAccessCode(code, hash) {
  try {
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

function newId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function seedAccessCode() {
  return process.env.SEED_ACCESS_CODE || "LEAFLOCK-PHARM-2026";
}

function ensureTestPharmacy(data) {
  const seedCode = seedAccessCode();
  const test = data.pharmacies.find((p) => p.businessName === "LeafLock Test Pharmacy");
  if (test) {
    test.status = "active";
    test.accessCodeHash = hashAccessCode(seedCode);
    return data;
  }
  data.pharmacies.unshift({
    id: newId("pharm"),
    businessName: "LeafLock Test Pharmacy",
    email: "med@leaflock.com.au",
    status: "active",
    accessCodeHash: hashAccessCode(seedCode),
    abn: "",
    pharmacyReg: "",
    phone: "",
    address: "",
    compounding: "no",
    bulk: "no",
    createdAt: Date.now(),
    approvedAt: Date.now(),
    lastLoginAt: null,
    loginCount: 0,
  });
  console.log(`[pharmacy] Test pharmacy ready — access code: ${seedCode}`);
  return data;
}

function loadPharmacies() {
  const data = readJson(PHARMACIES_FILE, { pharmacies: [] });
  const before = JSON.stringify(data);
  ensureTestPharmacy(data);
  const test = data.pharmacies.find((p) => p.businessName === "LeafLock Test Pharmacy");
  if (test) {
    const code = seedAccessCode();
    if (test.status !== "active" || !verifyAccessCode(code, test.accessCodeHash)) {
      test.status = "active";
      test.accessCodeHash = hashAccessCode(code);
      console.log("[pharmacy] Test pharmacy access code updated");
    }
  }
  if (JSON.stringify(data) !== before) savePharmacies(data);
  return data;
}

function savePharmacies(data) {
  writeJson(PHARMACIES_FILE, data);
}

function loadApplications() {
  return readJson(APPLICATIONS_FILE, { applications: [] });
}

function saveApplications(data) {
  writeJson(APPLICATIONS_FILE, data);
}

function loadLoginLog() {
  return readJson(LOGIN_LOG_FILE, { entries: [] });
}

function saveLoginLog(data) {
  data.entries = (data.entries || []).slice(-MAX_LOGIN_LOG);
  writeJson(LOGIN_LOG_FILE, data);
}

function publicPharmacy(pharmacy) {
  return {
    id: pharmacy.id,
    businessName: pharmacy.businessName,
    email: pharmacy.email,
    status: pharmacy.status,
    lastLoginAt: pharmacy.lastLoginAt,
    loginCount: pharmacy.loginCount,
    createdAt: pharmacy.createdAt,
    approvedAt: pharmacy.approvedAt,
  };
}

function findByCode(code) {
  const data = loadPharmacies();
  const match = data.pharmacies.find(
    (p) => p.status === "active" && verifyAccessCode(code, p.accessCodeHash),
  );
  return match || null;
}

function findById(id) {
  const data = loadPharmacies();
  return data.pharmacies.find((p) => p.id === id) || null;
}

function recordLogin(pharmacyId, meta = {}) {
  const data = loadPharmacies();
  const pharmacy = data.pharmacies.find((p) => p.id === pharmacyId);
  if (!pharmacy) return null;

  pharmacy.lastLoginAt = Date.now();
  pharmacy.loginCount = (pharmacy.loginCount || 0) + 1;
  savePharmacies(data);

  const log = loadLoginLog();
  log.entries.push({
    id: newId("login"),
    pharmacyId,
    businessName: pharmacy.businessName,
    ts: Date.now(),
    ip: meta.ip || "",
    userAgent: meta.userAgent || "",
    success: true,
  });
  saveLoginLog(log);

  return publicPharmacy(pharmacy);
}

function recordFailedLogin(code, meta = {}) {
  const log = loadLoginLog();
  log.entries.push({
    id: newId("login"),
    pharmacyId: null,
    businessName: null,
    ts: Date.now(),
    ip: meta.ip || "",
    userAgent: meta.userAgent || "",
    success: false,
    codeAttempt: normalizeCode(code).slice(0, 4) + "…",
  });
  saveLoginLog(log);
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
    pharmacyReg: String(payload.pharmacyReg || "").trim(),
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

function approveApplication(applicationId) {
  const apps = loadApplications();
  const app = apps.applications.find((a) => a.id === applicationId);
  if (!app) return null;
  if (app.status !== "pending") return { error: "already_processed", application: app };

  const accessCode = generateAccessCode();
  const pharmacies = loadPharmacies();
  const pharmacy = {
    id: newId("pharm"),
    businessName: app.businessName,
    email: app.email,
    status: "active",
    accessCodeHash: hashAccessCode(accessCode),
    abn: app.abn,
    pharmacyReg: app.pharmacyReg,
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
  };
  pharmacies.pharmacies.unshift(pharmacy);
  savePharmacies(pharmacies);

  app.status = "approved";
  app.approvedAt = Date.now();
  app.pharmacyId = pharmacy.id;
  saveApplications(apps);

  return { application: app, pharmacy: publicPharmacy(pharmacy), accessCode };
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

function createPharmacy(payload) {
  const accessCode = payload.accessCode || generateAccessCode();
  const pharmacies = loadPharmacies();
  const pharmacy = {
    id: newId("pharm"),
    businessName: String(payload.businessName || "").trim(),
    email: String(payload.email || "").trim().toLowerCase(),
    status: payload.status === "inactive" ? "inactive" : "active",
    accessCodeHash: hashAccessCode(accessCode),
    abn: String(payload.abn || "").trim(),
    pharmacyReg: String(payload.pharmacyReg || "").trim(),
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
  };
  pharmacies.pharmacies.unshift(pharmacy);
  savePharmacies(pharmacies);
  return { pharmacy: publicPharmacy(pharmacy), accessCode };
}

function regenerateCode(pharmacyId) {
  const pharmacies = loadPharmacies();
  const pharmacy = pharmacies.pharmacies.find((p) => p.id === pharmacyId);
  if (!pharmacy) return null;
  const accessCode = generateAccessCode();
  pharmacy.accessCodeHash = hashAccessCode(accessCode);
  savePharmacies(pharmacies);
  return { pharmacy: publicPharmacy(pharmacy), accessCode };
}

function setPharmacyStatus(pharmacyId, status) {
  const pharmacies = loadPharmacies();
  const pharmacy = pharmacies.pharmacies.find((p) => p.id === pharmacyId);
  if (!pharmacy) return null;
  pharmacy.status = status === "inactive" ? "inactive" : "active";
  savePharmacies(pharmacies);
  return publicPharmacy(pharmacy);
}

function wholesaleSummary() {
  const pharmacies = loadPharmacies().pharmacies;
  const applications = loadApplications().applications;
  const loginLog = loadLoginLog().entries;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const pendingApps = applications.filter((a) => a.status === "pending").length;
  const activePharmacies = pharmacies.filter((p) => p.status === "active").length;
  const loginsToday = loginLog.filter((e) => e.success && e.ts >= todayStart.getTime()).length;

  return {
    pendingApplications: pendingApps,
    activePharmacies,
    totalPharmacies: pharmacies.length,
    loginsToday,
    recentLogins: loginLog.slice(-20).reverse(),
  };
}

module.exports = {
  hashAccessCode,
  verifyAccessCode,
  generateAccessCode,
  seedAccessCode,
  ensureTestPharmacy,
  loadPharmacies,
  loadApplications,
  loadLoginLog,
  findByCode,
  findById,
  recordLogin,
  recordFailedLogin,
  submitApplication,
  approveApplication,
  rejectApplication,
  createPharmacy,
  regenerateCode,
  setPharmacyStatus,
  publicPharmacy,
  wholesaleSummary,
};