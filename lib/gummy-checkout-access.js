/**
 * Private link key for public gummy checkout (email campaigns).
 * Without the key, pricing APIs and checkout return 403 — not indexed in HTML.
 */

function accessKey() {
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
  return Boolean(accessKey());
}

function hasValidCheckoutAccess(req) {
  const expected = accessKey();
  if (!expected) return false;
  return keyFromRequest(req) === expected;
}

function requireGummyCheckoutAccess(req, res, next) {
  if (hasValidCheckoutAccess(req)) return next();
  return res.status(403).json({
    error: "Private checkout link required. Use the link from your LeafLock email or log in at the portal.",
  });
}

module.exports = {
  accessKey,
  isCheckoutAccessConfigured,
  hasValidCheckoutAccess,
  requireGummyCheckoutAccess,
};