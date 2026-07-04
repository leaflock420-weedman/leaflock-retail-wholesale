/**
 * Australia Post Postage Assessment Calculator (PAC).
 * Used for admin postage estimates — portal checkout keeps flat wholesale shipping rules.
 */

const BASE_URL = "https://digitalapi.auspost.com.au";

function apiKey() {
  return process.env.AUSPOST_PAC_API_KEY || "";
}

function fromPostcode() {
  return String(process.env.AUSPOST_FROM_POSTCODE || "4217").trim();
}

function isConfigured() {
  return Boolean(apiKey());
}

async function pacGet(pathname) {
  const key = apiKey();
  if (!key) {
    return { ok: false, error: "Australia Post API key not configured (AUSPOST_PAC_API_KEY)." };
  }

  const url = `${BASE_URL}${pathname}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { "AUTH-KEY": key, Accept: "application/json" },
    });
  } catch (err) {
    return { ok: false, error: err.message || "Could not reach Australia Post API." };
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: "Invalid response from Australia Post API." };
  }

  if (!res.ok || body.error) {
    const message =
      body.error?.errorMessage ||
      body.error?.message ||
      body.message ||
      `Australia Post API error (${res.status})`;
    return { ok: false, error: message, status: res.status };
  }

  return { ok: true, body };
}

function normalizeQuoteInput(input = {}) {
  const toPostcode = String(input.toPostcode || input.to_postcode || "").replace(/\D/g, "");
  const length = Math.max(1, Number(input.length) || 30);
  const width = Math.max(1, Number(input.width) || 25);
  const height = Math.max(1, Number(input.height) || 15);
  const weight = Math.max(0.1, Number(input.weight) || 2);
  const serviceCode = String(input.serviceCode || input.service_code || "AUS_PARCEL_REGULAR").trim();

  return {
    fromPostcode: fromPostcode(),
    toPostcode,
    length,
    width,
    height,
    weight,
    serviceCode,
  };
}

async function quoteDomesticParcel(input) {
  const q = normalizeQuoteInput(input);
  if (!/^\d{4}$/.test(q.toPostcode)) {
    return { ok: false, error: "Enter a valid 4-digit destination postcode." };
  }

  const params = new URLSearchParams({
    from_postcode: q.fromPostcode,
    to_postcode: q.toPostcode,
    length: String(q.length),
    width: String(q.width),
    height: String(q.height),
    weight: String(q.weight),
    service_code: q.serviceCode,
  });

  const result = await pacGet(`/postage/parcel/domestic/calculate.json?${params}`);
  if (!result.ok) return result;

  const pr = result.body.postage_result || {};
  return {
    ok: true,
    fromPostcode: q.fromPostcode,
    toPostcode: q.toPostcode,
    service: pr.service || q.serviceCode,
    deliveryTime: pr.delivery_time || null,
    totalCost: Number(pr.total_cost) || null,
    dimensions: { length: q.length, width: q.width, height: q.height, weight: q.weight },
    serviceCode: q.serviceCode,
  };
}

module.exports = {
  isConfigured,
  fromPostcode,
  quoteDomesticParcel,
};