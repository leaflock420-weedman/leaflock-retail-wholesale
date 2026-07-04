import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const BASE = "https://med.leaflock.com.au";
const env = JSON.parse(
  (await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", ".leaflock-render-env.json"), "utf8")).replace(/^\uFEFF/, ""),
);

const login = await fetch(`${BASE}/api/analytics/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: env.ANALYTICS_ADMIN_PASSWORD }),
});
const { token } = await login.json();
if (!token) {
  console.log("Admin login failed");
  process.exit(1);
}

const report = await fetch(`${BASE}/api/analytics/send-report`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
const result = await report.json();
console.log("Send daily report:", report.status, result);