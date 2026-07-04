import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cfgPath = path.join(root, "project.config.json");

export function loadProjectConfig() {
  if (!existsSync(cfgPath)) return null;
  return JSON.parse(readFileSync(cfgPath, "utf8"));
}

/** Stop deploy/sync scripts from hitting med.leaflock production. */
export function blockProductionDeploy(scriptName = "script") {
  const cfg = loadProjectConfig();
  if (!cfg?.isolated || !cfg?.blockProductionDeploy) return cfg;

  console.error("");
  console.error("╔══════════════════════════════════════════════════════════╗");
  console.error("║  BLOCKED — LL Wholesale isolated copy                    ║");
  console.error("╚══════════════════════════════════════════════════════════╝");
  console.error("");
  console.error(`  ${scriptName} cannot run against production from this copy.`);
  console.error("  Open the ORIGINAL project for med.leaflock.com.au:");
  console.error(`    ${cfg.parentProject}`);
  console.error("");
  console.error("  This copy is for local experiments only (localhost:4280).");
  console.error("  See OPEN-SEPARATELY.txt");
  console.error("");
  process.exit(1);
}

export function assertCorrectWorkspace() {
  const cfg = loadProjectConfig();
  if (!cfg) return;
  const cwd = process.cwd().replace(/\//g, "\\").toLowerCase();
  if (!cwd.includes("ll-wholesale")) {
    console.warn("[ll-wholesale] Warning: cwd does not look like LL-Wholesale folder:", process.cwd());
  }
  return cfg;
}