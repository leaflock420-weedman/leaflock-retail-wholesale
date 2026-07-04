import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url), "..");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve("playwright", {
  paths: [path.join(process.env.USERPROFILE || "C:\\Users\\wordo", "leaflock-store-v2")],
}));

const SERVICE_ID = "srv-d93nossvikkc73amkvv0";
const PROFILE = path.join(projectRoot, ".chrome-render-leaflock");
const CDP_PORTS = [9226, 9225, 9224, 9223, 9222];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let browser;
for (const port of CDP_PORTS) {
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    break;
  } catch {}
}

let own;
let page;
if (browser) {
  page = browser.contexts()[0]?.pages().find((p) => /render\.com/.test(p.url())) || browser.contexts()[0]?.pages()[0];
} else {
  own = await chromium.launchPersistentContext(PROFILE, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ["--remote-debugging-port=9226"],
  });
  page = own.pages()[0] || (await own.newPage());
}

await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
await sleep(4000);

for (let i = 0; i < 40; i++) {
  const body = await page.locator("body").innerText().catch(() => "");
  if (/dashboard\.render\.com/.test(page.url()) && !/sign in to render/i.test(body)) break;
  await sleep(3000);
}

const deploy = page.getByRole("button", { name: /manual deploy/i }).first();
if (await deploy.isVisible({ timeout: 8000 }).catch(() => false)) {
  await deploy.click();
  console.log("Manual Deploy clicked");
  await sleep(3000);
  const deployLatest = page.getByRole("menuitem", { name: /deploy latest commit/i }).or(page.getByText(/deploy latest commit/i));
  if (await deployLatest.isVisible({ timeout: 3000 }).catch(() => false)) {
    await deployLatest.click();
    console.log("Deploy latest commit");
  }
} else {
  console.log("Manual Deploy button not found — sign in as leaflock420@gmail.com");
}

for (let i = 0; i < 30; i++) {
  await sleep(15000);
  const r = await fetch("https://med.leaflock.com.au/assets/layout.js");
  const t = await r.text();
  if (t.includes("header-brand-wrap")) {
    console.log("LIVE — mobile header deployed");
    break;
  }
  console.log(`Waiting for deploy... (${i + 1})`);
}

if (own) await own.close().catch(() => {});