const fs = require("fs");
const path = require("path");
const { DATA_DIR, ensureDataDir } = require("./data-dir");

const BUNDLED_CSV_PATH = path.join(__dirname, "..", "data", "wholesale-catalog.csv");
const CSV_FILENAME = "wholesale-catalog.csv";

const CSV_HEADER =
  "Category,SKU,Product Name,Wholesale ex GST,RRP,MOQ,Bulk/Notes,Image URL,Bundle,Units per bundle,Active";

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

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
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

function parseCatalogCsv(raw) {
  const errors = [];
  const text = String(raw || "").replace(/^\uFEFF/, "").trim();
  if (!text) {
    return { ok: false, errors: ["Spreadsheet is empty."], categories: null, itemCount: 0 };
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) {
    return { ok: false, errors: ["Spreadsheet has no rows."], categories: null, itemCount: 0 };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const headerIndex = Object.fromEntries(header.map((name, idx) => [name, idx]));
  if (headerIndex.sku === undefined) {
    return {
      ok: false,
      errors: ['Missing "SKU" column. Download the template and keep the first row unchanged.'],
      categories: null,
      itemCount: 0,
    };
  }

  const categories = [];
  const byId = new Map();
  const seenSkus = new Set();
  let itemCount = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    const cells = parseCsvLine(line);
    const categoryLabel = (cells[headerIndex.category] || "").trim();
    const item = rowToItem(cells, headerIndex);
    if (!item) continue;

    if (seenSkus.has(item.sku)) {
      errors.push(`Duplicate SKU on row ${i + 1}: ${item.sku}`);
      continue;
    }
    seenSkus.add(item.sku);
    itemCount += 1;

    const label = categoryLabel || "Catalog";
    const id = slugifyCategory(label);
    if (!byId.has(id)) {
      const category = { id, label, items: [] };
      byId.set(id, category);
      categories.push(category);
    }
    byId.get(id).items.push(item);
  }

  if (!itemCount) {
    errors.push("No active products found. Check SKU, prices, and Active column.");
  }

  return {
    ok: errors.length === 0 && itemCount > 0,
    errors,
    categories: itemCount ? categories : null,
    itemCount,
    categoryCount: categories.length,
  };
}

function loadCatalogFromCsv(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const parsed = parseCatalogCsv(fs.readFileSync(filePath, "utf8"));
  return parsed.ok ? parsed.categories : null;
}

function catalogWritePath() {
  ensureDataDir();
  return path.join(DATA_DIR, CSV_FILENAME);
}

function catalogReadPath() {
  const persistent = catalogWritePath();
  if (fs.existsSync(persistent)) return persistent;
  if (fs.existsSync(BUNDLED_CSV_PATH)) return BUNDLED_CSV_PATH;
  return persistent;
}

function catalogSourceLabel() {
  const persistent = catalogWritePath();
  if (fs.existsSync(persistent)) return "uploaded";
  if (fs.existsSync(BUNDLED_CSV_PATH)) return "bundled";
  return "embedded";
}

function readCatalogCsvText() {
  const readPath = catalogReadPath();
  if (fs.existsSync(readPath)) {
    return fs.readFileSync(readPath, "utf8");
  }
  return null;
}

function categoriesToCsv(categories) {
  const rows = [CSV_HEADER];
  for (const cat of categories) {
    for (const item of cat.items) {
      rows.push(
        [
          csvCell(cat.label),
          csvCell(item.sku),
          csvCell(item.name),
          item.wholesale,
          item.rrp,
          item.moq || "",
          csvCell(item.bulkNote || item.note || ""),
          csvCell(item.imageUrl || ""),
          item.isBundle ? "Y" : "",
          item.unitBasis || "",
          "Y",
        ].join(","),
      );
    }
  }
  return `${rows.join("\n")}\n`;
}

function saveCatalogCsv(raw) {
  const parsed = parseCatalogCsv(raw);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const normalized = categoriesToCsv(parsed.categories);
  const writePath = catalogWritePath();
  fs.writeFileSync(writePath, normalized, "utf8");
  return {
    ok: true,
    path: writePath,
    itemCount: parsed.itemCount,
    categoryCount: parsed.categoryCount,
  };
}

module.exports = {
  BUNDLED_CSV_PATH,
  CSV_HEADER,
  CSV_FILENAME,
  catalogReadPath,
  catalogWritePath,
  catalogSourceLabel,
  readCatalogCsvText,
  loadCatalogFromCsv,
  parseCatalogCsv,
  categoriesToCsv,
  saveCatalogCsv,
  parseCsvLine,
};