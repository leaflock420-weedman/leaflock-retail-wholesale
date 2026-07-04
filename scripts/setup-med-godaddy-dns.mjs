import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const require = createRequire(import.meta.url);

const playwrightRoots = [
  path.join(process.env.USERPROFILE || "C:\\Users\\wordo", "lgbtiqasb-cards"),
  root,
];
let chromium;
for (const storeRoot of playwrightRoots) {
  try {
    ({ chromium } = require(require.resolve("playwright", { paths: [storeRoot] })));
    break;
  } catch {}
}
if (!chromium) {
  console.error("Playwright not found. Run: cd lgbtiqasb-cards && npm install");
  process.exit(1);
}

const DOMAIN = "leaflock.com.au";
const SUBDOMAIN = "med";
const TARGET = "216.24.57.1";
const RECORD_TYPE = "A";
const DNS_URL = `https://dcc.godaddy.com/control/dnsmanagement?domainName=${DOMAIN}`;
const LOGIN_URL = "https://sso.godaddy.com/?app=dcc&path=%2Fcontrol%2Fdnsmanagement%3FdomainName%3Dleaflock.com.au";
const GODADDY_USER = process.env.GODADDY_USERNAME || "leaflock420@gmail.com";
const profile = path.join(root, ".chrome-godaddy-leaflock");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryClick(page, locators, timeout = 3000) {
  for (const locator of locators) {
    try {
      const el = typeof locator === "string" ? page.locator(locator).first() : locator;
      if (await el.isVisible({ timeout })) {
        await el.click();
        return true;
      }
    } catch {}
  }
  return false;
}

async function tryFill(page, locators, value, timeout = 3000) {
  for (const locator of locators) {
    try {
      const el = typeof locator === "string" ? page.locator(locator).first() : locator;
      if (await el.isVisible({ timeout })) {
        await el.fill(value);
        return true;
      }
    } catch {}
  }
  return false;
}

async function waitForDnsPage(page) {
  const start = Date.now();
  while (Date.now() - start < 300000) {
    const url = page.url();
    const body = await page.locator("body").innerText().catch(() => "");
    if (/dnsmanagement/i.test(url) || /DNS Management/i.test(body)) return true;
    if (/signin|login|sso/i.test(url)) {
      console.log("Sign in as", GODADDY_USER, "— complete password + phone approval in Chrome.");
      await tryFill(page, [
        page.getByLabel(/username|email/i),
        page.locator("input[type='email']"),
        page.locator("input[name='username']"),
        "#username",
      ], GODADDY_USER);
      await tryClick(page, [
        page.getByRole("button", { name: /sign in|continue|next/i }),
        "button[type='submit']",
      ]);
    }
    await sleep(3000);
  }
  return false;
}

async function upsertMedRecord(page) {
  const body = await page.locator("body").innerText();
  if (new RegExp(`${SUBDOMAIN}[^\\n]*${TARGET.replace(/\./g, "\\.")}`, "i").test(body)) {
    console.log(`med ${RECORD_TYPE} already points to Render.`);
    return true;
  }

  const medRow = page.locator("tr, [role='row'], div").filter({ hasText: /^med\b|med\./i }).first();
  if (await medRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("Found med record — editing...");
    const editBtn = medRow.getByRole("button", { name: /edit/i }).or(medRow.locator("[aria-label*='Edit'], svg").first());
    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click();
      await sleep(1500);
      await tryFill(page, [
        page.getByLabel(/value|points to|data/i),
        page.locator("input").filter({ hasNot: page.locator("[type='hidden']") }),
      ], TARGET);
      await tryClick(page, [
        page.getByRole("button", { name: /save/i }),
        page.getByRole("button", { name: /update/i }),
      ]);
      await sleep(3000);
      return true;
    }

    const delBtn = medRow.getByRole("button", { name: /delete|remove/i });
    if (await delBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await delBtn.click();
      await tryClick(page, [page.getByRole("button", { name: /confirm|delete|yes/i })]);
      await sleep(2000);
    }
  }

  console.log(`Adding med ${RECORD_TYPE}...`);
  await tryClick(page, [
    page.getByRole("button", { name: /add.*record/i }),
    page.getByRole("button", { name: /^add$/i }),
    page.getByText(/add.*record/i),
  ]);
  await sleep(2000);

  await tryClick(page, [
    page.getByRole("option", { name: new RegExp(`^${RECORD_TYPE}$`, "i") }),
    page.getByText(new RegExp(`^${RECORD_TYPE}$`, "i")),
    page.locator("select"),
  ]);
  await tryClick(page, [page.getByText(new RegExp(`^${RECORD_TYPE}$`, "i"))]);

  await tryFill(page, [
    page.getByLabel(/name|host/i),
    page.locator("input[placeholder*='Name']"),
    page.locator("input").nth(0),
  ], SUBDOMAIN);

  await tryFill(page, [
    page.getByLabel(/value|points to/i),
    page.locator("input[placeholder*='Value']"),
    page.locator("input").nth(1),
  ], TARGET);

  await tryClick(page, [
    page.getByRole("button", { name: /save/i }),
    page.getByRole("button", { name: /add record/i }),
  ]);
  await sleep(4000);
  return true;
}

async function main() {
  console.log(`Chrome → GoDaddy DNS: ${SUBDOMAIN}.${DOMAIN} → ${TARGET}`);
  console.log(`Account: ${GODADDY_USER}`);

  const context = await chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 920 },
    args: ["--start-maximized"],
  });

  const page = context.pages()[0] || (await context.newPage());
  page.on("dialog", (d) => d.accept().catch(() => {}));

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  } catch (err) {
    console.log("Initial navigation interrupted (login redirect) — continuing...");
  }
  await sleep(5000);

  const onDns = await waitForDnsPage(page);
  if (!onDns) {
    console.log("Finish GoDaddy login in Chrome, then open:");
    console.log(DNS_URL);
    console.log("Waiting up to 5 minutes for DNS page...");
    try {
      await page.waitForURL(/dnsmanagement/i, { timeout: 300000 });
    } catch {
      console.log("Still not on DNS page — complete login manually.");
    }
  }

  try {
    await page.goto(DNS_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  } catch {
    /* redirect during auth */
  }
  await sleep(6000);

  const onPage = /dnsmanagement/i.test(page.url());
  if (onPage) {
    await upsertMedRecord(page);
  } else {
    console.log("On URL:", page.url());
    console.log(`After login, set ${RECORD_TYPE}: med →`, TARGET);
  }

  const shot = path.join(root, "godaddy-med-dns.png");
  await page.screenshot({ path: shot, fullPage: true });
  console.log("Screenshot:", shot);
  console.log("Leaving Chrome open 60s — confirm med →", TARGET);
  await sleep(60000);
  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});