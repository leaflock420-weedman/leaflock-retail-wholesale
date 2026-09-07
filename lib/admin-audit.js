const path = require("path");
const crypto = require("crypto");
const { DATA_DIR } = require("./data-dir");
const { readJsonFile, writeJsonWithBackup } = require("./data-backup");

const FILE = path.join(DATA_DIR, "admin-audit.json");
const MAX_ENTRIES = 2000;

function recordAdminAction(action, details = {}) {
  const data = readJsonFile(FILE, { entries: [] });
  if (!Array.isArray(data.entries)) data.entries = [];
  data.entries.unshift({
    id: `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    ts: Date.now(),
    action,
    details,
  });
  data.entries = data.entries.slice(0, MAX_ENTRIES);
  writeJsonWithBackup(FILE, data);
}

function listAdminActions(limit = 200) {
  const data = readJsonFile(FILE, { entries: [] });
  return (Array.isArray(data.entries) ? data.entries : []).slice(0, Math.min(500, limit));
}

module.exports = { recordAdminAction, listAdminActions };
