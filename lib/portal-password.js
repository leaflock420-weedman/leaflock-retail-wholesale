const crypto = require("crypto");

const TOKEN_TTL_MS = Number(process.env.PORTAL_PASSWORD_TOKEN_HOURS || 48) * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 10;

function passwordPepper() {
  return (
    process.env.PORTAL_PASSWORD_PEPPER ||
    process.env.PORTAL_CODE_SALT ||
    "leaflock-password-pepper-change-on-render"
  );
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password) + passwordPepper(), salt, 64);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

function verifyPassword(password, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  try {
    const attempt = crypto.scryptSync(
      String(password) + passwordPepper(),
      Buffer.from(stored.salt, "hex"),
      64,
    );
    const expected = Buffer.from(stored.hash, "hex");
    if (attempt.length !== expected.length) return false;
    return crypto.timingSafeEqual(attempt, expected);
  } catch {
    return false;
  }
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token) + passwordPepper()).digest("hex");
}

function createTokenFields(token, purpose = "reset") {
  return {
    passwordTokenHash: hashToken(token),
    passwordTokenExpiresAt: Date.now() + TOKEN_TTL_MS,
    passwordTokenPurpose: purpose,
  };
}

function verifyTokenFields(token, retailStockist) {
  if (!retailStockist?.passwordTokenHash || !retailStockist?.passwordTokenExpiresAt) return false;
  if (retailStockist.passwordTokenExpiresAt < Date.now()) return false;
  try {
    const attempt = hashToken(token);
    const stored = Buffer.from(retailStockist.passwordTokenHash, "hex");
    const expected = Buffer.from(attempt, "hex");
    if (stored.length !== expected.length) return false;
    return crypto.timingSafeEqual(stored, expected);
  } catch {
    return false;
  }
}

function clearTokenFields(retailStockist) {
  retailStockist.passwordTokenHash = null;
  retailStockist.passwordTokenExpiresAt = null;
  retailStockist.passwordTokenPurpose = null;
}

module.exports = {
  TOKEN_TTL_MS,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  hashPassword,
  verifyPassword,
  validatePassword,
  generateToken,
  createTokenFields,
  verifyTokenFields,
  clearTokenFields,
};