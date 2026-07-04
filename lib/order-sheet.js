const { imageForSku, marginStats } = require("./product-images");
const { WHOLESALE_CATALOG, CATALOG_BY_SKU } = require("./wholesale-catalog");

function enrichItem(item, categoryId, categoryLabel, extra = {}) {
  const wholesale = item.wholesale;
  const rrp = item.rrp;
  const unitBasis = item.unitBasis || (item.isBundle && item.sku === "GUM-90-BUN" ? 24 : null);
  const margin = marginStats(wholesale, rrp, unitBasis);
  const bulk = item.bulkNote || item.note || extra.bulkNote || "";
  const moq = item.moq ?? extra.moq ?? null;

  return {
    sku: item.sku,
    name: item.name,
    categoryId,
    categoryLabel,
    image: item.imageUrl || imageForSku(item.sku, categoryId),
    wholesale,
    rrp,
    marginProfit: margin.profit,
    marginPct: margin.pct,
    bulkNote: bulk,
    moq,
    moqLabel: moq ? String(moq) : "—",
    isBundle: Boolean(item.isBundle),
    orderKey: `catalog:${item.sku}`,
    unitBasis,
  };
}

function buildHumidityRows(pricing) {
  const h = pricing.humidity;
  return [
    enrichItem(
      {
        sku: "HP-SINGLE",
        name: "2-Way Humidity Pack 62% — single (retail)",
        wholesale: h.single.wholesale,
        rrp: h.single.srp,
        bulkNote: `$${h.single.volume.toFixed(2)} ea on ${h.single.volumeThreshold}+ packs`,
        moq: null,
      },
      "humidity",
      "Humidity control 62%",
      { moq: null },
    ),
  ];
}

function buildOrderSheet(pricing) {
  const sections = [];

  sections.push({
    id: "humidity",
    label: "Humidity control 62%",
    items: buildHumidityRows(pricing),
  });

  for (const category of WHOLESALE_CATALOG) {
    const items = category.items
      .filter((item) => item.sku !== "HP-SINGLE" && item.sku !== "HP-3PACK")
      .map((item) => {
      const moq =
        item.moq ??
        (item.sku === "GUM-90-BUN" ? 1 : item.isBundle && item.sku === "PEND-BUNDLE-10" ? 1 : null);
      const bulkNote =
        item.bulkNote ||
        item.note ||
        (item.sku === "GUM-90-BUN" ? "Carton of 24 · $12.99/unit" : "");
      return enrichItem({ ...item, moq, bulkNote }, category.id, category.label);
    });
    if (!items.length) continue;
    sections.push({ id: category.id, label: category.label, items });
  }

  return sections;
}

function catalogQtyFromSheet(rawCatalog) {
  const out = {};
  if (!rawCatalog || typeof rawCatalog !== "object") return out;
  for (const [sku, qty] of Object.entries(rawCatalog)) {
    const n = Math.max(0, Math.floor(Number(qty) || 0));
    if (n <= 0) continue;
    if (sku === "HP-SINGLE") {
      out[sku] = n;
      continue;
    }
    if (CATALOG_BY_SKU[sku]) out[sku] = n;
  }
  return out;
}

module.exports = { buildOrderSheet, enrichItem, catalogQtyFromSheet };