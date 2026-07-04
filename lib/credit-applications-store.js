const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DATA_DIR, ensureDataDir } = require("./data-dir");

const FILE = path.join(DATA_DIR, "credit-applications.json");

function readJson(fallback) {
  ensureDataDir();
  try {
    if (!fs.existsSync(FILE)) return fallback;
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(data) {
  ensureDataDir();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function newId() {
  return `cred_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function loadCreditApplications() {
  return readJson({ applications: [] });
}

function submitCreditApplication(payload) {
  const data = loadCreditApplications();
  const app = {
    id: newId(),
    status: "pending",
    createdAt: Date.now(),
    pharmacyId: payload.pharmacyId || null,
    businessName: String(payload.businessName || "").trim(),
    abn: String(payload.abn || "").trim(),
    directorName: String(payload.directorName || "").trim(),
    directorEmail: String(payload.directorEmail || "").trim(),
    requestedTerms: String(payload.requestedTerms || "").trim(),
    tradeReference1: String(payload.tradeReference1 || "").trim(),
    tradeReference2: String(payload.tradeReference2 || "").trim(),
    notes: String(payload.notes || "").trim(),
    signatureName: String(payload.signatureName || "").trim(),
    signatureAt: Date.now(),
    termsVersion: payload.termsVersion || null,
  };
  data.applications.unshift(app);
  writeJson(data);
  return app;
}

module.exports = { loadCreditApplications, submitCreditApplication };