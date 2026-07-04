import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { EMBEDDED_CATALOG } = require("../lib/wholesale-catalog.js");
const { categoriesToCsv, BUNDLED_CSV_PATH } = require("../lib/catalog-csv.js");

const categories = EMBEDDED_CATALOG.map((cat) => ({
  ...cat,
  items: [...cat.items],
}));
categories.push({
  id: "humidity",
  label: "Humidity control 62%",
  items: [
    {
      sku: "HP-SINGLE",
      name: "2-Way Humidity Pack 62% — single",
      wholesale: 1.6,
      rrp: 2.5,
      bulkNote: "500+ packs: $1.45 ea (auto-applied)",
    },
  ],
});

fs.writeFileSync(BUNDLED_CSV_PATH, categoriesToCsv(categories), "utf8");
console.log(`Wrote catalogue template to ${BUNDLED_CSV_PATH}`);