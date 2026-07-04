import { blockProductionDeploy } from "./_project-guard.mjs";

blockProductionDeploy("connect-leaflock-render.mjs");

import { createRequire } from "module";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve("playwright", {
  paths: [path.join(process.env.USERPROFILE || "C:\\Users\\wordo", "leaflock-store-v2")],
}));

const SERVICE_ID = "srv-d93nossvikkc73amkvv0";
const DOMAINS = ["med.leaflock.com.au", "www.med.leaflock.com.au"];
const ENV_FILE = path.join(root, "data", ".leaflock-render-env.json");
const CDP_PORTS = [9222, 9223, 9224, 9225, 9226];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function connect() {
  for (const port of CDP_PORTS) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      console.log(`CDP connected on ${port}`);
      return browser;
    } catch {}
  }
  return null;
}

function pickPage(browser) {
  for (const ctx of browser.contexts()) {
    const hit = ctx.pages().find((p) => /render\.com/.test(p.url()));
    if (hit) return hit;
  }
  return browser.contexts()[0]?.pages()[0] || null;
}

async function ensureServicePage(page) {
  const url = `https://dashboard.render.com/web/${SERVICE_ID}/settings`;
  if (!page.url().includes(SERVICE_ID)) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await sleep(3000);
  }
}

async function addDomains(page) {
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
      console.log(`Cannot add ${domain} — check workspace is Leaf Lock`);
      continue;
    }
    await add.click();
    await sleep(600);
    await page.locator('[data-id="custom-domains"] input[type="text"]:not([disabled])').last().fill(domain);
    await page.locator('[data-id="custom-domains"]').getByRole("button", { name: /^save$/i }).first().click();
    await sleep(2000);
    console.log(`Added: ${domain}`);
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
  console.log("\n" + (await page.evaluate(() => document.querySelector('[data-id="custom-domains"]')?.innerText || "")));
}

async function checkEnv(page) {
  await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}/env`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(3000);
  const body = await page.locator("body").innerText();
  const required = ["PAYPAL_MODE", "SMTP_PASS", "ANALYTICS_ADMIN_PASSWORD", "PORTAL_SESSION_SECRET"];
  const missing = required.filter((k) => !body.includes(k));
  if (missing.length === 0) {
    console.log("Env vars look complete");
    return;
  }
  console.log("Missing on Render — paste from data/.leaflock-render-env.json:");
  missing.forEach((k) => console.log(`  - ${k}`));
  console.log(`Open: https://dashboard.render.com/web/${SERVICE_ID}/env`);
}

async function manualDeploy(page) {
  await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(2000);
  const deploy = page.getByRole("button", { name: /manual deploy/i }).first();
  if (await deploy.isVisible({ timeout: 5000 }).catch(() => false)) {
    await deploy.click();
    console.log("Manual Deploy clicked");
  }
}

let browser = await connect();
if (!browser) {
  console.log("No Chrome debug port — open Render in Chrome, or run:");
  console.log('  Start-Process "https://dashboard.render.com/web/' + SERVICE_ID + '/settings"');
  process.exit(1);
}

const page = pickPage(browser);
if (!page) {
  console.log("No Render tab in Chrome");
  process.exit(1);
}

await ensureServicePage(page);
await addDomains(page);
await checkEnv(page);
await manualDeploy(page);
await page.screenshot({ path: path.join(root, "render-leaflock-connected.png"), fullPage: true });
console.log("Screenshot: render-leaflock-connected.png");