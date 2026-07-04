const WHOLESALE_EMAIL = "med@leaflock.com.au";
const GST_RATE = 0.1;
const SHIPPING = 25;
const STARTER_BUNDLE_TOTAL = 687.2;
const MONEY = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

const fields = {
  singlePacks: document.querySelector("#singlePacks"),
  threePacks: document.querySelector("#threePacks"),
  gummyIndividual: document.querySelector("#gummyIndividual"),
  mixedCartons: document.querySelector("#mixedCartons"),
  starterBundle: document.querySelector("#starterBundle"),
  businessName: document.querySelector("#businessName"),
  fullName: document.querySelector("#fullName"),
  role: document.querySelector("#role"),
  abn: document.querySelector("#abn"),
  pharmacyReg: document.querySelector("#pharmacyReg"),
  email: document.querySelector("#email"),
  phone: document.querySelector("#phone"),
  address: document.querySelector("#address"),
  flavours: document.querySelector("#flavours"),
  notes: document.querySelector("#notes"),
};

const totals = {
  subtotal: document.querySelector("#subtotal"),
  gst: document.querySelector("#gst"),
  shipping: document.querySelector("#shipping"),
  total: document.querySelector("#total"),
  note: document.querySelector("#pricingNote"),
};

const orderForm = document.querySelector("#orderForm");
const accountLink = document.querySelector("#accountLink");
const formSuccess = document.querySelector("#formSuccess");
const closeSuccess = document.querySelector("#closeSuccess");

function quantity(el) {
  return Math.max(0, Number.parseInt(el?.value || "0", 10));
}

function money(value) {
  return MONEY.format(value);
}

function calculateOrder() {
  if (fields.starterBundle?.checked) {
    totals.subtotal.textContent = money(602);
    totals.gst.textContent = money(60.2);
    totals.shipping.textContent = money(25);
    totals.total.textContent = money(STARTER_BUNDLE_TOTAL);
    totals.note.textContent = "Starter Pharmacy Bundle — fixed price inc. GST and shipping.";
    return {
      starterBundle: true,
      singlePacks: 50,
      threePacks: 50,
      gummyIndividual: 0,
      mixedCartons: 1,
      subtotal: 602,
      gst: 60.2,
      shipping: 25,
      total: STARTER_BUNDLE_TOTAL,
      notes: ["Starter Pharmacy Bundle applied."],
    };
  }

  const singlePacks = quantity(fields.singlePacks);
  const threePacks = quantity(fields.threePacks);
  const gummyIndividual = quantity(fields.gummyIndividual);
  const mixedCartons = quantity(fields.mixedCartons);

  const totalHumidityPacks = singlePacks + threePacks * 3;
  const humidityPackRate = totalHumidityPacks >= 500 ? 1.35 : 1.45;
  const singlesSubtotal = singlePacks * humidityPackRate;
  const threePackSubtotal = threePacks * (humidityPackRate === 1.35 ? 4.05 : 4.35);

  const gummySubtotal = gummyIndividual * 16 + mixedCartons * 24 * 13;

  const subtotal = singlesSubtotal + threePackSubtotal + gummySubtotal;
  const gst = subtotal * GST_RATE;
  const shipping = subtotal > 0 ? SHIPPING : 0;
  const total = subtotal + gst + shipping;

  const notes = [];
  if (totalHumidityPacks >= 500) notes.push("500+ humidity pack rate applied.");
  if (mixedCartons > 0) notes.push("Mixed carton gummy rate applied.");
  if (!notes.length) {
    notes.push(subtotal > 0 ? "Standard wholesale pricing applied." : "Add products to calculate wholesale pricing.");
  }

  totals.subtotal.textContent = money(subtotal);
  totals.gst.textContent = money(gst);
  totals.shipping.textContent = money(shipping);
  totals.total.textContent = money(total);
  totals.note.textContent = notes.join(" ");

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

function buildOrderEmail(order) {
  const lines = [
    "=== LEAFLOCK WHOLESALE ORDER ===",
    "",
    "PHARMACY DETAILS",
    `Business: ${fields.businessName?.value || "—"}`,
    `Contact: ${fields.fullName?.value || "—"}`,
    `Role: ${fields.role?.value || "—"}`,
    `ABN: ${fields.abn?.value || "—"}`,
    `Pharmacy Reg: ${fields.pharmacyReg?.value || "—"}`,
    `Email: ${fields.email?.value || "—"}`,
    `Phone: ${fields.phone?.value || "—"}`,
    `Address: ${fields.address?.value || "—"}`,
    "",
    "ORDER",
    `Starter bundle: ${order.starterBundle ? "YES" : "No"}`,
    `Single humidity packs: ${order.singlePacks}`,
    `3-pack humidity packs: ${order.threePacks}`,
    `Gummy mix (individual): ${order.gummyIndividual}`,
    `Mixed cartons (24): ${order.mixedCartons}`,
    `Flavours: ${fields.flavours?.value || "—"}`,
    "",
    `Subtotal ex GST: ${money(order.subtotal)}`,
    `GST: ${money(order.gst)}`,
    `Shipping: ${money(order.shipping)}`,
    `Total inc GST: ${money(order.total)}`,
    "",
    "NOTES",
    fields.notes?.value || "—",
    "",
    `Pricing: ${order.notes.join(" ")}`,
  ];
  return lines.join("\n");
}

function updateAccountLink() {
  const pharmacy = document.querySelector("#accountPharmacy")?.value || "—";
  const email = document.querySelector("#accountEmail")?.value || "—";
  const abn = document.querySelector("#accountAbn")?.value || "—";
  const reg = document.querySelector("#accountReg")?.value || "—";
  const subject = encodeURIComponent("LeafLock pharmacy wholesale account request");
  const body = encodeURIComponent(
    [
      "LeafLock pharmacy wholesale account request",
      "",
      `Pharmacy: ${pharmacy}`,
      `Contact email: ${email}`,
      `ABN: ${abn}`,
      `Pharmacy registration number: ${reg}`,
    ].join("\n"),
  );
  if (accountLink) accountLink.href = `mailto:${WHOLESALE_EMAIL}?subject=${subject}&body=${body}`;
}

function initCharts() {
  if (!window.Chart) return;

  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  Chart.defaults.color = "#5c6963";

  const chartEl = document.getElementById("leafLockChart");
  if (!chartEl) return;

  new Chart(chartEl.getContext("2d"), {
    type: "bar",
    data: {
      labels: [
        "Ambient without Pack",
        "Ambient with LeafLock",
        "Refrigerated without Pack",
        "Refrigerated with LeafLock",
      ],
      datasets: [
        {
          label: "Moisture Content (%)",
          data: [12.06, 13.97, 11.94, 13.65],
          backgroundColor: "rgba(255, 99, 132, 0.6)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
          yAxisID: "y",
        },
        {
          label: "D9-THC (mg/g)",
          data: [14.47, 14.77, 11.68, 13.04],
          backgroundColor: "rgba(144, 238, 144, 0.7)",
          borderColor: "rgba(76, 175, 80, 1)",
          borderWidth: 1,
          yAxisID: "y1",
        },
        {
          label: "THCa (mg/g)",
          data: [181.9, 184.1, 183.9, 193.9],
          backgroundColor: "rgba(100, 181, 246, 0.7)",
          borderColor: "rgba(30, 136, 229, 1)",
          borderWidth: 1,
          yAxisID: "y1",
        },
        {
          label: "Total Terpenes (mg/g)",
          data: [0.3478, 0.2513, 0.0115, 0.2948],
          backgroundColor: "rgba(255, 223, 70, 0.7)",
          borderColor: "rgba(251, 192, 45, 1)",
          borderWidth: 1,
          yAxisID: "y2",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: { top: 40 },
      },
      plugins: {
        legend: { position: "bottom" },
        title: {
          display: true,
          text: "LeafLock Impact on Moisture, Cannabinoids, and Terpenes",
          font: { size: 18 },
          padding: { top: 20, bottom: 20 },
        },
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          title: { display: true, text: "Sample Type" },
          grid: { display: false },
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: { display: true, text: "Moisture Content (%)" },
          suggestedMax: 16,
          grid: { color: "#e8efe9" },
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          title: { display: true, text: "Cannabinoid Concentration (mg/g)" },
          grid: { drawOnChartArea: false },
          suggestedMax: 200,
        },
        y2: {
          type: "linear",
          display: true,
          position: "right",
          title: { display: true, text: "Total Terpenes (mg/g)" },
          grid: { drawOnChartArea: false },
          suggestedMax: 0.4,
        },
      },
    },
  });
}

function bindInputs() {
  document.querySelectorAll("input, textarea, select").forEach((input) => {
    input.addEventListener("input", () => {
      calculateOrder();
      updateAccountLink();
    });
    input.addEventListener("change", () => {
      calculateOrder();
      updateAccountLink();
    });
  });
}

orderForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!orderForm.reportValidity()) return;

  const order = calculateOrder();
  const business = fields.businessName?.value || "Pharmacy";
  const subject = encodeURIComponent(`Wholesale Order — ${business}`);
  const body = encodeURIComponent(buildOrderEmail(order));

  window.location.href = `mailto:${WHOLESALE_EMAIL}?subject=${subject}&body=${body}`;

  if (formSuccess) {
    formSuccess.hidden = false;
    document.body.style.overflow = "hidden";
  }
});

function closeSuccessModal() {
  if (formSuccess) formSuccess.hidden = true;
  document.body.style.overflow = "";
}

closeSuccess?.addEventListener("click", closeSuccessModal);

formSuccess?.addEventListener("click", (event) => {
  if (event.target === formSuccess) closeSuccessModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && formSuccess && !formSuccess.hidden) closeSuccessModal();
});

function init() {
  if (formSuccess) formSuccess.hidden = true;

  bindInputs();
  calculateOrder();
  updateAccountLink();
  if (window.Chart) {
    initCharts();
  } else {
    window.addEventListener("load", initCharts);
  }
}

init();