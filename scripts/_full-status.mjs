import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url), "..");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);

const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
const key = yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1];
const workspace = yaml.match(/workspace_name:\s*(.+)/)?.[1]?.trim();

const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };
const NEW_ID = "srv-d93nossvikkc73amkvv0";
const BASE = "https://med.leaflock.com.au";

console.log("CLI workspace:", workspace);

for (const id of [NEW_ID, "srv-d93ivefaqgkc73c239ig"]) {
  const r = await fetch(`https://api.render.com/v1/services/${id}`, { headers });
  console.log(`\nService ${id}: ${r.status}`);
  if (r.ok) {
    const s = await r.json();
    console.log(`  name=${s.name} url=${s.serviceDetails?.url} suspended=${s.suspended}`);
  }
}

const domains = await fetch(`https://api.render.com/v1/services/${NEW_ID}/custom-domains`, { headers });
console.log("\nNew service domains:", domains.status);
if (domains.ok) {
  const list = await domains.json();
  for (const row of list) console.log(" ", row.customDomain?.name || row.name);
} else console.log(await domains.text());

const env = await fetch(`https://api.render.com/v1/services/${NEW_ID}/env-vars`, { headers });
console.log("\nNew service env:", env.status);
if (env.ok) {
  const vars = await env.json();
  const keys = vars.map((v) => v.envVar.key);
  console.log("  count:", keys.length);
  console.log("  SMTP:", keys.includes("SMTP_PASS") ? "yes" : "NO");
  console.log("  PAYPAL_MODE:", vars.find((v) => v.envVar.key === "PAYPAL_MODE")?.envVar.value || "missing");
  console.log("  ADMIN:", keys.includes("ANALYTICS_ADMIN_PASSWORD") ? "yes" : "NO");
}

const layout = await fetch(`${BASE}/assets/layout.js`);
const body = await layout.text();
console.log("\nmed.leaflock.com.au layout new header:", body.includes("header-brand-wrap"));
console.log("med status:", layout.status, layout.headers.get("last-modified"));

const admin = await fetch(`${BASE}/api/analytics/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: "__ping__" }),
});
const adminText = await admin.json().catch(() => ({}));
console.log("admin configured:", adminText.error !== "Admin login not configured");