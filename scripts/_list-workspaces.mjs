import { readFile } from "fs/promises";
import path from "path";

const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
const key = yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1];
const r = await fetch("https://api.render.com/v1/owners?limit=20", {
  headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
});
console.log("status", r.status);
const data = await r.json();
for (const row of data) {
  const o = row.owner || row;
  console.log(o.id, o.name, o.email);
}