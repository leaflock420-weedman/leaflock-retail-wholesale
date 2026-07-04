(function () {
  const MONEY = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
  const PCT = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });
  let pricing = null;
  let currentOrderId = null;
  let paypalLoaded = false;
  let sheetSkuIndex = Object.create(null);

  const fields = {
    starterBundle: document.querySelector("#starterBundle"),
    businessName: document.querySelector("#businessName"),
    fullName: document.querySelector("#fullName"),
    role: document.querySelector("#role"),
    abn: document.querySelector("#abn"),
    pharmacyReg: document.querySelector("#storeReg"),
    email: document.querySelector("#email"),
    phone: document.querySelector("#phone"),
    address: document.querySelector("#address"),
    notes: document.querySelector("#notes"),
    termsAccepted: document.querySelector("#termsAccepted"),
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
  const orderSheetBody = document.querySelector("#orderSheetBody");
  const orderSheetSearch = document.querySelector("#orderSheetSearch");
  const orderSheetSummary = document.querySelector("#orderSheetSummary");
  const volumeTierBody = document.querySelector("#volumeTierBody");

  function money(value) {
    return MONEY.format(value);
  }

  function marginLabel(item) {
    return `${money(item.marginProfit)} <small>(${PCT.format(item.marginPct)}%)</small>`;
  }

  function readCatalogQty() {
    const catalog = {};
    document.querySelectorAll("[data-catalog-sku]").forEach((input) => {
      const sku = input.dataset.catalogSku;
      const qty = Math.max(0, Number.parseInt(input.value || "0", 10));
      if (sku && qty > 0) catalog[sku] = qty;
    });
    return catalog;
  }

  function catalogSubtotal(catalog) {
    if (!pricing?.catalog) return { subtotal: 0, lines: [] };
    const bySku = {};
    for (const category of pricing.catalog) {
      for (const item of category.items) {
        bySku[item.sku] = item;
      }
    }

    let subtotal = 0;
    const lines = [];
    for (const [sku, qty] of Object.entries(catalog)) {
      if (sku === "HP-SINGLE") continue;
      const item = bySku[sku];
      if (!item || qty <= 0) continue;
      const lineTotal = Math.round(item.wholesale * qty * 100) / 100;
      subtotal += lineTotal;
      lines.push({ sku, name: item.name, qty, lineTotal });
    }
    return { subtotal: Math.round(subtotal * 100) / 100, lines };
  }

  function humidityRate(singlePacks) {
    if (!pricing) return 0;
    return singlePacks >= pricing.humidity.single.volumeThreshold
      ? pricing.humidity.single.volume
      : pricing.humidity.single.wholesale;
  }

  function humiditySubtotal(singlePacks) {
    if (!pricing || singlePacks <= 0) return 0;
    return Math.round(singlePacks * humidityRate(singlePacks) * 100) / 100;
  }

  function moqWarnings(catalog) {
    const warnings = [];
    for (const [sku, qty] of Object.entries(catalog)) {
      const item = sheetSkuIndex[sku];
      if (item?.moq && qty > 0 && qty < item.moq) {
        warnings.push(`${item.name}: minimum order is ${item.moq} (you have ${qty}).`);
      }
    }
    return warnings;
  }

  function updateLineTotals(subtotalForSummary) {
    const catalog = readCatalogQty();
    document.querySelectorAll("[data-line-total]").forEach((cell) => {
      const sku = cell.dataset.lineTotal;
      const qty = catalog[sku] || 0;
      const item = sheetSkuIndex[sku];
      if (!item || qty <= 0) {
        cell.textContent = "—";
        return;
      }
      let line = 0;
      if (sku === "HP-SINGLE") {
        const singles = catalog["HP-SINGLE"] || 0;
        line = singles * humidityRate(singles);
      } else {
        line = item.wholesale * qty;
      }
      cell.textContent = money(Math.round(line * 100) / 100);
    });

    if (orderSheetSummary && subtotalForSummary !== undefined) {
      const lines = Object.values(catalog).filter((n) => n > 0).length;
      orderSheetSummary.textContent = `${lines} line${lines === 1 ? "" : "s"} · ${money(subtotalForSummary)} ex GST`;
    }
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
      updateLineTotals(b.subtotal);
      return {
        starterBundle: true,
        singlePacks: 50,
        threePacks: 0,
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

    const catalog = readCatalogQty();
    const singlePacks = catalog["HP-SINGLE"] || 0;
    const humidityTotal = humiditySubtotal(singlePacks);
    const catalogTotals = catalogSubtotal(catalog);
    const subtotal = Math.round((humidityTotal + catalogTotals.subtotal) * 100) / 100;
    const gst = Math.round(subtotal * pricing.gstRate * 100) / 100;
    const shipping = subtotal > 0 ? pricing.shipping : 0;
    const total = Math.round((subtotal + gst + shipping) * 100) / 100;

    const notes = [];
    if (singlePacks >= pricing.humidity.single.volumeThreshold) {
      notes.push("500+ humidity pack rate applied.");
    }
    if (catalogTotals.lines.length > 0) {
      notes.push(`${catalogTotals.lines.length} catalogue line(s) in order.`);
    }
    const moqIssues = moqWarnings(catalog);
    if (moqIssues.length) notes.push(...moqIssues);
    if (!notes.length) {
      notes.push(subtotal > 0 ? "Standard wholesale pricing applied." : "Add products to calculate pricing.");
    }

    totals.subtotal.textContent = money(subtotal);
    totals.gst.textContent = money(gst);
    totals.shipping.textContent = money(shipping);
    totals.total.textContent = money(total);
    totals.note.textContent = notes.join(" ");
    updateLineTotals(subtotal);

    return {
      starterBundle: false,
      singlePacks: 0,
      threePacks: 0,
      gummyIndividual: 0,
      mixedCartons: 0,
      catalog,
      catalogLines: catalogTotals.lines,
      subtotal,
      gst,
      shipping,
      total,
      notes,
    };
  }

  function renderOrderSheet() {
    if (!orderSheetBody || !pricing?.orderSheet) return;

    sheetSkuIndex = Object.create(null);
    const rows = [];

    for (const section of pricing.orderSheet) {
      rows.push(
        `<tr class="pricing-table__category"><td colspan="8"><strong>${section.label}</strong></td></tr>`,
      );
      for (const item of section.items) {
        sheetSkuIndex[item.sku] = item;
        const bulk = item.bulkNote || "—";
        const moqMin = item.moq ? item.moq : 0;
        rows.push(`
          <tr class="portal-order-table__row" data-sheet-row data-search="${`${item.sku} ${item.name} ${section.label} ${item.bulkNote || ""}`.toLowerCase()}">
            <td>${item.sku}</td>
            <td class="portal-order-table__product">
              <img src="${item.image}" alt="" width="48" height="48" loading="lazy">
              <span>${item.name}</span>
            </td>
            <td>${money(item.wholesale)}</td>
            <td class="portal-order-table__qty">
              <input type="number" min="${moqMin}" step="1" value="0" data-catalog-sku="${item.sku}" data-moq="${moqMin}" aria-label="Quantity for ${item.name}">
            </td>
            <td>${money(item.rrp)}</td>
            <td>${item.moqLabel}</td>
            <td>${bulk}</td>
            <td class="portal-order-table__line" data-line-total="${item.sku}">—</td>
          </tr>`);
      }
    }

    orderSheetBody.innerHTML = rows.join("");
    orderSheetBody.querySelectorAll("[data-catalog-sku]").forEach((input) => {
      input.addEventListener("input", () => {
        if (fields.starterBundle?.checked) fields.starterBundle.checked = false;
        calculateOrder();
      });
      input.addEventListener("change", calculateOrder);
    });
    calculateOrder();
  }

  function filterOrderSheet(query) {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    document.querySelectorAll("[data-sheet-row]").forEach((row) => {
      const hay = row.getAttribute("data-search") || "";
      row.hidden = q.length > 0 && !hay.includes(q);
    });
    document.querySelectorAll(".pricing-table__category").forEach((row) => {
      let next = row.nextElementSibling;
      let anyVisible = false;
      while (next && !next.classList.contains("pricing-table__category")) {
        if (!next.hidden) anyVisible = true;
        next = next.nextElementSibling;
      }
      row.hidden = q.length > 0 && !anyVisible;
    });
  }

  function renderVolumeTiers() {
    if (!volumeTierBody || !pricing?.volumeTiers) return;
    volumeTierBody.innerHTML = pricing.volumeTiers
      .map(
        (tier) => `
        <tr>
          <td>${tier.product}</td>
          <td>${money(tier.standard)}</td>
          <td>${tier.threshold}</td>
          <td>${money(tier.volumePrice)}</td>
          <td>${tier.applies}</td>
        </tr>`,
      )
      .join("");
  }

  function renderPricing() {
    if (!pricing) return;
    renderOrderSheet();
    renderVolumeTiers();
    const bundleLabel = document.querySelector("#starterBundleLabel");
    if (bundleLabel) {
      bundleLabel.textContent = `${pricing.starterBundle.label} (${money(pricing.starterBundle.totalIncGstShipping)} inc. GST & shipping)`;
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
      singlePacks: 0,
      threePacks: 0,
      gummyIndividual: 0,
      mixedCartons: 0,
      starterBundle: calc?.starterBundle ?? false,
      catalog: calc?.catalog ?? {},
      flavours: "",
      notes: fields.notes?.value || "",
      termsAccepted: Boolean(fields.termsAccepted?.checked),
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

  async function submitWholesaleOrder(event, paymentMethod = "invoice") {
    event?.preventDefault();
    if (!window.LeafLockAccess?.isApproved()) return;
    if (!orderForm.reportValidity()) return;
    if (!fields.termsAccepted?.checked) {
      totals.note.textContent = "You must agree to the Wholesale Terms & Conditions before submitting.";
      return;
    }

    const calc = calculateOrder();
    if (!calc || calc.total <= 0) {
      totals.note.textContent = "Add at least one product before submitting.";
      return;
    }
    const moqIssues = moqWarnings(calc.catalog || {});
    if (moqIssues.length) {
      totals.note.textContent = moqIssues.join(" ");
      return;
    }

    const invoiceBtn = document.getElementById("submitInvoiceBtn");
    const bankBtn = document.getElementById("submitBankTransferBtn");
    const activeBtn = paymentMethod === "bank_transfer" ? bankBtn : invoiceBtn;
    [invoiceBtn, bankBtn].forEach((btn) => {
      if (btn) btn.disabled = true;
    });
    if (activeBtn) activeBtn.textContent = "Submitting…";

    try {
      const data = await window.LeafLockAccess.portalFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify(orderPayload(paymentMethod)),
      });
      currentOrderId = data.order.id;
      const message =
        paymentMethod === "bank_transfer"
          ? "Order received. Check your email for bank transfer details and payment reference."
          : "We've received your order and will email a confirmation + invoice for your records.";
      showSuccess(message);
    } catch (err) {
      totals.note.textContent = err.message || "Could not submit order. Try again.";
    } finally {
      if (invoiceBtn) {
        invoiceBtn.disabled = false;
        invoiceBtn.textContent = "Request invoice by email";
      }
      if (bankBtn) {
        bankBtn.disabled = false;
        bankBtn.textContent = "Submit order — pay by bank transfer";
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
            if (!fields.termsAccepted?.checked) throw new Error("Agree to the Wholesale Terms & Conditions first");
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
      if (input.dataset.catalogSku) return;
      input.addEventListener("input", calculateOrder);
      input.addEventListener("change", calculateOrder);
    });
    fields.starterBundle?.addEventListener("change", () => {
      if (fields.starterBundle.checked) {
        document.querySelectorAll("[data-catalog-sku]").forEach((el) => {
          el.value = "0";
        });
      }
      calculateOrder();
    });
    orderSheetSearch?.addEventListener("input", (e) => filterOrderSheet(e.target.value));
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

  async function loadBankHint() {
    const hint = document.getElementById("bankTransferHint");
    if (!hint) return;
    try {
      const bank = await window.LeafLockAccess.portalFetch("/api/portal/bank-details");
      if (bank.configured) {
        hint.hidden = false;
        hint.textContent = `Bank transfer: ${bank.accountName} · BSB ${bank.bsb} · Acc ${bank.accountNumber} (reference sent in confirmation email).`;
      }
    } catch {
      /* optional */
    }
  }

  async function onPortalReady() {
    await Promise.all([loadPricing(), loadCredentials(), loadBankHint()]);
    if (!paypalLoaded) await setupPayPal();
  }

  orderForm?.addEventListener("submit", (event) => submitWholesaleOrder(event, "invoice"));
  document.getElementById("submitBankTransferBtn")?.addEventListener("click", (event) => {
    submitWholesaleOrder(event, "bank_transfer");
  });
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
    if (orderSheetBody) {
      orderSheetBody.innerHTML = '<tr><td colspan="8">Login to load the price list…</td></tr>';
    if (volumeTierBody) {
      volumeTierBody.innerHTML = '<tr><td colspan="5">Login to load volume tiers…</td></tr>';
    }
    }
  });

  if (formSuccess) formSuccess.hidden = true;
  bindInputs();
})();