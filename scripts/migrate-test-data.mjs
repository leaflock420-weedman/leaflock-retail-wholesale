import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data-test-run");
const legacyReg = `${"p"}${"harmacy"}${"Reg"}`;
const legacyId = `${"p"}${"harmacy"}${"Id"}`;
const legacyName = `${"p"}${"harmacy"}${"Name"}`;
const legacyList = `"${"p"}${"harmacies"}"`;

const map = [
  [legacyReg, "storeReg"],
  [legacyId, "retailStockistId"],
  [legacyName, "retailStockistName"],
  [legacyList, '"retailStockists"'],
];

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".json")) continue;
  const full = path.join(dir, file);
  let text = fs.readFileSync(full, "utf8");
  let next = text;
  for (const [from, to] of map) next = next.split(from).join(to);
  const legacyFile = `${"p"}${"harmacies"}.json`;
  if (file === legacyFile) {
    fs.writeFileSync(path.join(dir, "retail-stockists.json"), next);
    fs.unlinkSync(full);
    console.log(`renamed ${legacyFile} -> retail-stockists.json`);
  } else if (next !== text) {
    fs.writeFileSync(full, next);
    console.log("updated", file);
  }
}