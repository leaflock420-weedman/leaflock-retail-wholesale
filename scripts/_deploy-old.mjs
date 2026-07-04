import { readFile } from "fs/promises";
import path from "path";

const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
const key = yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1];
const OLD = "srv-d93ivefaqgkc73c239ig";

const r = await fetch(`https://api.render.com/v1/services/${OLD}/deploys`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ clearCache: "clear" }),
});
const text = await r.text();
console.log("deploy", r.status, text);
if (!r.ok) process.exit(1);

const { id } = JSON.parse(text);
for (let i = 0; i < 40; i++) {
  await new Promise((x) => setTimeout(x, 15000));
  const s = await fetch(`https://api.render.com/v1/services/${OLD}/deploys/${id}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const st = await s.json();
  console.log("status:", st.status);
  if (st.status === "live") break;
  if (["build_failed", "update_failed", "canceled"].includes(st.status)) process.exit(1);
}

const live = await fetch("https://med.leaflock.com.au/assets/layout.js");
const body = await live.text();
console.log("med has new header:", body.includes("header-brand-wrap"));