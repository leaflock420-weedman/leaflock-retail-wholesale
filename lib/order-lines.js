const { calculateOrder, PRICING } = require("./pricing");
const { getCatalogBySku } = require("./wholesale-catalog");

function money(value) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value || 0);
}

/**
 * Expand a saved order into printable line rows (SKU, name, qty, unit, line total ex GST).
 */
function expandOrderLines(order) {
  const li = order?.lineItems || {};
  const totals = order?.totals || calculateOrder(li);
  const lines = [];

  if (li.starterBundle) {
    lines.push({
      sku: "BUNDLE-STARTER",
      name: PRICING.starterBundle.label,
      qty: 1,
      unitWholesale: totals.subtotal,
      lineTotal: totals.subtotal,
    });
    return lines;
  }

  const catalogLines =
    totals.catalogLines?.length > 0
      ? totals.catalogLines
      : calculateOrder(li).catalogLines || [];

  for (const line of catalogLines) {
    if (!line?.sku || !line.qty) continue;
    lines.push({
      sku: line.sku,
      name: line.name || getCatalogBySku()[line.sku]?.name || line.sku,
      qty: line.qty,
      unitWholesale: line.unitWholesale,
      lineTotal: line.lineTotal,
    });
  }

  const catalog = li.catalog || {};
  const bySku = getCatalogBySku();

  if (li.gummyIndividual > 0) {
    const unit = totals.gummyIndividual
      ? totals.gummyIndividual / li.gummyIndividual
      : PRICING.gummy.individual.wholesale;
    lines.push({
      sku: "GUM-90",
      name: "Gummy mix 90g — individual pouches",
      qty: li.gummyIndividual,
      unitWholesale: unit,
      lineTotal: Math.round(unit * li.gummyIndividual * 100) / 100,
    });
  }

  if (li.mixedCartons > 0) {
    const units = li.mixedCartons * PRICING.gummy.mixedCarton.units;
    const unit = PRICING.gummy.mixedCarton.wholesalePerUnit;
    lines.push({
      sku: "GUM-90-BUN",
      name: `Mixed gummy carton (${PRICING.gummy.mixedCarton.units} units per carton)`,
      qty: li.mixedCartons,
      unitWholesale: unit * PRICING.gummy.mixedCarton.units,
      lineTotal: Math.round(unit * units * li.mixedCartons * 100) / 100,
    });
  }

  if (li.singlePacks > 0 && !catalog["HP-SINGLE"]) {
    const unit =
      li.singlePacks >= PRICING.humidity.single.volumeThreshold
        ? PRICING.humidity.single.volume
        : PRICING.humidity.single.wholesale;
    lines.push({
      sku: "HP-SINGLE",
      name: "2-Way Humidity Pack 62% — single",
      qty: li.singlePacks,
      unitWholesale: unit,
      lineTotal: Math.round(unit * li.singlePacks * 100) / 100,
    });
  }

  if (li.threePacks > 0 && !catalog["HP-3PACK"]) {
    const rate =
      li.singlePacks + li.threePacks * 3 >= PRICING.humidity.single.volumeThreshold
        ? PRICING.humidity.threePack.volume
        : PRICING.humidity.threePack.wholesale;
    lines.push({
      sku: "HP-3PACK",
      name: "2-Way Humidity Pack 62% — 3-pack",
      qty: li.threePacks,
      unitWholesale: rate,
      lineTotal: Math.round(rate * li.threePacks * 100) / 100,
    });
  }

  return lines;
}

module.exports = { expandOrderLines, money };