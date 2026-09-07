const crypto = require("crypto");
const jwt = require("jsonwebtoken");

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
  return jwt.sign({ role: "admin", typ: "admin" }, adminSessionSecret(), {
    expiresIn: `${ADMIN_SESSION_HOURS}h`,
  });
}

function verifyLegacyAdminToken(token) {
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

function verifyAdminToken(token) {
  if (!token || revokedAdminTokens.has(token)) return false;
  try {
    const data = jwt.verify(token, adminSessionSecret());
    if (data.role === "admin" && data.typ === "admin") return true;
  } catch {
    /* legacy */
  }
  return verifyLegacyAdminToken(token);
}

function revokeAdminToken(token) {
  if (token) revokedAdminTokens.add(token);
}

function adminAuthMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const cookieToken = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("ll_admin_session="))
    ?.slice("ll_admin_session=".length);
  const headerToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  const token = headerToken && headerToken !== "null" ? headerToken : decodeURIComponent(cookieToken || "");
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
