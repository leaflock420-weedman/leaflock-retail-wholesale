import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url), "..");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);
const env = JSON.parse(
  (await readFile(path.join(projectRoot, "data", ".leaflock-render-env.json"), "utf8")).replace(/^\uFEFF/, ""),
);
const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n");
const out = path.join(projectRoot, "data", "render-env-paste.env");
await writeFile(out, lines + "\n", "utf8");
console.log("Wrote", out);