import { readFile } from "fs/promises";
import path from "path";

const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
const key = yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1];
for (const id of ["srv-d93ivefaqgkc73c239ig", "srv-d93nossvikkc73amkvv0"]) {
  const r = await fetch(`https://api.render.com/v1/services/${id}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const t = await r.text();
  console.log(id, r.status, t.slice(0, 300));
}