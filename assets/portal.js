(function () {
  const MONEY = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
  let pricing = null;
  let currentOrderId = null;
  let paypalLoaded = false;

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
    pharmacyReg: document.querySelector("#storeReg"),
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
  const formSuccess = document.querySelector("#formSuccess");
  const closeSuccess = document.querySelector("#closeSuccess");
  const paypalContainer = document.querySelector("#paypalButtons");
  const paypalNote = document.querySelector("#paypalNote");

  function money(value) {
    return MONEY.format(value);
  }

  function quantity(el) {
    return Math.max(0, Number.parseInt(el?.value || "0", 10));
  }

  function calculateOrder() {
    if (!pricing || !totals.subtotal) return null;

    if (fields.starterBundle?.checked) {
      const b = pricing.starterBundle;
      totals.subtotal.textContent = money(b.subtotal);
      totals.gst.textContent = money(b.gst);
      totals.shipping.textContent = money(b.shipping);
      totals.total.textContent = money(b.totalIncGstShipping);
      totals.note.textContent = `${b.label} — fixed price inc. GST and shipping.`;
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

    const singlePacks = quantity(fields.singlePacks);
    const threePacks = quantity(fields.threePacks);
    const gummyIndividual = quantity(fields.gummyIndividual);
    const mixedCartons = quantity(fields.mixedCartons);

    const totalHumidityPacks = singlePacks + threePacks * 3;
    const rate =
      totalHumidityPacks >= pricing.humidity.single.volumeThreshold
        ? pricing.humidity.single.volume
        : pricing.humidity.single.wholesale;
    const threeRate =
      rate === pricing.humidity.single.volume
        ? pricing.humidity.threePack.volume
        : pricing.humidity.threePack.wholesale;

    const singlesSubtotal = singlePacks * rate;
    const threePackSubtotal = threePacks * threeRate;
    const gummySubtotal =
      gummyIndividual * pricing.gummy.individual.wholesale +
      mixedCartons * pricing.gummy.mixedCarton.units * pricing.gummy.mixedCarton.wholesalePerUnit;

    const subtotal = singlesSubtotal + threePackSubtotal + gummySubtotal;
    const gst = subtotal * pricing.gstRate;
    const shipping = subtotal > 0 ? pricing.shipping : 0;
    const total = subtotal + gst + shipping;

    const notes = [];
    if (totalHumidityPacks >= pricing.humidity.single.volumeThreshold) {
      notes.push("500+ humidity pack rate applied.");
    }
    if (mixedCartons > 0) notes.push("Mixed carton gummy rate applied.");
    if (!notes.length) {
      notes.push(subtotal > 0 ? "Standard wholesale pricing applied." : "Add products to calculate pricing.");
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

  function renderPricing() {
    if (!pricing) return;
    const p = pricing;

    const humidityCard = document.querySelector("#humidityPricingCard");
    if (humidityCard) {
      humidityCard.innerHTML = `
        <img class="product-card__image" src="assets/products/humidity/white-pharmacy-pack.jpg" alt="LeafLock humidity packs" loading="lazy">
        <span class="product-tag">62% RH</span>
        <h3>LeafLock 62% Humidity Packs</h3>
        <dl>
          <div><dt>Singles</dt><dd>${money(p.humidity.single.wholesale)} + GST <small>(SRP ${money(p.humidity.single.srp)})</small></dd></div>
          <div><dt>3-packs</dt><dd>${money(p.humidity.threePack.wholesale)} + GST <small>(SRP ${money(p.humidity.threePack.srp)})</small></dd></div>
          <div><dt>500+ packs (volume)</dt><dd>${money(p.humidity.single.volume)} + GST / pack</dd></div>
        </dl>`;
    }

    const bundlePanel = document.querySelector("#starterBundlePanel");
    if (bundlePanel) {
      bundlePanel.innerHTML = `
        <div class="bundle-badge">Starter bundle</div>
        <h3>${p.starterBundle.label}</h3>
        <ul>${p.starterBundle.includes.map((i) => `<li>${i}</li>`).join("")}</ul>
        <strong>${money(p.starterBundle.totalIncGstShipping)} total</strong>
        <span>Including GST and shipping</span>`;
    }

    const gummyCard = document.querySelector("#gummyPricingCard");
    if (gummyCard) {
      gummyCard.innerHTML = `
        <span class="product-tag product-tag--new">90g mixes</span>
        <h3>LeafLock DIY Gummy Mix</h3>
        <p>Blue Raspberry, Grape, Strawberry, Create Your Own</p>
        <dl>
          <div><dt>Standard wholesale</dt><dd>${money(p.gummy.individual.wholesale)} + GST each</dd></div>
          <div><dt>Mixed carton (24)</dt><dd>${money(p.gummy.mixedCarton.wholesalePerUnit)} + GST each <small>(6 of each flavour)</small></dd></div>
          <div><dt>Suggested retail</dt><dd>${money(p.gummy.individual.srp)} each</dd></div>
        </dl>`;
    }

    const tableBody = document.querySelector("#pricingTableBody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr><td>Humidity Pack Single</td><td>${money(p.humidity.single.wholesale)}</td><td>${money(p.humidity.single.volume)} on 500+</td><td>${money(p.humidity.single.srp)}</td></tr>
        <tr><td>Humidity Pack 3-pack</td><td>${money(p.humidity.threePack.wholesale)}</td><td>Volume on 500+ total packs</td><td>${money(p.humidity.threePack.srp)}</td></tr>
        <tr><td>DIY Gummy Mix 90g</td><td>${money(p.gummy.individual.wholesale)}</td><td>${money(p.gummy.mixedCarton.wholesalePerUnit)} mixed carton of 24</td><td>${money(p.gummy.individual.srp)}</td></tr>`;
    }

    const bundleLabel = document.querySelector("#starterBundleLabel");
    if (bundleLabel) {
      bundleLabel.textContent = `${p.starterBundle.label} (${money(p.starterBundle.totalIncGstShipping)} inc. GST & shipping)`;
    }
  }

  function prefillFromSession() {
    const pharmacy = window.LeafLockAccess?.pharmacy?.();
    if (!pharmacy) return;
    if (fields.businessName && !fields.businessName.value) fields.businessName.value = pharmacy.businessName || "";
    if (fields.email && !fields.email.value) fields.email.value = pharmacy.email || "";
  }

  async function loadPricing() {
    if (!window.LeafLockAccess?.isApproved()) return;
    try {
      pricing = await window.LeafLockAccess.portalFetch("/api/pricing");
      renderPricing();
      prefillFromSession();
      calculateOrder();
    } catch (err) {
      console.error("Could not load pricing:", err);
    }
  }

  function orderPayload(paymentMethod) {
    const calc = calculateOrder();
    return {
      paymentMethod: paymentMethod || "invoice",
      singlePacks: calc?.singlePacks ?? 0,
      threePacks: calc?.threePacks ?? 0,
      gummyIndividual: calc?.gummyIndividual ?? 0,
      mixedCartons: calc?.mixedCartons ?? 0,
      starterBundle: calc?.starterBundle ?? false,
      flavours: fields.flavours?.value || "",
      notes: fields.notes?.value || "",
      contact: {
        businessName: fields.businessName?.value || "",
        fullName: fields.fullName?.value || "",
        role: fields.role?.value || "",
        abn: fields.abn?.value || "",
        pharmacyReg: fields.pharmacyReg?.value || "",
        email: fields.email?.value || "",
        phone: fields.phone?.value || "",
        address: fields.address?.value || "",
      },
    };
  }

  function showSuccess(message) {
    const msg = formSuccess?.querySelector("p");
    if (msg) msg.textContent = message;
    if (formSuccess) {
      formSuccess.hidden = false;
      document.body.style.overflow = "hidden";
    }
  }

  function closeSuccessModal() {
    if (formSuccess) formSuccess.hidden = true;
    document.body.style.overflow = "";
  }

  async function submitInvoiceOrder(event) {
    event.preventDefault();
    if (!window.LeafLockAccess?.isApproved()) return;
    if (!orderForm.reportValidity()) return;

    const calc = calculateOrder();
    if (!calc || calc.total <= 0) {
      totals.note.textContent = "Add at least one product before submitting.";
      return;
    }

    const btn = orderForm.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting…";
    }

    try {
      const data = await window.LeafLockAccess.portalFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify(orderPayload("invoice")),
      });
      currentOrderId = data.order.id;
      showSuccess(
        "We've received your order and will email a confirmation + invoice within 24 hours.",
      );
    } catch (err) {
      totals.note.textContent = err.message || "Could not submit order. Try again.";
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit wholesale order (invoice)";
      }
    }
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
    if (!paypalContainer || !window.LeafLockAccess?.isApproved()) return;

    try {
      const config = await window.LeafLockAccess.portalFetch("/api/paypal/config");
      if (!config.enabled) {
        if (paypalNote) {
          paypalNote.textContent = "Instant PayPal checkout will appear here once configured on the server.";
        }
        return;
      }

      await loadPayPalScript(config.clientId, config.sdkBaseUrl);
      paypalLoaded = true;
      const modeLabel = config.mode === "live" ? "PayPal" : "PayPal (sandbox test)";
      if (paypalNote) {
        paypalNote.textContent = `Pay instantly with ${modeLabel}, or submit for invoice.`;
      }

      paypalContainer.innerHTML = "";
      window.paypal
        .Buttons({
          style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
          createOrder: async () => {
            if (!orderForm.reportValidity()) throw new Error("Complete retail store details first");
            const calc = calculateOrder();
            if (!calc || calc.total <= 0) throw new Error("Add products to your order first");

            const orderData = await window.LeafLockAccess.portalFetch("/api/orders", {
              method: "POST",
              body: JSON.stringify(orderPayload("paypal")),
            });
            currentOrderId = orderData.order.id;

            const pp = await window.LeafLockAccess.portalFetch("/api/paypal/create-order", {
              method: "POST",
              body: JSON.stringify({ orderId: currentOrderId }),
            });
            return pp.paypalOrderId;
          },
          onApprove: async (data) => {
            await window.LeafLockAccess.portalFetch("/api/paypal/capture-order", {
              method: "POST",
              body: JSON.stringify({
                orderId: currentOrderId,
                paypalOrderId: data.orderID,
              }),
            });
            showSuccess("Payment received! We will confirm your order and arrange shipping shortly.");
          },
          onError: () => {
            totals.note.textContent = "PayPal checkout failed. Try again or submit for invoice.";
          },
        })
        .render(paypalContainer);
    } catch (err) {
      console.error("PayPal setup failed:", err);
      if (paypalNote) paypalNote.textContent = "PayPal unavailable — use invoice order instead.";
    }
  }

  function bindInputs() {
    document.querySelectorAll("#gatedContent input, #gatedContent textarea").forEach((input) => {
      input.addEventListener("input", calculateOrder);
      input.addEventListener("change", calculateOrder);
    });
  }

  async function loadCredentials() {
    const list = document.querySelector("#credentialBadgeList");
    const company = document.querySelector("#complianceCompany");
    if (!list) return;
    try {
      const data = await window.LeafLockAccess.portalFetch("/api/portal/credentials");
      const tm = data.trademark || {};
      const classes = (tm.classes || [])
        .map((c) => `<li><strong>Class ${c.class}</strong> — ${c.description}</li>`)
        .join("");
      const onFile = (data.onFile || [])
        .map(
          (c) =>
            `<li class="credential-badge${c.verified ? "" : " credential-badge--muted"}">
              <span class="credential-badge-mark" aria-hidden="true">${c.verified ? "✓" : "·"}</span>
              <span class="credential-badge-text"><strong>${c.label}</strong> — ${c.status}</span>
            </li>`,
        )
        .join("");

      if (company) {
        company.innerHTML = [
          `<strong>${data.company || "LeafLock & Co Pty Ltd"}</strong>`,
          data.acn ? `ACN ${data.acn}` : "",
          tm.mark || "LeafLock™",
          tm.number ? `Trade Mark No. ${tm.number}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
      }

      list.innerHTML = `
        <li class="credential-public-block">
          <p class="credential-public-block-title">${tm.mark || "LeafLock™"} — Registered Australian trade mark</p>
          ${tm.headline ? `<p class="credential-public-block-copy">${tm.headline}</p>` : ""}
          ${classes ? `<ul class="credential-class-list">${classes}</ul>` : ""}
        </li>
        ${onFile}`;
    } catch {
      list.innerHTML = "";
    }
  }

  async function onPortalReady() {
    await Promise.all([loadPricing(), loadCredentials()]);
    if (!paypalLoaded) await setupPayPal();
  }

  orderForm?.addEventListener("submit", submitInvoiceOrder);
  closeSuccess?.addEventListener("click", closeSuccessModal);
  formSuccess?.addEventListener("click", (e) => {
    if (e.target === formSuccess) closeSuccessModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && formSuccess && !formSuccess.hidden) closeSuccessModal();
  });

  document.addEventListener("leaflock:portal-login", onPortalReady);
  document.addEventListener("leaflock:portal-logout", () => {
    pricing = null;
    currentOrderId = null;
    paypalLoaded = false;
    if (paypalContainer) paypalContainer.innerHTML = "";
  });

  if (formSuccess) formSuccess.hidden = true;
  bindInputs();
})();