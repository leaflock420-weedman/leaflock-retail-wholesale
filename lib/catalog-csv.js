const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "..", "data", "wholesale-catalog.csv");

function parseMoney(value) {
  const n = Number.parseFloat(String(value || "").replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function slugifyCategory(label) {
  return String(label || "catalog")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function rowToItem(cells, headerIndex) {
  const get = (name) => cells[headerIndex[name]] ?? "";
  const sku = get("sku").trim();
  if (!sku || sku.startsWith("#")) return null;

  const wholesale = parseMoney(get("wholesale ex gst") || get("wholesale"));
  const rrp = parseMoney(get("rrp"));
  if (wholesale === null || rrp === null) return null;

  const moqRaw = get("moq").trim();
  const moq = moqRaw ? Math.max(1, Math.floor(Number(moqRaw) || 0)) : null;
  const bulkNote = get("bulk/notes") || get("bulk notes") || get("notes") || "";
  const imageUrl = get("image url") || get("image_url") || "";
  const isBundle = ["y", "yes", "true", "1"].includes(get("bundle").trim().toLowerCase());
  const unitBasisRaw = get("units per bundle").trim();
  const unitBasis = unitBasisRaw ? Math.max(1, Math.floor(Number(unitBasisRaw) || 0)) : null;
  const active = get("active").trim().toLowerCase();
  if (active === "n" || active === "no" || active === "0") return null;

  const item = {
    sku,
    name: get("product name") || get("product") || sku,
    wholesale,
    rrp,
  };
  if (moq) item.moq = moq;
  if (bulkNote) item.bulkNote = bulkNote;
  if (imageUrl) item.imageUrl = imageUrl;
  if (isBundle) item.isBundle = true;
  if (unitBasis) item.unitBasis = unitBasis;
  return item;
}

function loadCatalogFromCsv(filePath = CSV_PATH) {
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return null;

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const headerIndex = Object.fromEntries(header.map((name, idx) => [name, idx]));
  if (headerIndex.sku === undefined) return null;

  const categories = [];
  const byId = new Map();

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    const cells = parseCsvLine(line);
    const categoryLabel = (cells[headerIndex.category] || "").trim();
    const item = rowToItem(cells, headerIndex);
    if (!item) continue;

    const label = categoryLabel || "Catalog";
    const id = slugifyCategory(label);
    if (!byId.has(id)) {
      const category = { id, label, items: [] };
      byId.set(id, category);
      categories.push(category);
    }
    byId.get(id).items.push(item);
  }

  return categories.length ? categories : null;
}

module.exports = { CSV_PATH, loadCatalogFromCsv, parseCsvLine };