import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);

const RENDER_KEY = (
  await readFile("C:\\Users\\wordo\\.render\\cli.yaml", "utf8").catch(() => "")
).match(/key:\s*(rnd_[^\s]+)/)?.[1];

const OWNER_ID = "tea-d8rpaukvikkc738s9o5g";
const REPO = "https://github.com/leaflock420-weedman/leaflock-retail-wholesale";
const SERVICE_NAME = "leaflock-retail-wholesale";
const SERVICE_ID = "srv-d94f97t7vvec73dhj9rg";
const SITE_URL = "https://www.wholesale.leaflock.com.au";
const CUSTOM_DOMAINS = ["www.wholesale.leaflock.com.au", "wholesale.leaflock.com.au"];

const envJson = JSON.parse(
  (await readFile(path.join(root, "data", ".leaflock-render-env.json"), "utf8")).replace(/^\uFEFF/, ""),
);

const RETAIL_ENV = {
  NODE_VERSION: "20",
  TZ: "Australia/Brisbane",
  DATA_DIR: "/var/data",
  NODE_ENV: "production",
  PAYPAL_CLIENT_ID: envJson.PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET: envJson.PAYPAL_CLIENT_SECRET,
  PAYPAL_MODE: "live",
  SMTP_HOST: envJson.SMTP_HOST,
  SMTP_PORT: envJson.SMTP_PORT,
  SMTP_USER: envJson.SMTP_USER,
  SMTP_PASS: envJson.SMTP_PASS,
  ANALYTICS_ADMIN_PASSWORD: envJson.ANALYTICS_ADMIN_PASSWORD,
  PORTAL_SESSION_SECRET: envJson.PORTAL_SESSION_SECRET,
  ADMIN_SESSION_SECRET: envJson.ADMIN_SESSION_SECRET,
  PORTAL_CODE_SALT: envJson.PORTAL_CODE_SALT,
  SEED_ACCESS_CODE: envJson.SEED_ACCESS_CODE || "DEMO-STOCKIST-2026",
  ANALYTICS_EMAIL_TO: "info@leaflock.com.au",
  ANALYTICS_EMAIL_FROM: "info@leaflock.com.au",
  WHOLESALE_EMAIL_TO: "info@leaflock.com.au",
  SITE_URL,
};

const headers = {
  Authorization: `Bearer ${RENDER_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

async function api(pathname, options = {}) {
  const res = await fetch(`https://api.render.com/v1${pathname}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${pathname} ${res.status}: ${text}`);
  }
  return body;
}

async function findService() {
  let cursor = "";
  for (let page = 0; page < 10; page++) {
    const q = cursor ? `?limit=50&cursor=${encodeURIComponent(cursor)}` : "?limit=50";
    const data = await api(`/services${q}`);
    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      const svc = row.service || row;
      if (svc?.name === SERVICE_NAME) return svc;
      cursor = row.cursor || "";
    }
    if (!cursor) break;
  }
  return null;
}

async function createService() {
  return api("/services", {
    method: "POST",
    body: JSON.stringify({
      type: "web_service",
      name: SERVICE_NAME,
      ownerId: OWNER_ID,
      repo: REPO,
      branch: "master",
      autoDeploy: "yes",
      serviceDetails: {
        runtime: "node",
        env: "node",
        plan: "starter",
        region: "oregon",
        healthCheckPath: "/",
        envSpecificDetails: {
          buildCommand: "npm install",
          startCommand: "npm start",
        },
      },
    }),
  });
}

async function addDisk(serviceId) {
  try {
    await api(`/services/${serviceId}/disks`, {
      method: "POST",
      body: JSON.stringify({
        name: "retail-wholesale-data",
        mountPath: "/var/data",
        sizeGB: 1,
      }),
    });
    console.log("Persistent disk attached at /var/data");
  } catch (err) {
    if (/already|exists|409/i.test(err.message)) {
      console.log("Disk already present");
      return;
    }
    console.warn("Disk attach:", err.message);
  }
}

async function setEnvVars(serviceId) {
  const envVars = Object.entries(RETAIL_ENV).map(([key, value]) => ({
    key,
    value: String(value),
  }));
  await api(`/services/${serviceId}/env-vars`, {
    method: "PUT",
    body: JSON.stringify(envVars),
  });
  console.log(`Set ${envVars.length} environment variables (PayPal live included)`);
}

async function ensureCustomDomains(serviceId) {
  let existing = [];
  try {
    const rows = await api(`/services/${serviceId}/custom-domains`);
    existing = (Array.isArray(rows) ? rows : []).map((row) => row.customDomain?.name || row.name).filter(Boolean);
  } catch (err) {
    console.warn("Could not list custom domains:", err.message);
  }

  for (const name of CUSTOM_DOMAINS) {
    if (existing.includes(name)) {
      console.log(`Custom domain already registered: ${name}`);
      continue;
    }
    try {
      await api(`/services/${serviceId}/custom-domains`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      console.log(`Registered custom domain: ${name}`);
    } catch (err) {
      if (/409|already|exists/i.test(err.message)) {
        console.log(`Custom domain already present: ${name}`);
      } else {
        console.warn(`Custom domain ${name}:`, err.message);
      }
    }
  }
}

async function triggerDeploy(serviceId) {
  await api(`/services/${serviceId}/deploys`, {
    method: "POST",
    body: JSON.stringify({ clearCache: "do_not_clear" }),
  });
  console.log("Deploy triggered");
}

async function waitForLive(urls) {
  const targets = Array.isArray(urls) ? urls : [urls];
  for (let i = 0; i < 40; i++) {
    for (const url of targets) {
      try {
        const res = await fetch(`${url}/api/public/gummy-checkout/paypal-config`);
        if (res.ok) {
          const data = await res.json();
          console.log(`LIVE: ${url} — PayPal enabled=${data.enabled} mode=${data.mode}`);
          return { url, data };
        }
        console.log(`Waiting for ${url} (${i + 1}/40) status=${res.status}`);
      } catch {
        console.log(`Waiting for ${url} (${i + 1}/40)...`);
      }
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  return null;
}

async function main() {
  if (!RENDER_KEY) throw new Error("Render API key not found in ~/.render/cli.yaml");

  let service = await findService();
  if (!service) {
    console.log("Creating retail web service on Render...");
    const created = await createService();
    service = created.service || created;
    console.log(`Created: ${service.id} → ${service.serviceDetails?.url || "(building)"}`);
    await addDisk(service.id);
  } else {
    console.log(`Found existing service: ${service.id}`);
  }

  await ensureCustomDomains(service.id);
  await setEnvVars(service.id);
  await triggerDeploy(service.id);

  const renderUrl =
    service.serviceDetails?.url ||
    `https://${service.slug || SERVICE_NAME}.onrender.com`;
  const live = await waitForLive([SITE_URL, renderUrl]);
  const liveUrl = live?.url || SITE_URL;
  console.log(`Site: ${SITE_URL}`);
  console.log(`Checkout: ${liveUrl}/gummy-checkout.html`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});