import { readFile } from "fs/promises";
import path from "path";

const yaml = await readFile(path.join(process.env.USERPROFILE, ".render", "cli.yaml"), "utf8");
const key = yaml.match(/key:\s*(rnd_[^\s]+)/)?.[1];

const r = await fetch(
  "https://api.render.com/v1/services/srv-d93ivefaqgkc73c239ig/custom-domains/med.leaflock.com.au",
  { method: "DELETE", headers: { Authorization: `Bearer ${key}` } },
);
console.log("remove old domain:", r.status, await r.text());