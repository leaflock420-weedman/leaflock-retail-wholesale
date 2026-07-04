const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(__dirname, "..", "admin-settings.json");
function getAdminPassword() {
  if (process.env.ANALYTICS_ADMIN_PASSWORD) {
    return process.env.ANALYTICS_ADMIN_PASSWORD;
  }
  console.error("[admin] ANALYTICS_ADMIN_PASSWORD not set — admin login disabled");
  return null;
}

module.exports = { getAdminPassword };