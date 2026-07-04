/**
 * Wholesale SKU catalog — edit data/wholesale-catalog.csv for quick updates.
 * Embedded list below is the fallback if the CSV is missing.
 */
const { loadCatalogFromCsv, catalogReadPath } = require("./catalog-csv");

const EMBEDDED_CATALOG = [
  {
    id: "airFresheners",
    label: "Air fresheners",
    items: [
      { sku: "AF-FORB", name: "Forbidden Forest Air Freshener", wholesale: 4.99, rrp: 9.99 },
      { sku: "AF-BLUE", name: "Blueberry Blast Air Freshener", wholesale: 4.99, rrp: 9.99 },
    ],
  },
  {
    id: "gummyMix",
    label: "Gummy mix 90g",
    items: [
      { sku: "GUM-90-STR", name: "Strawberry 90g Gummy Mix", wholesale: 15.99, rrp: 29.99 },
      { sku: "GUM-90-GRA", name: "Grape 90g Gummy Mix", wholesale: 15.99, rrp: 29.99 },
      { sku: "GUM-90-BLU", name: "Blue Raspberry 90g Gummy Mix", wholesale: 15.99, rrp: 29.99 },
      { sku: "GUM-90-DIY", name: "Create Your Own Flavour 90g Gummy Mix", wholesale: 15.99, rrp: 29.99 },
      {
        sku: "GUM-90-BUN",
        name: "Mixed carton — 6 of each flavour (24 units)",
        wholesale: 311.76,
        rrp: 29.99,
        bulkNote: "$12.99/unit · 24 per carton",
        isBundle: true,
        unitBasis: 24,
        moq: 1,
      },
    ],
  },
  {
    id: "waxWizard30",
    label: "Wax Wizard 30ml",
    items: [
      { sku: "WW-30-BLUE", name: "Blueberry Blast 30ml", wholesale: 49.99, rrp: 99.99 },
      { sku: "WW-30-RAIN", name: "Rainbow Melts 30ml", wholesale: 49.99, rrp: 99.99 },
      { sku: "WW-30-ORAN", name: "Orange Sherbies 30ml", wholesale: 49.99, rrp: 99.99 },
      { sku: "WW-30-BISC", name: "Biscotti 30ml (Limited Edition)", wholesale: 49.99, rrp: 99.99 },
      { sku: "WW-30-LIME", name: "Summer Lime Splice 30ml (Limited)", wholesale: 49.99, rrp: 99.99 },
      { sku: "WW-30-PLAIN", name: "Plain 30ml", wholesale: 49.99, rrp: 99.99 },
    ],
  },
  {
    id: "waxWizard10",
    label: "Wax Wizard 10ml",
    items: [
      { sku: "WW-10-ORAN", name: "Orange Sherbies 10ml", wholesale: 24.99, rrp: 49.99 },
      { sku: "WW-10-BLUE", name: "Blueberry Blast 10ml", wholesale: 24.99, rrp: 49.99 },
      { sku: "WW-10-FORB", name: "Forbidden Forest 10ml", wholesale: 24.99, rrp: 49.99 },
      { sku: "WW-10-BISC", name: "Biscotti 10ml (Limited Edition)", wholesale: 24.99, rrp: 49.99 },
      { sku: "WW-10-LIME", name: "Summer Lime Splice 10ml (Limited)", wholesale: 24.99, rrp: 49.99 },
      { sku: "WW-10-PLAIN", name: "Plain 10ml", wholesale: 24.99, rrp: 49.99 },
    ],
  },
  {
    id: "waxWizard100",
    label: "Wax Wizard 100ml",
    items: [{ sku: "WW-100-PLAIN", name: "Plain 100ml", wholesale: 99.99, rrp: 199.99 }],
  },
  {
    id: "growTools",
    label: "LST tools & grow accessories",
    items: [
      { sku: "BW", name: "Branch Whisperers (6 per pack)", wholesale: 8.5, rrp: 19.99 },
      { sku: "MT-15M", name: "Master Ties 15M", wholesale: 7.5, rrp: 14.99 },
      { sku: "BB-20", name: "Branch Benders (6 per pack)", wholesale: 9.99, rrp: 14.99 },
    ],
  },
  {
    id: "curingBags",
    label: "Curing bags",
    items: [{ sku: "CB-1LB", name: "1 lb Curing Bags", wholesale: 13.0, rrp: 35.0 }],
  },
  {
    id: "chopMats",
    label: "Mousepad / chop mat V2",
    items: [
      {
        sku: "CHOP-PURP",
        name: "Mousepad / Chop Mat V2 — Grandaddy Purple",
        wholesale: 12.99,
        rrp: 19.99,
        bulkNote: "30×25cm · 4mm base · leaflock.com.au",
      },
      {
        sku: "CHOP-RAIN",
        name: "Mousepad / Chop Mat V2 — Rainbow Melts",
        wholesale: 12.99,
        rrp: 19.99,
        bulkNote: "Die-cut ~30cm · leaflock.com.au",
      },
      {
        sku: "CHOP-FORB",
        name: "Mousepad / Chop Mat V2 — Forbidden Forest",
        wholesale: 12.99,
        rrp: 19.99,
        bulkNote: "Die-cut ~30cm · leaflock.com.au",
      },
      {
        sku: "CHOP-BLUE",
        name: "Mousepad / Chop Mat V2 — Blueberry Blast",
        wholesale: 12.99,
        rrp: 19.99,
        bulkNote: "Die-cut ~30cm · leaflock.com.au",
      },
      {
        sku: "CHOP-ORAN",
        name: "Mousepad / Chop Mat V2 — Orange Sherbies",
        wholesale: 12.99,
        rrp: 19.99,
        bulkNote: "Die-cut ~30cm · leaflock.com.au",
      },
    ],
  },
  {
    id: "merch",
    label: "Merch & accessories",
    items: [
      { sku: "CUSHION", name: "Cushion Covers", wholesale: 12.0, rrp: 14.99 },
      { sku: "SNAPBACK", name: "Black & White Embroidered Snapback", wholesale: 18.0, rrp: 39.99 },
      {
        sku: "KEYCHAINS-TEXT",
        name: "Keychains — Logo Pink, Blue, White & Black",
        wholesale: 3.49,
        rrp: 9.99,
      },
      {
        sku: "KEYCHAINS-MONO",
        name: "Keychains — Monogram Pink, Blue, White & Black",
        wholesale: 3.49,
        rrp: 9.99,
      },
      {
        sku: "STICKERS",
        name: "Stickers — Mono & Logo Pink, Blue, White & Black",
        wholesale: 0.75,
        rrp: 2.99,
      },
      {
        sku: "MAGNETS",
        name: "Magnets — Mono & Logo Pink, Blue, White & Black",
        wholesale: 1.6,
        rrp: 4.99,
      },
    ],
  },
  {
    id: "incoming",
    label: "Incoming / pre-order",
    items: [
      {
        sku: "PEND-18K-200",
        name: "18K Gold Plated Pendant + Chain (Black & Pink Limited)",
        wholesale: 40.0,
        rrp: 89.99,
        note: "Limited 100 each colour",
      },
      {
        sku: "PEND-BUNDLE-10",
        name: "Pendant bundle — 5 of each colour (10 units)",
        wholesale: 350.0,
        rrp: 89.99,
        bulkNote: "$35/unit bundle",
        isBundle: true,
        unitBasis: 10,
        moq: 1,
        note: "Ready to ship once paid",
      },
    ],
  },
];

function buildCatalogBySku(catalog) {
  const map = Object.create(null);
  for (const category of catalog) {
    for (const item of category.items) {
      map[item.sku] = { ...item, categoryId: category.id, categoryLabel: category.label };
    }
  }
  return map;
}

function loadActiveCatalog() {
  return loadCatalogFromCsv(catalogReadPath()) || EMBEDDED_CATALOG;
}

let WHOLESALE_CATALOG = loadActiveCatalog();
let CATALOG_BY_SKU = buildCatalogBySku(WHOLESALE_CATALOG);

function reloadCatalog() {
  WHOLESALE_CATALOG = loadActiveCatalog();
  CATALOG_BY_SKU = buildCatalogBySku(WHOLESALE_CATALOG);
  return {
    categories: WHOLESALE_CATALOG.length,
    items: Object.keys(CATALOG_BY_SKU).length,
    source: catalogReadPath(),
  };
}

function getCatalogBySku() {
  return CATALOG_BY_SKU;
}

const PORTAL_ORDER_SKUS = new Set(["HP-SINGLE"]);

function normalizeCatalogQty(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [sku, qty] of Object.entries(raw)) {
    const item = getCatalogBySku()[sku];
    if (!item && !PORTAL_ORDER_SKUS.has(sku)) continue;
    const n = Math.max(0, Math.floor(Number(qty) || 0));
    if (n > 0) out[sku] = n;
  }
  return out;
}

function calculateCatalogLines(catalogQty) {
  const normalized = normalizeCatalogQty(catalogQty);
  const lines = [];
  let subtotal = 0;

  for (const [sku, qty] of Object.entries(normalized)) {
    const item = getCatalogBySku()[sku];
    const lineTotal = Math.round(item.wholesale * qty * 100) / 100;
    subtotal += lineTotal;
    lines.push({
      sku,
      name: item.name,
      qty,
      unitWholesale: item.wholesale,
      lineTotal,
      isBundle: Boolean(item.isBundle),
    });
  }

  return { subtotal: Math.round(subtotal * 100) / 100, lines };
}

function catalogForPortal() {
  return WHOLESALE_CATALOG;
}

module.exports = {
  WHOLESALE_CATALOG,
  EMBEDDED_CATALOG,
  CATALOG_BY_SKU,
  getCatalogBySku,
  normalizeCatalogQty,
  calculateCatalogLines,
  catalogForPortal,
  reloadCatalog,
  loadActiveCatalog,
};