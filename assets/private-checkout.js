(() => {
  const token = new URLSearchParams(location.search).get("offer") || "";
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
  let offer;
  let currentOrderId;
  const $ = (id) => document.getElementById(id);

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body;
  }

  function amount() {
    return offer?.allowCustomAmount ? Math.max(0, Number($("amountExGst").value) || 0) : Number(offer?.amountExGst || 0);
  }

  function renderTotals() {
    const subtotal = amount();
    const gst = Math.round(subtotal * .1 * 100) / 100;
    const shipping = Number(offer?.shipping || 0);
    $("subtotal").textContent = money.format(subtotal);
    $("gst").textContent = money.format(gst);
    $("shipping").textContent = shipping ? money.format(shipping) : "FREE";
    $("total").textContent = money.format(subtotal + gst + shipping);
  }

  function payload(paymentMethod) {
    return {
      paymentMethod,
      amountExGst: amount(),
      notes: $("notes").value,
      termsAccepted: $("termsAccepted").checked,
      contact: { businessName: $("businessName").value, fullName: $("fullName").value, email: $("email").value, phone: $("phone").value, address: $("address").value },
    };
  }

  async function createOrder(paymentMethod) {
    if (!$("privateOrderForm").reportValidity()) throw new Error("Complete the required details first");
    const result = await api(`/api/public/private-offer/${encodeURIComponent(token)}/orders`, { method: "POST", body: JSON.stringify(payload(paymentMethod)) });
    currentOrderId = result.order.id;
    return result;
  }

  function loadPayPal(config) {
    if (!config.enabled) return;
    const script = document.createElement("script");
    script.src = `${config.sdkBaseUrl || "https://www.paypal.com"}/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=AUD&intent=capture`;
    script.onload = () => {
      $("paypalWrap").hidden = false;
      window.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
        createOrder: async () => {
          await createOrder("paypal");
          const result = await api(`/api/public/private-offer/${encodeURIComponent(token)}/paypal/create`, { method: "POST", body: JSON.stringify({ orderId: currentOrderId }) });
          return result.paypalOrderId;
        },
        onApprove: async (data) => {
          await api(`/api/public/private-offer/${encodeURIComponent(token)}/paypal/capture`, { method: "POST", body: JSON.stringify({ orderId: currentOrderId, paypalOrderId: data.orderID }) });
          $("checkoutStatus").textContent = "Payment received. Your confirmation has been emailed.";
        },
        onError: () => { $("checkoutStatus").textContent = "PayPal could not complete the payment. Try again or use bank transfer."; },
      }).render("#paypalButtons");
    };
    document.head.appendChild(script);
  }

  async function submit(method) {
    $("checkoutStatus").textContent = "Submitting…";
    try {
      const result = await createOrder(method);
      $("checkoutStatus").textContent = method === "bank_transfer"
        ? `Order ${result.order.invoiceNumber} received. Bank details are in your confirmation email.`
        : `Quote/order ${result.order.invoiceNumber} received. Check your email for confirmation.`;
    } catch (err) { $("checkoutStatus").textContent = err.message; }
  }

  async function boot() {
    try {
      const data = await api(`/api/public/private-offer/${encodeURIComponent(token)}`);
      offer = data.offer;
      $("offerTitle").textContent = offer.title;
      $("offerDescription").textContent = offer.description;
      $("businessName").value = offer.businessName || "";
      $("fullName").value = offer.contactName || "";
      $("email").value = offer.email || "";
      if (offer.allowCustomAmount) {
        $("customAmountWrap").hidden = false;
        $("amountExGst").min = offer.minimumAmount;
        $("amountExGst").value = offer.minimumAmount;
        $("amountExGst").addEventListener("input", renderTotals);
      }
      renderTotals();
      loadPayPal(data.paypal);
    } catch (err) {
      $("offerTitle").textContent = "This private deal link is unavailable";
      $("offerDescription").textContent = err.message;
      $("privateOrderForm").hidden = true;
    }
  }

  $("privateOrderForm").addEventListener("submit", (event) => { event.preventDefault(); submit("invoice"); });
  $("bankTransferBtn").addEventListener("click", () => submit("bank_transfer"));
  boot();
})();
