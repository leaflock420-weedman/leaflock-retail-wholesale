(function () {
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

  function money(value) {
    return MONEY.format(value);
  }

  function quantity(el) {
    return Math.max(0, Number.parseInt(el?.value || "0", 10));
  }

  function calculateLocal() {
    if (!pricing) return null;

    const gummyIndividual = quantity(fields.gummyIndividual);
    const mixedCartons = quantity(fields.mixedCartons);
    const subtotal =
      gummyIndividual * pricing.individual.wholesale +
      mixedCartons * pricing.mixedCarton.cartonSubtotal;
    const gst = subtotal * pricing.gstRate;
    const shipping = subtotal > 0 ? pricing.shipping : 0;
    const total = subtotal + gst + shipping;

    totals.subtotal.textContent = money(subtotal);
    totals.gst.textContent = money(gst);
    totals.shipping.textContent = money(shipping);
    totals.total.textContent = money(total);
    totals.note.textContent =
      subtotal > 0
        ? mixedCartons > 0
          ? "Mixed carton wholesale rate applied."
          : "Gummy mix wholesale pricing applied."
        : "Add gummy mix to see your total.";

    return { gummyIndividual, mixedCartons, subtotal, gst, shipping, total };
  }

  function applyUrlPreset() {
    const params = new URLSearchParams(window.location.search);
    const units = params.get("units");
    const cartons = params.get("cartons");
    if (units != null && fields.gummyIndividual) {
      fields.gummyIndividual.value = Math.max(0, Number.parseInt(units, 10) || 0);
    }
    if (cartons != null && fields.mixedCartons) {
      fields.mixedCartons.value = Math.max(0, Number.parseInt(cartons, 10) || 0);
    }
  }

  function orderPayload() {
    return {
      gummyIndividual: quantity(fields.gummyIndividual),
      mixedCartons: quantity(fields.mixedCartons),
      flavours: fields.flavours?.value || "",
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
    const res = await fetch(path, {
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
      script.src = `${base}/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=AUD&intent=capture`;
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
          paypalNote.textContent = "PayPal is not configured yet — email info@leaflock.com.au to complete your order.";
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
            const calc = calculateLocal();
            if (!calc || calc.total <= 0) throw new Error("Add at least one gummy mix product");

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
          onError: () => {
            totals.note.textContent = "PayPal checkout failed. Check your details and try again.";
          },
        })
        .render(paypalContainer);
    } catch (err) {
      console.error("PayPal setup failed:", err);
      if (paypalNote) paypalNote.textContent = "PayPal unavailable — email info@leaflock.com.au";
    }
  }

  async function boot() {
    try {
      pricing = await api("/api/public/gummy-checkout/pricing");
      if (pricingHint) {
        pricingHint.textContent = `$${pricing.individual.wholesale.toFixed(2)} ex GST per pouch · $${pricing.mixedCarton.cartonSubtotal.toFixed(2)} ex GST per mixed carton (24) · $${pricing.shipping} shipping · GST on subtotal`;
      }
    } catch (err) {
      if (pricingHint) pricingHint.textContent = "Could not load pricing.";
      console.error(err);
    }

    applyUrlPreset();
    calculateLocal();

    document.querySelectorAll("#gummyCheckoutForm input, #gummyCheckoutForm textarea").forEach((el) => {
      el.addEventListener("input", calculateLocal);
      el.addEventListener("change", calculateLocal);
    });

    closeSuccess?.addEventListener("click", () => {
      if (successModal) successModal.hidden = true;
    });

    await setupPayPal();
  }

  boot();
})();