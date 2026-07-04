const crypto = require("crypto");

const ADMIN_SESSION_HOURS = Number(process.env.ADMIN_SESSION_HOURS || 12);
const revokedAdminTokens = new Set();

function adminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.PORTAL_SESSION_SECRET ||
    process.env.PORTAL_CODE_SALT ||
    "leaflock-admin-session-secret-change-on-render"
  );
}

function createAdminToken() {
  const exp = Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ role: "admin", e: exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", adminSessionSecret()).update(body).digest("base64url");
  return `lla.${body}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || !token.startsWith("lla.") || revokedAdminTokens.has(token)) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const body = parts[1];
  const sig = parts[2];
  try {
    const expected = crypto.createHmac("sha256", adminSessionSecret()).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return data.role === "admin" && data.e >= Date.now();
  } catch {
    return false;
  }
}

function revokeAdminToken(token) {
  if (token) revokedAdminTokens.add(token);
}

function adminAuthMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.adminToken = token;
  next();
}

module.exports = {
  createAdminToken,
  verifyAdminToken,
  revokeAdminToken,
  adminAuthMiddleware,
};