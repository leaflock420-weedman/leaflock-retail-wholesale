const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DATA_DIR, ensureDataDir } = require("./data-dir");
const { writeJsonWithBackup } = require("./data-backup");

const FILE = path.join(DATA_DIR, "promotions.json");

function load() {
  ensureDataDir();
  try {
    if (!fs.existsSync(FILE)) return { codes: [], offers: [] };
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return {
      codes: Array.isArray(data.codes) ? data.codes : [],
      offers: Array.isArray(data.offers) ? data.offers : [],
    };
  } catch {
    return { codes: [], offers: [] };
  }
}

function save(data) {
  if (!writeJsonWithBackup(FILE, data)) throw new Error("Could not save promotions");
}

function cleanCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
}

function createCode(input = {}) {
  const data = load();
  const code = cleanCode(input.code);
  if (!code) throw new Error("Enter a discount code");
  if (data.codes.some((item) => item.code === code && item.active !== false)) throw new Error("That code already exists");
  const type = ["percent", "fixed", "free_shipping"].includes(input.type) ? input.type : "percent";
  const value = type === "free_shipping" ? 0 : Math.max(0, Number(input.value) || 0);
  if (type === "percent" && (value <= 0 || value > 100)) throw new Error("Percentage must be between 0 and 100");
  if (type === "fixed" && value <= 0) throw new Error("Fixed discount must be greater than zero");
  const record = {
    id: `code_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    code,
    type,
    value,
    description: String(input.description || "").trim().slice(0, 160),
    maxUses: Math.max(0, Number.parseInt(input.maxUses, 10) || 0),
    uses: 0,
    active: true,
    createdAt: Date.now(),
  };
  data.codes.unshift(record);
  save(data);
  return record;
}

function findCode(value) {
  const code = cleanCode(value);
  const item = load().codes.find((entry) => entry.code === code && entry.active !== false);
  if (!item) return null;
  if (item.maxUses > 0 && item.uses >= item.maxUses) return null;
  return item;
}

function applyCode(value, totals) {
  const item = findCode(value);
  if (!item) return { ok: false, error: "Discount code is invalid or has expired" };
  const subtotal = Math.max(0, Number(totals.subtotal) || 0);
  const shippingBefore = Math.max(0, Number(totals.shipping) || 0);
  let discount = 0;
  let shipping = shippingBefore;
  if (item.type === "percent") discount = Math.round(subtotal * item.value) / 100;
  if (item.type === "fixed") discount = Math.min(subtotal, item.value);
  if (item.type === "free_shipping") shipping = 0;
  const discountedSubtotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const gst = Math.round(discountedSubtotal * 0.1 * 100) / 100;
  const total = Math.round((discountedSubtotal + gst + shipping) * 100) / 100;
  return {
    ok: true,
    promotion: { code: item.code, type: item.type, value: item.value, description: item.description },
    totals: { ...totals, subtotal: discountedSubtotal, gst, shipping, total, discount, originalSubtotal: subtotal },
  };
}

function recordCodeUse(value) {
  const data = load();
  const code = cleanCode(value);
  const item = data.codes.find((entry) => entry.code === code);
  if (!item) return;
  item.uses = (item.uses || 0) + 1;
  item.lastUsedAt = Date.now();
  save(data);
}

function setCodeActive(id, active) {
  const data = load();
  const item = data.codes.find((entry) => entry.id === id);
  if (!item) return null;
  item.active = Boolean(active);
  item.updatedAt = Date.now();
  save(data);
  return item;
}

function createOffer(input = {}) {
  const data = load();
  const token = crypto.randomBytes(24).toString("base64url");
  const amountExGst = Math.max(0, Number(input.amountExGst) || 0);
  const shipping = input.freeShipping ? 0 : Math.max(0, Number(input.shipping) || 0);
  const allowCustomAmount = Boolean(input.allowCustomAmount);
  if (!allowCustomAmount && amountExGst <= 0) throw new Error("Enter the agreed amount ex GST");
  const offer = {
    id: `offer_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    token,
    businessName: String(input.businessName || "").trim().slice(0, 120),
    contactName: String(input.contactName || "").trim().slice(0, 120),
    email: String(input.email || "").trim().slice(0, 160),
    title: String(input.title || "Private wholesale deal").trim().slice(0, 160),
    description: String(input.description || "").trim().slice(0, 2000),
    amountExGst,
    shipping,
    freeShipping: shipping === 0,
    allowCustomAmount,
    minimumAmount: Math.max(1, Number(input.minimumAmount) || 1),
    active: true,
    createdAt: Date.now(),
  };
  data.offers.unshift(offer);
  save(data);
  return offer;
}

function findOfferByToken(token) {
  return load().offers.find((offer) => offer.token === String(token || "") && offer.active !== false) || null;
}

function setOfferActive(id, active) {
  const data = load();
  const offer = data.offers.find((entry) => entry.id === id);
  if (!offer) return null;
  offer.active = Boolean(active);
  offer.updatedAt = Date.now();
  save(data);
  return offer;
}

function publicOffer(offer) {
  if (!offer) return null;
  const { token, id, active, createdAt, updatedAt, ...safe } = offer;
  return safe;
}

module.exports = { load, createCode, applyCode, recordCodeUse, setCodeActive, createOffer, findOfferByToken, setOfferActive, publicOffer };
