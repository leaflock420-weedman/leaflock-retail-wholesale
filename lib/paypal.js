const PAYPAL_API =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

let cachedToken = null;
let tokenExpiry = 0;

function isConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function clientId() {
  return process.env.PAYPAL_CLIENT_ID || "";
}

async function getAccessToken() {
  if (!isConfigured()) throw new Error("PayPal not configured");
  if (cachedToken && tokenExpiry > Date.now() + 60000) return cachedToken;

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${err}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function paypalFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const message = body.message || body.error_description || text || res.statusText;
    throw new Error(`PayPal API error: ${message}`);
  }
  return body;
}

async function createPayPalOrder({ orderId, total, currency = "AUD", description }) {
  const amount = Number(total).toFixed(2);
  return paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderId,
          description: description || `LeafLock Wholesale Order ${orderId}`,
          amount: {
            currency_code: currency,
            value: amount,
          },
        },
      ],
      application_context: {
        brand_name: "LeafLock Wholesale",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    }),
  });
}

async function getPayPalOrder(paypalOrderId) {
  return paypalFetch(`/v2/checkout/orders/${paypalOrderId}`, { method: "GET" });
}

async function capturePayPalOrder(paypalOrderId) {
  return paypalFetch(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

function mode() {
  return process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
}

function sdkBaseUrl() {
  return mode() === "live" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";
}

function captureAmount(capture) {
  const value =
    capture?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ||
    capture?.purchase_units?.[0]?.amount?.value;
  return value != null ? Number(value) : null;
}

module.exports = {
  isConfigured,
  clientId,
  mode,
  sdkBaseUrl,
  createPayPalOrder,
  getPayPalOrder,
  capturePayPalOrder,
  captureAmount,
};