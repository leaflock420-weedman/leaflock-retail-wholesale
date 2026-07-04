import { createRequire } from "module";
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
const PROFILE = path.join(root, ".chrome-render-profile");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function addDomain(page, domain) {
  await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}/settings`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(4000);
  await page.evaluate(() => {
    document.querySelector('[data-id="custom-domains"]')?.scrollIntoView({ block: "center" });
  });
  await sleep(2000);

  const existing = await page.evaluate(() => {
    const el = document.querySelector('[data-id="custom-domains"]');
    return el ? el.innerText : "";
  });
  if (existing.includes(domain)) {
    console.log(`Already listed: ${domain}`);
    return true;
  }

  const addBtn = page.getByRole("button", { name: /add custom domain/i }).first();
  if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log(`Cannot add ${domain} — button missing (wrong account or domain limit)`);
    return false;
  }
  await addBtn.click();
  await sleep(1000);
  const input = page.locator('[data-id="custom-domains"] input[type="text"]:not([disabled])').last();
  await input.fill(domain);
  await page.locator('[data-id="custom-domains"]').getByRole("button", { name: /^save$/i }).first().click();
  await sleep(3000);
  console.log(`Added: ${domain}`);
  return true;
}

async function verifyDomains(page) {
  await page.goto(`https://dashboard.render.com/web/${SERVICE_ID}/settings`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(3000);
  const text = await page.evaluate(() => document.querySelector('[data-id="custom-domains"]')?.innerText || "");
  console.log("\nCustom domains panel:\n", text.split("\n").slice(0, 25).join("\n"));
}

const context = await chromium.launchPersistentContext(PROFILE, {
  channel: "chrome",
  headless: false,
  viewport: { width: 1400, height: 900 },
});
const page = context.pages()[0] || (await context.newPage());

for (const domain of DOMAINS) {
  await addDomain(page, domain);
}

await verifyDomains(page);
await page.screenshot({ path: path.join(root, "render-med-domains.png"), fullPage: true });
console.log("Screenshot: render-med-domains.png");
await context.close();