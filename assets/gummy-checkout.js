(function () {
  // Always use same-origin — avoids broken checkout when the page host differs from SITE_URL.
  const API_BASE = "";
  const MONEY = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
  let pricing = null;
  let currentOrderId = null;

  const fields = {
    businessName: document.querySelector("#businessName"),
    fullName: document.querySelector("#fullName"),
    email: document.querySelector("#email"),
    phone: document.querySelector("#phone"),
    address: document.querySelector("#address"),
    gummyIndividual: document.querySelector("#gummyIndividual"),
    mixedCartons: document.querySelector("#mixedCartons"),
    flavours: document.querySelector("#flavours"),
  };

  const totals = {
    subtotal: document.querySelector("#subtotal"),
    gst: document.querySelector("#gst"),
    shipping: document.querySelector("#shipping"),
    total: document.querySelector("#total"),
    note: document.querySelector("#pricingNote"),
  };

  const form = document.querySelector("#gummyCheckoutForm");
  const paypalContainer = document.querySelector("#paypalButtons");
  const paypalNote = document.querySelector("#paypalNote");
  const successModal = document.querySelector("#checkoutSuccess");
  const closeSuccess = document.querySelector("#closeCheckoutSuccess");
  const pricingHint = document.querySelector("#pricingHint");
  const customQtyPanel = document.querySelector("#customQtyPanel");
  const flavourPicks = document.querySelector("#flavourPicks");
  const packRadios = document.querySelectorAll('input[name="packPreset"]');

  const PACK_PRESETS = {
    "units-6": { gummyIndividual: 6, mixedCartons: 0 },
    "units-12": { gummyIndividual: 12, mixedCartons: 0 },
    "cartons-1": { gummyIndividual: 0, mixedCartons: 1 },
    custom: null,
  };

  function money(value) {
    return MONEY.format(value);
  }

  function quantity(el) {
    return Math.max(0, Number.parseInt(el?.value || "0", 10));
  }

  function selectedPack() {
    return document.querySelector('input[name="packPreset"]:checked')?.value || "units-6";
  }

  function individualUnitRate(quantity) {
    const minUnits = pricing.bulk?.minUnits || 6;
    if (quantity >= minUnits) return pricing.bulk.wholesalePerUnit;
    return pricing.individual.wholesale;
  }

  function totalsFromCounts(gummyIndividual, mixedCartons) {
    const subtotal = Math.round(
      (gummyIndividual * individualUnitRate(gummyIndividual) +
        mixedCartons * pricing.mixedCarton.cartonSubtotal) *
        100,
    ) / 100;
    const gst = Math.round(subtotal * pricing.gstRate * 100) / 100;
    const shipping = subtotal > 0 ? pricing.shipping : 0;
    const total = Math.round((subtotal + gst + shipping) * 100) / 100;
    return { subtotal, gst, shipping, total };
  }

  function updatePricingCallout() {
    const el = document.querySelector("#gummyPricingCallout");
    if (!el || !pricing) return;
    const regular = pricing.individual.wholesale.toFixed(2);
    const bulk = pricing.bulk.wholesalePerUnit.toFixed(2);
    const carton = pricing.mixedCarton.wholesalePerUnit.toFixed(2);
    const maxSave = pricing.mixedCarton.savingsPerUnit.toFixed(2);
    el.innerHTML = `$${regular} each · <strong>$${bulk}</strong> on ${pricing.bulk.minUnits}+ pouches · <strong>$${carton}</strong> on mixed cartons. <span class="gummy-savings-badge">Save up to $${maxSave} per unit</span>`;
  }

  function updatePackPriceLabels() {
    if (!pricing) return;
    const el6 = document.querySelector("#packPrice6");
    const el12 = document.querySelector("#packPrice12");
    const elCarton = document.querySelector("#packPriceCarton");
    if (el6) el6.textContent = `${money(totalsFromCounts(6, 0).total)} inc`;
    if (el12) el12.textContent = `${money(totalsFromCounts(12, 0).total)} inc`;
    if (elCarton) elCarton.textContent = `${money(totalsFromCounts(0, 1).total)} inc`;
  }

  function syncFlavoursFromPicks() {
    const selected = [...flavourPicks.querySelectorAll('input[type="checkbox"]:checked')].map(
      (el) => el.value,
    );
    if (fields.flavours) {
      fields.flavours.value = selected.join(", ");
    }
    return selected;
  }

  function applyPackPreset(packKey) {
    const preset = PACK_PRESETS[packKey];
    const isCustom = packKey === "custom";

    if (customQtyPanel) customQtyPanel.hidden = !isCustom;

    if (isCustom) {
      calculateLocal();
      return;
    }

    if (preset && fields.gummyIndividual && fields.mixedCartons) {
      fields.gummyIndividual.value = preset.gummyIndividual;
      fields.mixedCartons.value = preset.mixedCartons;
    }

    if (packKey === "cartons-1" && flavourPicks) {
      flavourPicks.querySelectorAll('input[type="checkbox"]').forEach((el) => {
        el.checked = true;
        el.disabled = true;
      });
    } else if (flavourPicks) {
      flavourPicks.querySelectorAll('input[type="checkbox"]').forEach((el) => {
        el.disabled = false;
      });
    }

    syncFlavoursFromPicks();
    calculateLocal();
  }

  function calculateLocal() {
    if (!pricing) return null;

    const pack = selectedPack();
    let gummyIndividual;
    let mixedCartons;

    if (pack === "custom") {
      gummyIndividual = quantity(fields.gummyIndividual);
      mixedCartons = quantity(fields.mixedCartons);
    } else {
      const preset = PACK_PRESETS[pack] || PACK_PRESETS["units-6"];
      gummyIndividual = preset.gummyIndividual;
      mixedCartons = preset.mixedCartons;
    }

    const { subtotal, gst, shipping, total } = totalsFromCounts(gummyIndividual, mixedCartons);

    totals.subtotal.textContent = money(subtotal);
    totals.gst.textContent = money(gst);
    totals.shipping.textContent = money(shipping);
    totals.total.textContent = money(total);
    const minBulk = pricing.bulk?.minUnits || 6;
    totals.note.textContent =
      subtotal > 0
        ? mixedCartons > 0
          ? `Mixed carton rate ($${pricing.mixedCarton.wholesalePerUnit.toFixed(2)}/unit ex GST) applied — save $${pricing.mixedCarton.savingsPerUnit.toFixed(2)} vs $${pricing.individual.wholesale.toFixed(2)}.`
          : gummyIndividual >= minBulk
            ? `Bulk rate ($${pricing.bulk.wholesalePerUnit.toFixed(2)}/unit ex GST) applied — save $${pricing.bulk.savingsPerUnit.toFixed(2)} vs $${pricing.individual.wholesale.toFixed(2)}.`
            : `Standard rate ($${pricing.individual.wholesale.toFixed(2)}/unit ex GST) — order ${minBulk}+ for $${pricing.bulk.wholesalePerUnit.toFixed(2)}/unit.`
        : "Select a pack or add a custom quantity.";

    return { gummyIndividual, mixedCartons, subtotal, gst, shipping, total };
  }

  function selectPackPreset(packKey) {
    const radio = document.querySelector(`input[name="packPreset"][value="${packKey}"]`);
    if (radio) radio.checked = true;
    applyPackPreset(packKey);
  }

  function applyUrlPreset() {
    const params = new URLSearchParams(window.location.search);
    const store = params.get("store");
    if (store && fields.businessName) {
      fields.businessName.value = store;
    }
    const units = params.get("units");
    const cartons = params.get("cartons");
    if (cartons != null) {
      selectPackPreset("cartons-1");
      return;
    }
    if (units === "12") {
      selectPackPreset("units-12");
      return;
    }
    if (units === "6") {
      selectPackPreset("units-6");
      return;
    }
    if (units != null) {
      if (fields.gummyIndividual) {
        fields.gummyIndividual.value = Math.max(0, Number.parseInt(units, 10) || 0);
      }
      selectPackPreset("custom");
    }
  }

  function orderPayload() {
    const calc = calculateLocal();
    return {
      gummyIndividual: calc?.gummyIndividual || 0,
      mixedCartons: calc?.mixedCartons || 0,
      flavours: fields.flavours?.value || "",
      termsAccepted: Boolean(document.querySelector("#gummyTermsAccepted")?.checked),
      contact: {
        businessName: fields.businessName?.value || "",
        fullName: fields.fullName?.value || "",
        email: fields.email?.value || "",
        phone: fields.phone?.value || "",
        address: fields.address?.value || "",
      },
    };
  }

  async function api(path, options = {}) {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function showSuccess() {
    if (successModal) successModal.hidden = false;
  }

  function loadPayPalScript(clientId, sdkBaseUrl) {
    return new Promise((resolve, reject) => {
      if (window.paypal) {
        resolve();
        return;
      }
      const base = sdkBaseUrl || "https://www.paypal.com";
      const script = document.createElement("script");
      script.src = `${base}/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=AUD&intent=capture&components=buttons&enable-funding=card,venmo&disable-funding=paylater`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function setupPayPal() {
    if (!paypalContainer) return;

    try {
      const config = await api("/api/public/gummy-checkout/paypal-config");
      if (!config.enabled) {
        if (paypalNote) {
          paypalNote.textContent =
            "PayPal not configured locally — selection and totals still work. Add PAYPAL_CLIENT_ID on Render for live pay.";
        }
        return;
      }

      await loadPayPalScript(config.clientId, config.sdkBaseUrl);
      const modeLabel = config.mode === "live" ? "PayPal" : "PayPal sandbox (test)";
      if (paypalNote) paypalNote.textContent = `Pay securely with ${modeLabel}. No password or portal login needed.`;

      paypalContainer.innerHTML = "";
      window.paypal
        .Buttons({
          style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
          createOrder: async () => {
            if (!form.reportValidity()) throw new Error("Complete your store details first");
            if (!document.querySelector("#gummyTermsAccepted")?.checked) {
              throw new Error("Agree to the Wholesale Terms & Conditions first");
            }
            const flavours = syncFlavoursFromPicks();
            if (!flavours.length) throw new Error("Select at least one flavour");
            const calc = calculateLocal();
            if (!calc || calc.total <= 0) throw new Error("Select a pack with at least one product");

            const orderData = await api("/api/public/gummy-checkout/orders", {
              method: "POST",
              body: JSON.stringify(orderPayload()),
            });
            currentOrderId = orderData.order.id;

            const pp = await api("/api/public/gummy-checkout/paypal/create", {
              method: "POST",
              body: JSON.stringify({ orderId: currentOrderId }),
            });
            return pp.paypalOrderId;
          },
          onApprove: async (data) => {
            await api("/api/public/gummy-checkout/paypal/capture", {
              method: "POST",
              body: JSON.stringify({
                orderId: currentOrderId,
                paypalOrderId: data.orderID,
              }),
            });
            showSuccess();
          },
          onCancel: () => {
            if (totals.note) totals.note.textContent = "Payment cancelled — you can try again when ready.";
          },
          onError: (err) => {
            const msg = err?.message || "PayPal checkout failed";
            if (totals.note) {
              totals.note.textContent = `${msg}. Fill all store fields, tick terms, and ensure the total is above $0.`;
            }
            console.error("PayPal checkout error:", err);
          },
        })
        .render(paypalContainer);
    } catch (err) {
      console.error("PayPal setup failed:", err);
      if (paypalNote) paypalNote.textContent = "PayPal unavailable — email info@leaflock.com.au";
    }
  }

  function applyEmbedMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("embed") !== "1") return;
    document.body.dataset.embed = "1";
    document.body.classList.add("gummy-checkout-page--embed");
  }

  async function boot() {
    applyEmbedMode();
    try {
      pricing = await api("/api/public/gummy-checkout/pricing");
      updatePackPriceLabels();
      updatePricingCallout();
      if (pricingHint) {
        pricingHint.textContent = `Ex GST · $${pricing.shipping} shipping · 10% GST on subtotal`;
      }
    } catch (err) {
      if (pricingHint) pricingHint.textContent = "Could not load pricing.";
      console.error(err);
    }

    packRadios.forEach((radio) => {
      radio.addEventListener("change", () => applyPackPreset(radio.value));
    });

    flavourPicks?.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.addEventListener("change", () => {
        syncFlavoursFromPicks();
        if (!syncFlavoursFromPicks().length) {
          totals.note.textContent = "Select at least one flavour.";
        } else {
          calculateLocal();
        }
      });
    });

    document.querySelectorAll("#gummyCheckoutForm input:not([name='packPreset']), #gummyCheckoutForm textarea").forEach((el) => {
      el.addEventListener("input", calculateLocal);
      el.addEventListener("change", calculateLocal);
    });

    closeSuccess?.addEventListener("click", () => {
      if (successModal) successModal.hidden = true;
    });

    if (window.location.search) {
      applyUrlPreset();
    } else {
      selectPackPreset("units-6");
    }
    syncFlavoursFromPicks();

    await setupPayPal();
  }

  boot();
})();