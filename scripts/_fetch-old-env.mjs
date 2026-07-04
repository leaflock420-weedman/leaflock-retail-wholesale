import { readFile } from "fs/promises";
import path from "path";

const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
const key = yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1];
const oldId = "srv-d93ivefaqgkc73c239ig";
const newId = "srv-d93nossvikkc73amkvv0";

for (const [label, id] of [["old", oldId], ["new", newId]]) {
  const r = await fetch(`https://api.render.com/v1/services/${id}/env-vars`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const t = await r.text();
  console.log(`\n${label} env (${r.status}):`);
  if (r.ok) {
    const data = JSON.parse(t);
    for (const row of data) {
      const k = row.envVar.key;
      const v = row.envVar.value;
      const masked = /pass|secret|password|salt/i.test(k) ? v.slice(0, 4) + "…" : v;
      console.log(`  ${k}=${masked}`);
    }
  } else console.log(t.slice(0, 200));
}