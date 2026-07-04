import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const BASE = "https://med.leaflock.com.au";
const env = JSON.parse(
  (await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", ".leaflock-render-env.json"), "utf8")).replace(/^\uFEFF/, ""),
);

const login = await fetch(`${BASE}/api/portal/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: env.SEED_ACCESS_CODE }),
});
const body = await login.json();
console.log("Portal login:", login.status, body.pharmacy?.businessName || body.error);

if (body.token) {
  const pp = await fetch(`${BASE}/api/paypal/config`, {
    headers: { Authorization: `Bearer ${body.token}` },
  });
  const cfg = await pp.json();
  console.log("PayPal portal config:", JSON.stringify(cfg));
}