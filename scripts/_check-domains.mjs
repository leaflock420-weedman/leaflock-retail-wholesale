import { readFile } from "fs/promises";
import path from "path";

const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
const key = yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1];

for (const [label, id] of [["old", "srv-d93ivefaqgkc73c239ig"], ["new", "srv-d93nossvikkc73amkvv0"]]) {
  const r = await fetch(`https://api.render.com/v1/services/${id}/custom-domains`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  console.log(`\n${label} (${r.status}):`);
  if (r.ok) {
    const data = await r.json();
    for (const row of data) {
      const d = row.customDomain || row;
      console.log(`  ${d.name} verified=${d.verified}`);
    }
  } else console.log(await r.text());
}