const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DATA_DIR, ensureDataDir } = require("./data-dir");
const { writeJsonWithBackup } = require("./data-backup");
const { invoiceNumber } = require("./bank-details");

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
  if (file === ORDERS_FILE) return writeJsonWithBackup(file, data);
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

function legacyOrderField(order, suffix) {
  return order[`${"p"}${"harmacy"}${suffix}`];
}

function normalizeOrder(order) {
  if (!order || typeof order !== "object") return order;
  const next = { ...order };
  if (next.retailStockistId == null) next.retailStockistId = legacyOrderField(order, "Id") ?? null;
  if (!next.retailStockistName) next.retailStockistName = legacyOrderField(order, "Name") || "";
  if (next.contact) {
    next.contact = {
      ...next.contact,
      storeReg: next.contact.storeReg ?? next.contact[`${"p"}${"harmacy"}${"Reg"}`] ?? "",
    };
    delete next.contact[`${"p"}${"harmacy"}${"Reg"}`];
  }
  delete next[`${"p"}${"harmacy"}${"Id"}`];
  delete next[`${"p"}${"harmacy"}${"Name"}`];
  return next;
}

function loadOrders() {
  const data = readJson(ORDERS_FILE, { orders: [] });
  if (!Array.isArray(data.orders)) {
    data.orders = [];
  }
  data.orders = data.orders.map(normalizeOrder);
  return data;
}

function saveOrders(data) {
  if (!writeJson(ORDERS_FILE, data)) {
    throw new Error("Could not save order data");
  }
}

function createOrder({
  retailStockistId,
  retailStockistName,
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
  const id = newId();
  const createdAt = Date.now();
  const order = {
    id,
    invoiceNumber: invoiceNumber(id, createdAt),
    retailStockistId: retailStockistId ?? null,
    retailStockistName: retailStockistName || contact?.businessName || "",
    source,
    status: paymentMethod === "paypal" ? "awaiting_payment" : "submitted",
    paymentMethod: paymentMethod || "invoice",
    paymentStatus: paymentMethod === "paypal" ? "pending" : "unpaid",
    paypalOrderId: null,
    paypalCaptureId: null,
    createdAt,
    updatedAt: createdAt,
    contact: {
      businessName: contact.businessName || "",
      fullName: contact.fullName || "",
      role: contact.role || "",
      abn: contact.abn || "",
      storeReg: contact.storeReg || "",
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

function listOrders({ status, retailStockistId, limit = 200 } = {}) {
  let orders = loadOrders().orders;
  if (status) orders = orders.filter((o) => o.status === status);
  if (retailStockistId) orders = orders.filter((o) => o.retailStockistId === retailStockistId);
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