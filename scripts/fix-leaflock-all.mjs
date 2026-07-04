/**
 * One-shot fix for Leaf Lock Render (leaflock420@gmail.com) via browser UI.
 * Env vars, custom domains, manual deploy, then verify med.leaflock.com.au.
 */
import { blockProductionDeploy } from "./_project-guard.mjs";

blockProductionDeploy("fix-leaflock-all.mjs");

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
const PROFILE = path.join(root, ".chrome-render-leaflock");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitLogin(page, maxMs = 300000) {
  console.log("Sign in to Render as leaflock420@gmail.com if needed...");
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const body = await page.locator("body").innerText().catch(() => "");
    if (/dashboard\.render\.com/.test(page.url()) && !/sign in to render/i.test(body)) return true;
    await sleep(3000);
  }
  return false;
}

async function syncEnv(page, envMap) {
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
    const addBtn = page.getByRole("button", { name: /add environment variable/i }).first();
    if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`Cannot add ${key} — no Add button`);
      continue;
    }
    await addBtn.click();
    await sleep(600);
    try {
      const rows = page.locator('[data-testid="env-var-row"], form').last();
      const inputs = page.locator('input[type="text"], input:not([type="hidden"])');
      const keyInput = page.getByPlaceholder(/key|name/i).last();
      await keyInput.fill(key);
      const val = page.getByPlaceholder(/value/i).last();
      if (await val.isVisible({ timeout: 2000 }).catch(() => false)) {
        await val.fill(String(value));
      } else {
        await page.locator('textarea, input[type="password"]').last().fill(String(value));
      }
      await page.getByRole("button", { name: /^save$|^add$/i }).last().click();
      added++;
      await sleep(1000);
      console.log(`Added env: ${key}`);
      body = await page.locator("body").innerText();
    } catch (e) {
      console.log(`Failed ${key}:`, e.message);
    }
  }
  return added;
}

async function addDomains(page) {
  await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}/settings`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(3000);
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
}

async function deploy(page) {
  await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(2000);
  const btn = page.getByRole("button", { name: /manual deploy/i }).first();
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await btn.click();
    await sleep(800);
    const latest = page.getByText(/deploy latest commit/i).first();
    if (await latest.isVisible({ timeout: 3000 }).catch(() => false)) await latest.click();
    console.log("Manual Deploy triggered");
  }
}

async function verify() {
  for (let i = 0; i < 25; i++) {
    await sleep(12000);
    try {
      const r = await fetch("https://med.leaflock.com.au/api/analytics/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "__ping__" }),
      });
      const j = await r.json();
      const layout = await fetch("https://med.leaflock.com.au/assets/layout.js");
      const lb = await layout.text();
      console.log(`Check ${i + 1}: admin=${j.error || "ok"} header=${lb.includes("header-brand-wrap")} layout=${layout.status}`);
      if (j.error === "Invalid password" && lb.includes("header-brand-wrap")) {
        console.log("ALL GOOD on med.leaflock.com.au");
        return true;
      }
    } catch (e) {
      console.log(`Check ${i + 1} error:`, e.message);
    }
  }
  return false;
}

const envMap = JSON.parse((await readFile(ENV_FILE, "utf8")).replace(/^\uFEFF/, ""));

const context = await chromium.launchPersistentContext(PROFILE, {
  channel: "chrome",
  headless: false,
  viewport: { width: 1400, height: 900 },
  args: ["--remote-debugging-port=9226"],
});
const page = context.pages()[0] || (await context.newPage());

await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}/env`, { waitUntil: "domcontentloaded", timeout: 120000 });
if (!(await waitLogin(page))) {
  console.log("Login timed out");
  await context.close();
  process.exit(1);
}

const added = await syncEnv(page, envMap);
await addDomains(page);
if (added > 0) await deploy(page);
else await deploy(page);

await context.close();
await verify();