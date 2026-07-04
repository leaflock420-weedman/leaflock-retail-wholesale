/**
 * Fail if tracked repo files look like they contain live secrets.
 * Run: npm run secrets:check
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const FORBIDDEN_TRACKED = [
  "data/.leaflock-render-env.json",
  "data/.production-secrets.json",
  ".env.local",
  ".env",
];

const SECRET_ENV_VARS = [
  "AUSPOST_PAC_API_KEY",
  "SMTP_PASS",
  "PAYPAL_CLIENT_SECRET",
  "ANALYTICS_ADMIN_PASSWORD",
  "PORTAL_SESSION_SECRET",
  "ADMIN_SESSION_SECRET",
  "PORTAL_CODE_SALT",
  "PORTAL_PASSWORD_PEPPER",
  "GUMMY_CHECKOUT_ACCESS_KEY",
];

const SAFE_LITERALS = new Set([
  "test-admin-pass",
  "Demo-Test-Pass-2026!",
  "Demo-Stockist-2026!",
  "",
]);

function lineLooksLikeLiveSecret(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) return false;
  if (trimmed.includes(".env.example")) return false;
  for (const key of SECRET_ENV_VARS) {
    const re = new RegExp(`${key}\\s*[:=]\\s*([^,;#]+)`);
    const match = trimmed.match(re);
    if (!match) continue;
    let value = match[1].trim().replace(/^['"`]|['"`]$/g, "");
    if (value.startsWith("envJson.") || value.includes("process.env")) continue;
    if (SAFE_LITERALS.has(value)) continue;
    if (value.startsWith("<") && value.endsWith(">")) continue;
    if (value.startsWith("test-")) continue;
    if (value.length >= 8) return true;
  }
  if (/rnd_[a-zA-Z0-9]{20,}/.test(trimmed)) return true;
  return false;
}

function gitTrackedFiles() {
  try {
    const out = execSync("git ls-files", { cwd: root, encoding: "utf8" });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    console.warn("Not a git repo — skipping tracked-file scan.");
    return [];
  }
}

let failed = 0;

for (const rel of FORBIDDEN_TRACKED) {
  const tracked = gitTrackedFiles();
  if (tracked.includes(rel.replace(/\\/g, "/"))) {
    console.error(`✗ Secret file must not be in git: ${rel}`);
    failed += 1;
  }
}

const tracked = gitTrackedFiles().filter(
  (f) => !f.endsWith(".env.example") && !f.includes("check-secrets.mjs"),
);

for (const rel of tracked) {
  if (rel.endsWith(".pdf") || rel.endsWith(".png") || rel.endsWith(".jpg")) continue;
  let text;
  try {
    text = fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    continue;
  }
  for (const line of text.split(/\r?\n/)) {
    if (lineLooksLikeLiveSecret(line)) {
      console.error(`✗ Possible secret in tracked file ${rel}`);
      failed += 1;
      break;
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} secret check(s) failed. Remove secrets before git push.`);
  console.error("See docs/SECURITY-RULES.txt");
  process.exit(1);
}

console.log("✓ No obvious secrets in tracked files.");