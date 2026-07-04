/**
 * Full Leaf Lock Render connect: env vars (API), custom domains, deploy, DNS check.
 * Uses ~/.render/cli.yaml API key — must be logged in as leaflock420@gmail.com.
 */
import { blockProductionDeploy } from "./_project-guard.mjs";

blockProductionDeploy("connect-all-leaflock-render.mjs");

import { createRequire } from "module";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve("playwright", {
  paths: [path.join(process.env.USERPROFILE || "C:\\Users\\wordo", "leaflock-store-v2")],
}));

const SERVICE_ID = "srv-d93nossvikkc73amkvv0";
const NEW_RENDER_HOST = "leaflock-pharmacy-wholesale-9kbz.onrender.com";
const OLD_SERVICE_ID = "srv-d93ivefaqgkc73c239ig";
const DOMAINS = ["med.leaflock.com.au", "www.med.leaflock.com.au"];
const ENV_FILE = path.join(root, "data", ".leaflock-render-env.json");
const PROFILE = path.join(root, ".chrome-render-leaflock");
const CDP_PORTS = [9226, 9225, 9224, 9223, 9222];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getApiKey() {
  const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
  return yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1] || "";
}

async function api(method, urlPath, body) {
  const key = await getApiKey();
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

async function syncEnvViaApi(envMap) {
  const list = await api("GET", `/services/${SERVICE_ID}/env-vars`);
  if (!list.ok) {
    console.log(`Env API failed (${list.status}) — wrong Render account? Run: render login as leaflock420@gmail.com`);
    return false;
  }
  const existing = new Map((list.data || []).map((e) => [e.envVar.key, e.envVar]));
  let ok = 0;
  for (const [key, value] of Object.entries(envMap)) {
    const cur = existing.get(key);
    if (cur && cur.value === String(value)) {
      console.log(`Env OK: ${key}`);
      ok++;
      continue;
    }
    if (cur) {
      const r = await api("PUT", `/services/${SERVICE_ID}/env-vars/${key}`, { value: String(value) });
      if (r.ok) {
        console.log(`Env updated: ${key}`);
        ok++;
      } else console.log(`Env FAIL update ${key}: ${r.status} ${r.text?.slice(0, 120)}`);
    } else {
      const r = await api("POST", `/services/${SERVICE_ID}/env-vars`, { key, value: String(value) });
      if (r.ok) {
        console.log(`Env added: ${key}`);
        ok++;
      } else console.log(`Env FAIL add ${key}: ${r.status} ${r.text?.slice(0, 120)}`);
    }
  }
  console.log(`Env sync: ${ok}/${Object.keys(envMap).length}`);
  return ok === Object.keys(envMap).length;
}

async function triggerDeploy() {
  const r = await api("POST", `/services/${SERVICE_ID}/deploys`, { clearCache: "clear" });
  if (!r.ok) {
    console.log(`Deploy trigger failed: ${r.status} ${r.text?.slice(0, 200)}`);
    return null;
  }
  console.log(`Deploy triggered: ${r.data?.id} status=${r.data?.status}`);
  return r.data?.id;
}

async function connectCdp() {
  for (const port of CDP_PORTS) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      console.log(`CDP on ${port}`);
      return browser;
    } catch {}
  }
  return null;
}

function pickRenderPage(browser) {
  for (const ctx of browser.contexts()) {
    const hit = ctx.pages().find((p) => /render\.com/.test(p.url()));
    if (hit) return hit;
  }
  return browser.contexts()[0]?.pages()[0] || null;
}

async function waitForRenderLogin(page, maxMs = 300000) {
  console.log("Sign in to Render as leaflock420@gmail.com (Google) — waiting up to 5 min...");
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const url = page.url();
    const body = await page.locator("body").innerText().catch(() => "");
    if (/dashboard\.render\.com/.test(url) && !/sign in to render/i.test(body)) return true;
    await sleep(3000);
  }
  return false;
}

async function uiSyncEnv(page, envMap) {
  await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}/env`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(4000);
  let body = await page.locator("body").innerText();
  let added = 0;
  for (const [key, value] of Object.entries(envMap)) {
    if (body.includes(key)) {
      console.log(`Env exists: ${key}`);
      continue;
    }
    const add = page.getByRole("button", { name: /add environment variable|add env/i }).first();
    if (await add.isVisible({ timeout: 3000 }).catch(() => false)) {
      await add.click();
      await sleep(500);
    }
    try {
      await page.getByLabel(/key/i).last().fill(key);
      await page.getByLabel(/value/i).last().fill(String(value));
      await page.getByRole("button", { name: /^save|add$/i }).last().click();
      added++;
      await sleep(800);
      console.log(`Added env: ${key}`);
      body = await page.locator("body").innerText();
    } catch {
      console.log(`Could not add ${key} via UI`);
    }
  }
  return added;
}

async function uiAddDomains(page) {
  const url = `https://dashboard.render.com/web/${SERVICE_ID}/settings`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(3000);
  const body = await page.locator("body").innerText().catch(() => "");
  if (/sign in to render/i.test(body)) {
    if (!(await waitForRenderLogin(page))) {
      console.log("Render login timed out — sign in as leaflock420@gmail.com");
      return false;
    }
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await sleep(3000);
  }
  if (!body.includes(SERVICE_ID) && !/leaflock-pharmacy-wholesale/i.test(body)) {
    console.log("Wrong workspace or service not visible in browser");
    return false;
  }
  await page.evaluate(() => document.querySelector('[data-id="custom-domains"]')?.scrollIntoView({ block: "center" }));
  await sleep(1500);
  let panel = await page.evaluate(() => document.querySelector('[data-id="custom-domains"]')?.innerText || "");
  for (const domain of DOMAINS) {
    if (panel.includes(domain)) {
      console.log(`Domain OK: ${domain}`);
      continue;
    }
    const add = page.getByRole("button", { name: /add custom domain/i }).first();
    if (!(await add.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`Cannot add ${domain}`);
      continue;
    }
    await add.click();
    await sleep(600);
    await page.locator('[data-id="custom-domains"] input[type="text"]:not([disabled])').last().fill(domain);
    await page.locator('[data-id="custom-domains"]').getByRole("button", { name: /^save$/i }).first().click();
    await sleep(2000);
    console.log(`Added domain: ${domain}`);
    panel = await page.evaluate(() => document.querySelector('[data-id="custom-domains"]')?.innerText || "");
  }
  for (const btn of await page.locator('[data-id="custom-domains"] button').all()) {
    const t = (await btn.innerText().catch(() => "")).trim();
    if (/^verify$/i.test(t)) {
      await btn.click().catch(() => {});
      await sleep(1500);
      console.log("Clicked Verify");
    }
  }
  console.log("\nDomains panel:\n" + panel.split("\n").slice(0, 20).join("\n"));
  return true;
}

async function uiManualDeploy(page) {
  await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(2000);
  const deploy = page.getByRole("button", { name: /manual deploy/i }).first();
  if (await deploy.isVisible({ timeout: 5000 }).catch(() => false)) {
    await deploy.click();
    console.log("Manual Deploy clicked");
  }
}

async function launchChromeForUi() {
  const context = await chromium.launchPersistentContext(PROFILE, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ["--remote-debugging-port=9226"],
  });
  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

async function checkDns() {
  const res = await fetch(`https://dns.google/resolve?name=med.leaflock.com.au&type=CNAME`);
  const data = await res.json();
  const chain = (data.Answer || []).map((a) => a.data).join(" ");
  const onNew = chain.includes(NEW_RENDER_HOST) || chain.includes("9kbz");
  const onOld = chain.includes("leaflock-pharmacy-wholesale.onrender.com") && !onNew;
  console.log(`\nDNS med.leaflock.com.au: ${chain || "(no CNAME)"}`);
  if (onOld) {
    console.log("DNS still points to OLD Pride service — update GoDaddy:");
    console.log("  Host: med");
    console.log("  Type: A");
    console.log("  Value: 216.24.57.1");
    console.log(`  (or CNAME -> ${NEW_RENDER_HOST})`);
  } else if (onNew) {
    console.log("DNS points to new Leaf Lock service");
  }
  return { onOld, onNew, chain };
}

const envJson = JSON.parse((await readFile(ENV_FILE, "utf8")).replace(/^\uFEFF/, ""));

console.log("=== Leaf Lock Render connect-all ===\n");
const svc = await api("GET", `/services/${SERVICE_ID}`);
if (svc.ok) {
  console.log(`Service: ${svc.data.name} ${svc.data.serviceDetails?.url}`);
} else {
  console.log(`Cannot access service ${SERVICE_ID} (${svc.status})`);
  console.log("Fix: render login as leaflock420@gmail.com (Leaf Lock workspace)");
}

const envOk = await syncEnvViaApi(envJson);
if (envOk) await triggerDeploy();

let browser = await connectCdp();
let ownContext = null;
let page;
if (browser) {
  page = pickRenderPage(browser);
} else {
  console.log("\nLaunching Chrome for Render UI...");
  const launched = await launchChromeForUi();
  ownContext = launched.context;
  page = launched.page;
  await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}/env`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(2000);
  const body0 = await page.locator("body").innerText().catch(() => "");
  if (/sign in to render/i.test(body0)) {
    const google = page.getByRole("button", { name: /google/i }).first();
    if (await google.isVisible({ timeout: 3000 }).catch(() => false)) {
      await google.click();
      await sleep(3000);
    }
  }
}

if (page) {
  try {
    await waitForRenderLogin(page);
    if (!envOk) {
      const added = await uiSyncEnv(page, envJson);
      if (added > 0) await uiManualDeploy(page);
    }
    await uiAddDomains(page);
    await uiManualDeploy(page);
    await page.screenshot({ path: path.join(root, "render-leaflock-connected.png"), fullPage: true });
    console.log("Screenshot: render-leaflock-connected.png");
    console.log("Leaving Chrome open 120s for review...");
    await sleep(120000);
  } catch (err) {
    console.log("Browser step:", err.message);
    console.log("Complete manually:");
    console.log(`  Env: https://dashboard.render.com/web/${SERVICE_ID}/env`);
    console.log(`  Domains: https://dashboard.render.com/web/${SERVICE_ID}/settings#custom-domains`);
  }
}

if (ownContext) await ownContext.close().catch(() => {});

const dns = await checkDns();
const report = {
  serviceId: SERVICE_ID,
  serviceAccessible: svc.ok,
  envSynced: envOk,
  dnsOnOld: dns.onOld,
  dnsOnNew: dns.onNew,
  newRenderHost: NEW_RENDER_HOST,
  urls: {
    dashboard: `https://dashboard.render.com/web/${SERVICE_ID}`,
    env: `https://dashboard.render.com/web/${SERVICE_ID}/env`,
    domains: `https://dashboard.render.com/web/${SERVICE_ID}/settings#custom-domains`,
    live: `https://${NEW_RENDER_HOST}`,
    production: "https://med.leaflock.com.au",
  },
};
await writeFile(path.join(root, "data", ".leaflock-connect-report.json"), JSON.stringify(report, null, 2));
console.log("\nReport: data/.leaflock-connect-report.json");
console.log("Done.");