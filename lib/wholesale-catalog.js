/**
 * Wholesale SKU catalog — sourced from LeafLock order form (3 Jul 2026).
 * Humidity packs remain in lib/pricing.js (not on this replenishment sheet).
 */

const WHOLESALE_CATALOG = [
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
    label: "Chop mats / mousepads",
    items: [
      { sku: "CHOP-PURP", name: "Purple Haze Chop Mat", wholesale: 12.99, rrp: 24.99 },
      { sku: "CHOP-RAIN", name: "Rainbow Melts Chop Mat", wholesale: 12.99, rrp: 24.99 },
      { sku: "CHOP-FORB", name: "Forbidden Forest Chop Mat", wholesale: 12.99, rrp: 24.99 },
      { sku: "CHOP-BLUE", name: "Blueberry Blast Chop Mat", wholesale: 12.99, rrp: 24.99 },
      { sku: "CHOP-ORAN", name: "Orange Sherbies Chop Mat", wholesale: 12.99, rrp: 24.99 },
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

const CATALOG_BY_SKU = Object.create(null);
for (const category of WHOLESALE_CATALOG) {
  for (const item of category.items) {
    CATALOG_BY_SKU[item.sku] = { ...item, categoryId: category.id, categoryLabel: category.label };
  }
}

const PORTAL_ORDER_SKUS = new Set(["HP-SINGLE", "HP-3PACK"]);

function normalizeCatalogQty(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [sku, qty] of Object.entries(raw)) {
    const item = CATALOG_BY_SKU[sku];
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
    const item = CATALOG_BY_SKU[sku];
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
  CATALOG_BY_SKU,
  normalizeCatalogQty,
  calculateCatalogLines,
  catalogForPortal,
};