import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const storeRoot = path.join(process.env.USERPROFILE || "C:\\Users\\wordo", "leaflock-store-v2");
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve("playwright", { paths: [storeRoot] }));

const SERVICE_ID = "srv-d93ivefaqgkc73c239ig";
const REPO_NAME = "leaflock-med-wholesale";
const LIVE_URL = "https://leaflock-med-wholesale.onrender.com";
const PROFILE = path.join(root, ".chrome-render-profile");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getRenderKey() {
  const cliYaml = await readFile("C:\\Users\\wordo\\.render\\cli.yaml", "utf8");
  return cliYaml.match(/key:\s*(rnd_[^\s]+)/)?.[1] || "";
}

async function clickFirst(page, makers, timeout = 5000) {
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

async function grantGithubRepoAccess(page) {
  await page.goto("https://github.com/settings/installations", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(3000);

  const body = await page.locator("body").innerText().catch(() => "");
  if (/sign in/i.test(body) && !/installations/i.test(page.url())) {
    console.log("Sign in to GitHub in Chrome, then wait...");
    for (let i = 0; i < 60; i++) {
      await sleep(3000);
      if (!/sign in/i.test(await page.locator("body").innerText().catch(() => ""))) break;
    }
  }

  await clickFirst(page, [
    (p) => p.getByRole("link", { name: /render/i }),
    (p) => p.locator("a:has-text('Render')"),
    (p) => p.locator("strong:has-text('Render')"),
  ], 8000);
  await sleep(2000);

  await clickFirst(page, [
    (p) => p.getByRole("button", { name: /^configure$/i }),
    (p) => p.getByRole("link", { name: /^configure$/i }),
    (p) => p.locator("a:has-text('Configure')"),
    (p) => p.locator("button:has-text('Configure')"),
  ], 8000);
  await sleep(2000);

  await clickFirst(page, [
    (p) => p.getByLabel(/only select repositories/i),
    (p) => p.locator("input[value='selected']"),
    (p) => p.getByText(/only select repositories/i),
  ], 5000);
  await sleep(1000);

  await clickFirst(page, [
    (p) => p.getByRole("button", { name: /select repositories/i }),
    (p) => p.locator("button:has-text('Select repositories')"),
  ], 5000);
  await sleep(1500);

  const repoCheckbox = page.getByLabel(new RegExp(REPO_NAME, "i")).first();
  if (await repoCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
    await repoCheckbox.check();
  } else {
    await clickFirst(page, [
      (p) => p.getByText(new RegExp(REPO_NAME, "i")),
      (p) => p.locator(`text=${REPO_NAME}`),
    ], 5000);
  }
  await sleep(1000);

  await clickFirst(page, [
    (p) => p.getByRole("button", { name: /^save$/i }),
    (p) => p.locator("button:has-text('Save')"),
  ], 5000);
  await sleep(2000);
  console.log("GitHub Render app access updated (or already set).");
}

async function triggerRenderDeploy(apiKey) {
  const res = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/deploys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ clearCache: "clear" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Deploy trigger failed (${res.status}): ${text}`);
  const data = JSON.parse(text);
  console.log(`Deploy triggered: ${data.id} status=${data.status}`);
  return data.id;
}

async function waitForLive(apiKey, deployId) {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/deploys/${deployId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      const status = data.status;
      console.log(`Deploy ${deployId}: ${status}`);
      if (status === "live") return true;
      if (status === "build_failed" || status === "update_failed" || status === "canceled") {
        throw new Error(`Deploy ended with status: ${status}`);
      }
    }
    await sleep(15000);
  }
  return false;
}

async function main() {
  const apiKey = await getRenderKey();
  if (!apiKey) throw new Error("Render API key not found in ~/.render/cli.yaml");

  const context = await chromium.launchPersistentContext(PROFILE, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1400, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    await grantGithubRepoAccess(page);
  } catch (err) {
    console.log("GitHub grant step:", err.message);
    console.log("If needed, manually grant Render access to", REPO_NAME);
  }

  const deployId = await triggerRenderDeploy(apiKey);
  const live = await waitForLive(apiKey, deployId);
  if (live) {
    const check = await fetch(LIVE_URL);
    console.log(`LIVE ${LIVE_URL} (${check.status})`);
    console.log(`Production: https://med.leaflock.com.au`);
  } else {
    console.log("Deploy still building — check Render dashboard.");
  }

  await context.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});