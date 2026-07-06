/**
 * Gummy checkout access — per-stockist private key or legacy campaign key (env).
 */

const { findByCheckoutKey } = require("./retail-store");

function globalAccessKey() {
  return String(process.env.GUMMY_CHECKOUT_ACCESS_KEY || "").trim();
}

function keyFromRequest(req) {
  const header = req.headers["x-gummy-checkout-key"];
  if (header && String(header).trim()) return String(header).trim();
  const query = req.query?.key || req.query?.access;
  if (query && String(query).trim()) return String(query).trim();
  const body = req.body?.checkoutKey || req.body?.key;
  if (body && String(body).trim()) return String(body).trim();
  return "";
}

function isCheckoutAccessConfigured() {
  return Boolean(globalAccessKey());
}

function resolveCheckoutAccess(req) {
  const key = keyFromRequest(req);
  if (!key) return { ok: false };

  const retailStockist = findByCheckoutKey(key);
  if (retailStockist) {
    return { ok: true, source: "stockist", retailStockist };
  }

  const global = globalAccessKey();
  if (global && key === global) {
    return { ok: true, source: "campaign", retailStockist: null };
  }

  return { ok: false };
}

function hasValidCheckoutAccess(req) {
  return resolveCheckoutAccess(req).ok;
}

function requireGummyCheckoutAccess(req, res, next) {
  const access = resolveCheckoutAccess(req);
  if (!access.ok) {
    return res.status(403).json({
      error:
        "Private checkout link required. Use your personal LeafLock link or log in at the portal.",
    });
  }
  req.gummyCheckoutAccess = access;
  req.gummyCheckoutStockist = access.retailStockist || null;
  next();
}

module.exports = {
  globalAccessKey,
  isCheckoutAccessConfigured,
  resolveCheckoutAccess,
  hasValidCheckoutAccess,
  requireGummyCheckoutAccess,
};