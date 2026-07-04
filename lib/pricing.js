/** Server-side wholesale pricing — never expose in public HTML. */
const {
  calculateCatalogLines,
  catalogForPortal,
  normalizeCatalogQty,
} = require("./wholesale-catalog");

const GST_RATE = 0.1;
const SHIPPING = 25;

const PRICING = {
  gstRate: GST_RATE,
  shipping: SHIPPING,
  humidity: {
    single: { wholesale: 1.6, volume: 1.45, volumeThreshold: 500, srp: 2.5 },
    threePack: { wholesale: 4.35, volume: 4.05, srp: 7.5 },
  },
  gummy: {
    individual: { wholesale: 15.99, srp: 29.99 },
    bulk: { wholesalePerUnit: 12.99, minUnits: 36 },
    mixedCarton: { units: 24, wholesalePerUnit: 12.99, srp: 29.99 },
  },
  starterBundle: {
    totalIncGstShipping: 687.2,
    subtotal: 602,
    gst: 60.2,
    shipping: 25,
    label: "Starter Retail Store Bundle",
    includes: [
      "50 × single humidity packs",
      "24 × mixed gummy mixes",
    ],
  },
};

function humidityPackRate(totalPacks) {
  const { single } = PRICING.humidity;
  return totalPacks >= single.volumeThreshold ? single.volume : single.wholesale;
}

function gummyIndividualUnitRate(quantity) {
  const { gummy } = PRICING;
  const qty = Math.max(0, Number(quantity) || 0);
  if (qty >= gummy.bulk.minUnits) return gummy.bulk.wholesalePerUnit;
  return gummy.individual.wholesale;
}

function calculateOrder(items) {
  if (items.starterBundle) {
    const b = PRICING.starterBundle;
    return {
      starterBundle: true,
      singlePacks: 50,
      threePacks: 50,
      gummyIndividual: 0,
      mixedCartons: 1,
      catalog: {},
      catalogLines: [],
      subtotal: b.subtotal,
      gst: b.gst,
      shipping: b.shipping,
      total: b.totalIncGstShipping,
      notes: ["Starter bundle applied."],
    };
  }

  const catalogRaw = normalizeCatalogQty(items.catalog);
  const catalog = { ...catalogRaw };

  const singlePacks =
    Math.max(0, Number(items.singlePacks) || 0) + Math.max(0, catalog["HP-SINGLE"] || 0);
  const threePacks =
    Math.max(0, Number(items.threePacks) || 0) + Math.max(0, catalog["HP-3PACK"] || 0);
  delete catalog["HP-SINGLE"];
  delete catalog["HP-3PACK"];

  const gummyIndividual = Math.max(0, Number(items.gummyIndividual) || 0);
  const mixedCartons = Math.max(0, Number(items.mixedCartons) || 0);

  const totalHumidityPacks = singlePacks + threePacks * 3;
  const rate = humidityPackRate(totalHumidityPacks);
  const { humidity, gummy } = PRICING;

  const singlesSubtotal = singlePacks * rate;
  const threeRate =
    rate === humidity.single.volume ? humidity.threePack.volume : humidity.threePack.wholesale;
  const threePackSubtotal = threePacks * threeRate;
  const gummySubtotal =
    gummyIndividual * gummyIndividualUnitRate(gummyIndividual) +
    mixedCartons * gummy.mixedCarton.units * gummy.mixedCarton.wholesalePerUnit;

  const catalogResult = calculateCatalogLines(catalog);

  const subtotal =
    Math.round((singlesSubtotal + threePackSubtotal + gummySubtotal + catalogResult.subtotal) * 100) /
    100;
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const shipping = subtotal > 0 ? SHIPPING : 0;
  const total = Math.round((subtotal + gst + shipping) * 100) / 100;

  const notes = [];
  if (totalHumidityPacks >= humidity.single.volumeThreshold) {
    notes.push("500+ humidity pack rate applied.");
  }
  if (mixedCartons > 0) notes.push("Mixed carton gummy rate applied.");
  if (catalogResult.lines.length > 0) {
    notes.push(`${catalogResult.lines.length} catalogue line(s) included.`);
  }
  if (!notes.length) {
    notes.push(subtotal > 0 ? "Standard wholesale pricing applied." : "Add products to calculate pricing.");
  }

  return {
    starterBundle: false,
    singlePacks,
    threePacks,
    gummyIndividual,
    mixedCartons,
    catalog,
    catalogLines: catalogResult.lines,
    subtotal,
    gst,
    shipping,
    total,
    notes,
  };
}

function calculateGummyOrder(items) {
  const gummyIndividual = Math.max(0, Number(items.gummyIndividual) || 0);
  const mixedCartons = Math.max(0, Number(items.mixedCartons) || 0);
  const { gummy } = PRICING;

  const gummySubtotal =
    gummyIndividual * gummyIndividualUnitRate(gummyIndividual) +
    mixedCartons * gummy.mixedCarton.units * gummy.mixedCarton.wholesalePerUnit;

  const subtotal = Math.round(gummySubtotal * 100) / 100;
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const shipping = subtotal > 0 ? SHIPPING : 0;
  const total = Math.round((subtotal + gst + shipping) * 100) / 100;

  const notes = [];
  if (mixedCartons > 0) notes.push("Mixed carton rate ($12.99/unit) applied.");
  else if (gummyIndividual >= gummy.bulk.minUnits) notes.push("Bulk rate ($12.99/unit) applied on 36+ pouches.");
  if (!notes.length) {
    notes.push(subtotal > 0 ? "Standard gummy mix pricing applied." : "Add gummy mix to calculate pricing.");
  }

  return {
    starterBundle: false,
    singlePacks: 0,
    threePacks: 0,
    gummyIndividual,
    mixedCartons,
    catalog: {},
    catalogLines: [],
    subtotal,
    gst,
    shipping,
    total,
    notes,
  };
}

function gummyPricingPublic() {
  const { gummy, gstRate, shipping } = PRICING;
  const bulkSavingsPerUnit =
    Math.round((gummy.individual.wholesale - gummy.bulk.wholesalePerUnit) * 100) / 100;
  const cartonSavingsPerUnit =
    Math.round((gummy.individual.wholesale - gummy.mixedCarton.wholesalePerUnit) * 100) / 100;
  return {
    individual: gummy.individual,
    bulk: {
      wholesalePerUnit: gummy.bulk.wholesalePerUnit,
      minUnits: gummy.bulk.minUnits,
      savingsPerUnit: bulkSavingsPerUnit,
    },
    mixedCarton: {
      units: gummy.mixedCarton.units,
      wholesalePerUnit: gummy.mixedCarton.wholesalePerUnit,
      cartonSubtotal: gummy.mixedCarton.units * gummy.mixedCarton.wholesalePerUnit,
      savingsPerUnit: cartonSavingsPerUnit,
    },
    gstRate,
    shipping,
  };
}

const { buildOrderSheet } = require("./order-sheet");

function volumeTiersForPortal() {
  const { humidity, gummy } = PRICING;
  return [
    {
      id: "humidity-single",
      product: "Humidity packs — singles",
      standard: humidity.single.wholesale,
      threshold: `${humidity.single.volumeThreshold}+ packs`,
      volumePrice: humidity.single.volume,
      applies: "From $1.60 ea. Drops to $1.45 ea automatically at 500+ singles.",
    },
    {
      id: "gummy-bulk-pouches",
      product: "Gummy mix — individual pouches",
      standard: gummy.individual.wholesale,
      threshold: `${gummy.bulk.minUnits}+ pouches`,
      volumePrice: gummy.bulk.wholesalePerUnit,
      applies: `From $${gummy.individual.wholesale.toFixed(2)} ea. Drops to $${gummy.bulk.wholesalePerUnit.toFixed(2)} ea on ${gummy.bulk.minUnits}+ pouches.`,
    },
    {
      id: "gummy-mixed-carton",
      product: "Gummy mix — mixed carton (24 units)",
      standard: gummy.individual.wholesale,
      threshold: "1 carton",
      volumePrice: gummy.mixedCarton.wholesalePerUnit,
      applies: "Order SKU GUM-90-BUN or ask for mixed carton pricing in notes.",
    },
  ];
}

function pricingForPortal() {
  const base = { ...PRICING, catalog: catalogForPortal() };
  return {
    ...base,
    orderSheet: buildOrderSheet(base),
    volumeTiers: volumeTiersForPortal(),
  };
}

module.exports = {
  PRICING,
  calculateOrder,
  calculateGummyOrder,
  gummyPricingPublic,
  pricingForPortal,
  humidityPackRate,
};