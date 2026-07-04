import { readFile } from "fs/promises";
import path from "path";
import { blockProductionDeploy } from "./_project-guard.mjs";

blockProductionDeploy("_trigger-deploy.mjs");

const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
const key = yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1];
const SERVICE_ID = "srv-d93nossvikkc73amkvv0";

const r = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/deploys`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ clearCache: "clear" }),
});
const text = await r.text();
console.log("deploy", r.status, text.slice(0, 300));

if (r.ok) {
  const d = JSON.parse(text);
  for (let i = 0; i < 40; i++) {
    await new Promise((x) => setTimeout(x, 15000));
    const s = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/deploys/${d.id}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    const st = await s.json();
    console.log("status:", st.status);
    if (st.status === "live") break;
    if (["build_failed", "update_failed", "canceled"].includes(st.status)) break;
  }
}

const live = await fetch("https://med.leaflock.com.au/assets/layout.js");
console.log("live layout.js:", live.status, live.headers.get("last-modified"));