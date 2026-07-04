import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const storeRoot = path.join(process.env.USERPROFILE || "C:\\Users\\wordo", "leaflock-store-v2");
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve("playwright", { paths: [storeRoot] }));

const GITHUB_REPO = "https://github.com/leaflock420-weedman/leaflock-pharmacy-wholesale";
const SERVICE_NAME = "leaflock-pharmacy-wholesale";
const LIVE_URL = "https://leaflock-pharmacy-wholesale.onrender.com";
const PROFILE = path.join(root, ".chrome-render-profile");
const CDP_PORTS = [9225, 9224, 9223, 9222];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function screenshot(page, name) {
  const file = path.join(root, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`Screenshot: ${name}`);
}

async function connectCdp() {
  for (const port of CDP_PORTS) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      console.log(`CDP connected on ${port}`);
      return browser;
    } catch {}
  }
  return null;
}

async function waitForLogin(page) {
  const body = await page.locator("body").innerText().catch(() => "");
  if (!/sign in to render/i.test(body)) return true;
  console.log("Sign in to Render in Chrome (up to 3 min)...");
  const start = Date.now();
  while (Date.now() - start < 180000) {
    await sleep(3000);
    const text = await page.locator("body").innerText().catch(() => "");
    if (!/sign in to render/i.test(text)) return true;
  }
  return false;
}

async function clickFirst(page, makers, timeout = 8000) {
  for (const make of makers) {
    try {
      const el = make(page).first();
      if (await el.isVisible({ timeout })) {
        await el.click();
        return true;
      }
    } catch {}
  }
  return false;
}

async function grantRepoAccess(page) {
  return clickFirst(page, [
    (p) => p.getByRole("button", { name: /configure account|grant access|install|authorize/i }),
    (p) => p.locator("button:has-text('Configure account')"),
    (p) => p.locator("button:has-text('Grant access')"),
    (p) => p.locator("a:has-text('Configure account')"),
  ], 5000);
}

async function fillBlueprintName(page) {
  const input = page.getByLabel(/blueprint name/i).first();
  if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
    await input.fill(SERVICE_NAME);
    return true;
  }
  return false;
}

async function deployBlueprint(page) {
  const urls = [
    `https://dashboard.render.com/blueprint/new?repo=${encodeURIComponent(GITHUB_REPO)}`,
    `https://render.com/deploy?repo=${encodeURIComponent(GITHUB_REPO)}`,
  ];

  for (const url of urls) {
    console.log(`Opening ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await sleep(5000);
    await waitForLogin(page);
    await grantRepoAccess(page);
    await sleep(3000);
    await fillBlueprintName(page);
    await screenshot(page, "render-blueprint-step.png");

    const clicked = await clickFirst(page, [
      (p) => p.getByRole("button", { name: /deploy blueprint/i }),
      (p) => p.getByRole("button", { name: /^apply$/i }),
      (p) => p.locator("button:has-text('Deploy Blueprint')"),
      (p) => p.locator("button:has-text('Apply')"),
      (p) => p.locator("button:has-text('Create Blueprint')"),
    ], 15000);

    if (clicked) {
      console.log("Blueprint deploy submitted");
      await sleep(5000);
      await screenshot(page, "render-blueprint-submitted.png");
      return true;
    }
  }
  return false;
}

async function deployWebService(page) {
  console.log("Trying web service wizard...");
  await page.goto("https://dashboard.render.com/create?type=web", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(4000);
  await waitForLogin(page);

  await clickFirst(page, [
    (p) => p.getByRole("button", { name: /connect.*github|connect account/i }),
    (p) => p.locator("button:has-text('Connect')"),
  ], 5000);
  await sleep(3000);
  await grantRepoAccess(page);
  await sleep(3000);

  await clickFirst(page, [
    (p) => p.getByText(/leaflock-pharmacy-wholesale/i),
    (p) => p.locator("text=leaflock-pharmacy-wholesale"),
  ], 10000);
  await sleep(2000);

  const nameInput = page.getByLabel(/^name$/i).first();
  if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nameInput.fill(SERVICE_NAME);
  }

  const branchInput = page.getByLabel(/branch/i).first();
  if (await branchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await branchInput.fill("master");
  }

  const buildInput = page.getByLabel(/build command/i).first();
  if (await buildInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await buildInput.fill("npm install");
  }

  const startInput = page.getByLabel(/start command/i).first();
  if (await startInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startInput.fill("npm start");
  }

  const created = await clickFirst(page, [
    (p) => p.getByRole("button", { name: /create web service/i }),
    (p) => p.getByRole("button", { name: /^deploy/i }),
    (p) => p.locator("button:has-text('Create Web Service')"),
  ], 10000);

  if (created) {
    await screenshot(page, "render-web-service-submitted.png");
    return true;
  }
  return false;
}

async function openService(page) {
  await page.goto("https://dashboard.render.com/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(3000);
  await waitForLogin(page);
  const link = page.getByRole("link", { name: new RegExp(SERVICE_NAME, "i") }).first();
  if (await link.isVisible({ timeout: 8000 }).catch(() => false)) {
    await link.click();
    await sleep(3000);
    return true;
  }
  return false;
}

async function triggerManualDeploy(page) {
  return clickFirst(page, [
    (p) => p.getByRole("button", { name: /manual deploy/i }),
    (p) => p.locator("button:has-text('Manual Deploy')"),
  ], 8000);
}

async function waitForHttpLive() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(LIVE_URL, { redirect: "follow" });
      const text = await res.text();
      if (res.ok && /leaflock|wholesale|humidity/i.test(text)) {
        console.log(`LIVE: ${LIVE_URL} (${res.status})`);
        return true;
      }
      console.log(`Waiting for deploy... (${i + 1}/40) status=${res.status}`);
    } catch {
      console.log(`Waiting for deploy... (${i + 1}/40)`);
    }
    await sleep(15000);
  }
  return false;
}

async function createViaApi() {
  const cliYaml = await import("fs/promises").then((fs) => fs.readFile("C:\\Users\\wordo\\.render\\cli.yaml", "utf8"));
  const key = cliYaml.match(/key:\s*(rnd_[^\s]+)/)?.[1];
  if (!key) return false;

  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  const body = {
    type: "web_service",
    name: SERVICE_NAME,
    ownerId: "tea-d8v40i68bjmc739jjmv0",
    repo: GITHUB_REPO,
    branch: "master",
    autoDeploy: "yes",
    serviceDetails: {
      runtime: "node",
      env: "node",
      plan: "free",
      region: "oregon",
      healthCheckPath: "/",
      envSpecificDetails: {
        buildCommand: "npm install",
        startCommand: "npm start",
      },
      envVars: [
        { key: "NODE_VERSION", value: "20" },
        { key: "TZ", value: "Australia/Brisbane" },
        { key: "ANALYTICS_ADMIN_PASSWORD", value: "LeafLock2026" },
        { key: "SMTP_PORT", value: "587" },
      ],
    },
  };

  const res = await fetch("https://api.render.com/v1/services", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.ok) {
    console.log("Render API service created");
    return true;
  }
  console.log(`Render API create failed: ${text}`);
  return false;
}

async function main() {
  let browser = await connectCdp();
  let context;
  let ownsContext = false;

  if (!browser) {
    await mkdir(PROFILE, { recursive: true });
    context = await chromium.launchPersistentContext(PROFILE, {
      channel: "chrome",
      headless: false,
      viewport: { width: 1440, height: 900 },
      args: ["--remote-debugging-port=9225"],
    });
    ownsContext = true;
    browser = await connectCdp();
  }

  if (!browser && !context) {
    const { spawn } = await import("child_process");
    const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    spawn(
      chrome,
      [
        "--remote-debugging-port=9225",
        `--user-data-dir=${PROFILE}`,
        "--no-first-run",
        `https://dashboard.render.com/blueprint/new?repo=${encodeURIComponent(GITHUB_REPO)}`,
      ],
      { detached: true, stdio: "ignore" }
    ).unref();
    for (let i = 0; i < 25; i++) {
      await sleep(1000);
      browser = await connectCdp();
      if (browser) break;
    }
  }

  if (browser && !ownsContext) context = browser.contexts()[0];
  if (!context && !browser) throw new Error("Could not connect to Chrome for Render deploy");

  const page =
    context?.pages().find((p) => /render/i.test(p.url())) ||
    browser?.contexts()[0]?.pages()[0] ||
    (await context.newPage());

  if (await openService(page)) {
    console.log("Service exists — triggering manual deploy");
    await triggerManualDeploy(page);
  } else {
    console.log("Creating new Blueprint deploy...");
    let ok = await deployBlueprint(page);
    if (!ok) ok = await deployWebService(page);
    if (!ok) {
      console.log("UI deploy failed — trying Render API (requires public repo access)...");
      ok = await createViaApi();
    }
    if (!ok) {
      throw new Error(
        "Deploy not completed. Private repo may need GitHub access in Render — open dashboard and grant access to leaflock-pharmacy-wholesale."
      );
    }
  }

  const live = await waitForHttpLive();
  if (!live) console.log("Deploy submitted — site may still be building. Check Render dashboard.");
  console.log(`Site:  ${LIVE_URL}`);
  console.log(`Admin: ${LIVE_URL}/admin/  Password: LeafLock2026`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});