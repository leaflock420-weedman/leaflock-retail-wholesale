const crypto = require("crypto");

const SESSION_HOURS = Number(process.env.PORTAL_SESSION_HOURS || 24);
const revokedTokens = new Set();

function sessionSecret() {
  return (
    process.env.PORTAL_SESSION_SECRET ||
    process.env.PORTAL_CODE_SALT ||
    "leaflock-portal-session-secret-change-on-render"
  );
}

function createPortalToken(retailStockistId) {
  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ p: retailStockistId, e: exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `ll.${body}.${sig}`;
}

function getPortalSession(token) {
  if (!token || !token.startsWith("ll.") || revokedTokens.has(token)) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const body = parts[1];
  const sig = parts[2];
  try {
    const expected = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!data.p || data.e < Date.now()) return null;
    return { retailStockistId: data.p };
  } catch {
    return null;
  }
}

function revokePortalToken(token) {
  if (token) revokedTokens.add(token);
}

function portalAuthMiddleware(findRetailStockistById) {
  return function portalAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const session = getPortalSession(token);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const retailStockist = findByIdSafe(findRetailStockistById, session.retailStockistId);
    if (!retailStockist || retailStockist.status !== "active") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.portalRetailStockist = retailStockist;
    req.portalToken = token;
    next();
  };
}

function findByIdSafe(findRetailStockistById, id) {
  try {
    return findRetailStockistById(id);
  } catch {
    return null;
  }
}

module.exports = {
  createPortalToken,
  getPortalSession,
  revokePortalToken,
  portalAuthMiddleware,
};