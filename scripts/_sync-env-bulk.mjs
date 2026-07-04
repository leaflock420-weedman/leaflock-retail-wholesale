import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const SERVICE_ID = "srv-d93nossvikkc73amkvv0";
const root = path.dirname(fileURLToPath(import.meta.url), "..");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);

const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
const key = yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1];
const envMap = JSON.parse(
  (await readFile(path.join(projectRoot, "data", ".leaflock-render-env.json"), "utf8")).replace(/^\uFEFF/, ""),
);

const headers = {
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

// Try bulk put
const bulk = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/env-vars`, {
  method: "PUT",
  headers,
  body: JSON.stringify(
    Object.entries(envMap).map(([key, value]) => ({ key, value: String(value) })),
  ),
});
console.log("bulk PUT", bulk.status, (await bulk.text()).slice(0, 400));

if (!bulk.ok) {
  for (const [name, value] of Object.entries(envMap)) {
    const r = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/env-vars`, {
      method: "POST",
      headers,
      body: JSON.stringify({ key: name, value: String(value) }),
    });
    console.log(name, r.status, r.ok ? "ok" : (await r.text()).slice(0, 80));
  }
}