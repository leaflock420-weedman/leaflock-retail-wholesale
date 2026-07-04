/**
 * Sync env vars, custom domains, and deploy on Leaf Lock Render service.
 * Usage: set RENDER_API_KEY=rnd_xxx (from leaflock420@gmail.com Account Settings → API Keys)
 *        node scripts/sync-leaflock-render-api.mjs
 */
import { blockProductionDeploy } from "./_project-guard.mjs";

blockProductionDeploy("sync-leaflock-render-api.mjs");

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);

const SERVICE_ID = "srv-d93nossvikkc73amkvv0";
const DOMAINS = ["med.leaflock.com.au", "www.med.leaflock.com.au"];
const ENV_FILE = path.join(root, "data", ".leaflock-render-env.json");

async function getKey() {
  if (process.env.RENDER_API_KEY) return process.env.RENDER_API_KEY;
  try {
    const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
    return yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1] || "";
  } catch {
    return "";
  }
}

async function api(key, method, urlPath, body) {
  const res = await fetch(`https://api.render.com/v1${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { ok: res.ok, status: res.status, data, text };
}

const key = await getKey();
if (!key) {
  console.error("Set RENDER_API_KEY from https://dashboard.render.com/u/settings#api-keys (leaflock420@gmail.com)");
  process.exit(1);
}

const svc = await api(key, "GET", `/services/${SERVICE_ID}`);
if (!svc.ok) {
  console.error(`Cannot access ${SERVICE_ID} (${svc.status}). API key must be from Leaf Lock workspace.`);
  console.error(svc.text?.slice(0, 200));
  process.exit(1);
}
console.log(`Service: ${svc.data.name} ${svc.data.serviceDetails?.url}`);

const envMap = JSON.parse((await readFile(ENV_FILE, "utf8")).replace(/^\uFEFF/, ""));
const list = await api(key, "GET", `/services/${SERVICE_ID}/env-vars`);
const existing = new Map((list.data || []).map((e) => [e.envVar.key, e.envVar]));

for (const [name, value] of Object.entries(envMap)) {
  const cur = existing.get(name);
  if (cur?.value === String(value)) {
    console.log(`Env OK: ${name}`);
    continue;
  }
  const r = cur
    ? await api(key, "PUT", `/services/${SERVICE_ID}/env-vars/${name}`, { value: String(value) })
    : await api(key, "POST", `/services/${SERVICE_ID}/env-vars`, { key: name, value: String(value) });
  console.log(r.ok ? `Env set: ${name}` : `Env FAIL ${name}: ${r.status}`);
}

for (const domain of DOMAINS) {
  const r = await api(key, "POST", `/services/${SERVICE_ID}/custom-domains`, { name: domain });
  if (r.ok) console.log(`Domain added: ${domain}`);
  else if (r.status === 409 || /already/i.test(r.text)) console.log(`Domain exists: ${domain}`);
  else console.log(`Domain FAIL ${domain}: ${r.status} ${r.text?.slice(0, 120)}`);
}

const domains = await api(key, "GET", `/services/${SERVICE_ID}/custom-domains`);
for (const row of domains.data || []) {
  const d = row.customDomain || row;
  console.log(`Domain: ${d.name} verified=${d.verified}`);
}

const dep = await api(key, "POST", `/services/${SERVICE_ID}/deploys`, { clearCache: "clear" });
if (dep.ok) console.log(`Deploy: ${dep.data.id} ${dep.data.status}`);
else console.log(`Deploy failed: ${dep.status}`);

console.log("\nNext: GoDaddy DNS — med A record → 216.24.57.1");
console.log("Then verify: https://med.leaflock.com.au/admin/");