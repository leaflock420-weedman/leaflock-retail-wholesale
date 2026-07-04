/** Server-side wholesale pricing — never expose in public HTML. */
const GST_RATE = 0.1;
const SHIPPING = 25;

const PRICING = {
  gstRate: GST_RATE,
  shipping: SHIPPING,
  humidity: {
    single: { wholesale: 1.45, volume: 1.35, volumeThreshold: 500, srp: 2.5 },
    threePack: { wholesale: 4.35, volume: 4.05, srp: 7.5 },
  },
  gummy: {
    individual: { wholesale: 16, srp: 30 },
    mixedCarton: { units: 24, wholesalePerUnit: 13, srp: 30 },
  },
  starterBundle: {
    totalIncGstShipping: 687.2,
    subtotal: 602,
    gst: 60.2,
    shipping: 25,
    label: "Starter Retail Bundle",
    includes: [
      "50 × single humidity packs",
      "50 × 3-pack humidity packs",
      "24 × mixed gummy mixes",
    ],
  },
};

function humidityPackRate(totalPacks) {
  const { single } = PRICING.humidity;
  return totalPacks >= single.volumeThreshold ? single.volume : single.wholesale;
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
      subtotal: b.subtotal,
      gst: b.gst,
      shipping: b.shipping,
      total: b.totalIncGstShipping,
      notes: ["Starter bundle applied."],
    };
  }

  const singlePacks = Math.max(0, Number(items.singlePacks) || 0);
  const threePacks = Math.max(0, Number(items.threePacks) || 0);
  const gummyIndividual = Math.max(0, Number(items.gummyIndividual) || 0);
  const mixedCartons = Math.max(0, Number(items.mixedCartons) || 0);

  const totalHumidityPacks = singlePacks + threePacks * 3;
  const rate = humidityPackRate(totalHumidityPacks);
  const { humidity, gummy } = PRICING;

  const singlesSubtotal = singlePacks * rate;
  const threeRate = rate === humidity.single.volume ? humidity.threePack.volume : humidity.threePack.wholesale;
  const threePackSubtotal = threePacks * threeRate;
  const gummySubtotal =
    gummyIndividual * gummy.individual.wholesale +
    mixedCartons * gummy.mixedCarton.units * gummy.mixedCarton.wholesalePerUnit;

  const subtotal = singlesSubtotal + threePackSubtotal + gummySubtotal;
  const gst = subtotal * GST_RATE;
  const shipping = subtotal > 0 ? SHIPPING : 0;
  const total = subtotal + gst + shipping;

  const notes = [];
  if (totalHumidityPacks >= humidity.single.volumeThreshold) {
    notes.push("500+ humidity pack rate applied.");
  }
  if (mixedCartons > 0) notes.push("Mixed carton gummy rate applied.");
  if (!notes.length) {
    notes.push(subtotal > 0 ? "Standard wholesale pricing applied." : "Add products to calculate pricing.");
  }

  return {
    starterBundle: false,
    singlePacks,
    threePacks,
    gummyIndividual,
    mixedCartons,
    subtotal,
    gst,
    shipping,
    total,
    notes,
  };
}

function pricingForPortal() {
  return PRICING;
}

module.exports = { PRICING, calculateOrder, pricingForPortal, humidityPackRate };