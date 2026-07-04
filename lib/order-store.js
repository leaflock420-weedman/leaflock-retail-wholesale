const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DATA_DIR, ensureDataDir } = require("./data-dir");

const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

function readJson(file, fallback) {
  ensureDataDir();
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  const payload = JSON.stringify(data, null, 2);
  try {
    const tmp = `${file}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, payload, "utf8");
    fs.renameSync(tmp, file);
    return true;
  } catch (err) {
    try {
      fs.writeFileSync(file, payload, "utf8");
      return true;
    } catch (err2) {
      console.error(`[order-store] write failed (${DATA_DIR}):`, err2.message);
      return false;
    }
  }
}

function newId() {
  return `ord_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function loadOrders() {
  const data = readJson(ORDERS_FILE, { orders: [] });
  if (!Array.isArray(data.orders)) {
    data.orders = [];
  }
  return data;
}

function saveOrders(data) {
  if (!writeJson(ORDERS_FILE, data)) {
    throw new Error("Could not save order data");
  }
}

function createOrder({
  pharmacyId,
  pharmacyName,
  contact,
  lineItems,
  totals,
  notes,
  paymentMethod,
  source = "portal",
  termsAccepted,
  termsVersion,
  paymentTerms,
}) {
  const data = loadOrders();
  const order = {
    id: newId(),
    pharmacyId: pharmacyId ?? null,
    pharmacyName: pharmacyName || contact?.businessName || "",
    source,
    status: paymentMethod === "paypal" ? "awaiting_payment" : "submitted",
    paymentMethod: paymentMethod || "invoice",
    paymentStatus: paymentMethod === "paypal" ? "pending" : "unpaid",
    paypalOrderId: null,
    paypalCaptureId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contact: {
      businessName: contact.businessName || "",
      fullName: contact.fullName || "",
      role: contact.role || "",
      abn: contact.abn || "",
      pharmacyReg: contact.pharmacyReg || "",
      email: contact.email || "",
      phone: contact.phone || "",
      address: contact.address || "",
    },
    lineItems,
    totals,
    notes: notes || "",
    flavours: contact.flavours || "",
    termsAccepted: Boolean(termsAccepted),
    termsAcceptedAt: termsAccepted ? Date.now() : null,
    termsVersion: termsVersion || null,
    paymentTerms: paymentTerms || "Prepaid — payment in full before dispatch",
  };
  data.orders.unshift(order);
  saveOrders(data);
  return order;
}

function findOrder(id) {
  return loadOrders().orders.find((o) => o.id === id) || null;
}

function updateOrder(id, patch) {
  const data = loadOrders();
  const order = data.orders.find((o) => o.id === id);
  if (!order) return null;
  Object.assign(order, patch, { updatedAt: Date.now() });
  saveOrders(data);
  return order;
}

function listOrders({ status, pharmacyId, limit = 200 } = {}) {
  let orders = loadOrders().orders;
  if (status) orders = orders.filter((o) => o.status === status);
  if (pharmacyId) orders = orders.filter((o) => o.pharmacyId === pharmacyId);
  return orders.slice(0, limit);
}

function ordersSummary() {
  const orders = loadOrders().orders;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = orders.filter((o) => o.createdAt >= todayStart.getTime());
  const pending = orders.filter((o) => ["submitted", "awaiting_payment"].includes(o.status));

  return {
    ordersToday: today.length,
    pendingOrders: pending.length,
    totalOrders: orders.length,
    revenueToday: today.reduce((sum, o) => sum + (o.totals?.total || 0), 0),
  };
}

module.exports = {
  createOrder,
  findOrder,
  updateOrder,
  listOrders,
  ordersSummary,
  loadOrders,
};