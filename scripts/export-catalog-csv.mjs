import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { EMBEDDED_CATALOG } = require("../lib/wholesale-catalog.js");

const MOQ_FIVE = new Set(["STICKERS", "MAGNETS", "KEYCHAINS-TEXT", "KEYCHAINS-MONO"]);

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const header =
  "Category,SKU,Product Name,Wholesale ex GST,RRP,MOQ,Bulk/Notes,Image URL,Bundle,Units per bundle,Active";
const rows = [header];

for (const cat of EMBEDDED_CATALOG) {
  for (const item of cat.items) {
    const moq = item.moq || (MOQ_FIVE.has(item.sku) ? 5 : "");
    rows.push(
      [
        csvCell(cat.label),
        csvCell(item.sku),
        csvCell(item.name),
        item.wholesale,
        item.rrp,
        moq,
        csvCell(item.bulkNote || item.note || ""),
        csvCell(item.imageUrl || ""),
        item.isBundle ? "Y" : "",
        item.unitBasis || "",
        "Y",
      ].join(","),
    );
  }
}

rows.push(
  [
    csvCell("Humidity control 62%"),
    "HP-SINGLE",
    csvCell("2-Way Humidity Pack 62% — single"),
    1.45,
    2.5,
    "",
    csvCell("500+ packs: $1.35 ea (auto-applied)"),
    "",
    "",
    "",
    "Y",
  ].join(","),
);

const out = path.join(__dirname, "..", "data", "wholesale-catalog.csv");
fs.writeFileSync(out, `${rows.join("\n")}\n`, "utf8");
console.log(`Wrote ${rows.length - 1} products to ${out}`);