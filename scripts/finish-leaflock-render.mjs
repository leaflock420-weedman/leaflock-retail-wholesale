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
const SETTINGS = `https://dashboard.render.com/web/${SERVICE_ID}/settings`;
const ENV_URL = `https://dashboard.render.com/web/${SERVICE_ID}/env`;
const DOMAINS = ["med.leaflock.com.au", "www.med.leaflock.com.au"];
const PROFILE = path.join(root, ".chrome-render-leaflock");
const ENV_FILE = path.join(root, "data", ".leaflock-render-env.json");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForDashboard(page) {
  console.log("Sign in to Render as leaflock420@gmail.com if prompted (up to 3 min)...");
  for (let i = 0; i < 60; i++) {
    const url = page.url();
    const body = await page.locator("body").innerText().catch(() => "");
    if (/dashboard\.render\.com\/web\//.test(url) && !/sign in to render/i.test(body)) return true;
    await sleep(3000);
  }
  return false;
}

async function scrollToDomains(page) {
  await page.goto(SETTINGS, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(3000);
  await page.evaluate(() => document.querySelector('[data-id="custom-domains"]')?.scrollIntoView({ block: "center" }));
  await sleep(2000);
}

async function addDomain(page, domain) {
  await scrollToDomains(page);
  const text = await page.evaluate(() => document.querySelector('[data-id="custom-domains"]')?.innerText || "");
  if (text.includes(domain)) {
    console.log(`Domain already listed: ${domain}`);
    return;
  }
  const add = page.getByRole("button", { name: /add custom domain/i }).first();
  if (!(await add.isVisible({ timeout: 8000 }).catch(() => false))) {
    throw new Error(`Add Custom Domain button not found — check Leaf Lock workspace`);
  }
  await add.click();
  await sleep(800);
  await page.locator('[data-id="custom-domains"] input[type="text"]:not([disabled])').last().fill(domain);
  await page.locator('[data-id="custom-domains"]').getByRole("button", { name: /^save$/i }).first().click();
  await sleep(2500);
  console.log(`Added domain: ${domain}`);
}

async function verifyDomains(page) {
  await scrollToDomains(page);
  const buttons = page.locator('[data-id="custom-domains"] button, [data-id="custom-domains"] a');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const el = buttons.nth(i);
    const label = (await el.innerText().catch(() => "")).trim();
    if (/^verify$/i.test(label)) {
      await el.click().catch(() => {});
      await sleep(2000);
      console.log("Clicked Verify");
    }
  }
  const text = await page.evaluate(() => document.querySelector('[data-id="custom-domains"]')?.innerText || "");
  console.log("\nCustom domains:\n" + text.split("\n").slice(0, 20).join("\n"));
}

async function syncEnvVars(page, envMap) {
  await page.goto(ENV_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(4000);
  const body = await page.locator("body").innerText();
  let added = 0;
  for (const [key, value] of Object.entries(envMap)) {
    if (body.includes(key)) {
      console.log(`Env exists (skip UI): ${key}`);
      continue;
    }
    const add = page.getByRole("button", { name: /add environment variable|add env/i }).first();
    if (await add.isVisible({ timeout: 3000 }).catch(() => false)) {
      await add.click();
      await sleep(500);
    }
    const keyInput = page.getByPlaceholder(/key|name/i).last();
    const valInput = page.locator('input[type="password"], textarea, input[type="text"]').filter({ hasNotText: "" }).last();
    try {
      await page.getByLabel(/key/i).last().fill(key);
      await page.getByLabel(/value/i).last().fill(String(value));
      await page.getByRole("button", { name: /^save|add$/i }).last().click();
      added++;
      await sleep(800);
      console.log(`Added env: ${key}`);
    } catch {
      console.log(`Could not add ${key} via UI — add manually in Environment tab`);
    }
  }
  if (added) {
    const deploy = page.getByRole("button", { name: /manual deploy|deploy/i }).first();
    if (await deploy.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deploy.click();
      console.log("Triggered deploy after env sync");
    }
  }
}

const envJson = JSON.parse((await readFile(ENV_FILE, "utf8")).replace(/^\uFEFF/, ""));
const context = await chromium.launchPersistentContext(PROFILE, {
  channel: "chrome",
  headless: false,
  viewport: { width: 1440, height: 900 },
  args: ["--remote-debugging-port=9226"],
});
const page = context.pages()[0] || (await context.newPage());
await page.goto(SETTINGS, { waitUntil: "domcontentloaded", timeout: 120000 });
if (!(await waitForDashboard(page))) {
  console.log("Still on login — complete sign-in in Chrome window");
}
for (const d of DOMAINS) {
  try {
    await addDomain(page, d);
  } catch (e) {
    console.log(`Domain ${d}:`, e.message);
  }
}
await verifyDomains(page);
try {
  await syncEnvVars(page, envJson);
} catch (e) {
  console.log("Env sync:", e.message);
}
await page.screenshot({ path: path.join(root, "render-leaflock-finish.png"), fullPage: true });
console.log("Done — screenshot render-leaflock-finish.png");
await context.close();