const crypto = require("crypto");
const bcrypt = require("bcrypt");

const TOKEN_TTL_MS = Number(process.env.PORTAL_PASSWORD_TOKEN_HOURS || 48) * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 10;
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

/** Top breached / guessable passwords — Chrome flags these too; block server-side with a calm message. */
const COMMON_PASSWORDS = new Set(
  [
    "password",
    "password1",
    "password12",
    "password123",
    "password1234",
    "password12345",
    "password123456",
    "Password1",
    "Password12",
    "Password123",
    "Password123!",
    "Password1234",
    "letmein123",
    "welcome1",
    "welcome123",
    "changeme",
    "changeme123",
    "admin123",
    "admin1234",
    "qwerty123",
    "qwerty1234",
    "abc1234567",
    "1234567890",
    "iloveyou1",
    "sunshine1",
    "football1",
    "baseball1",
    "dragon123",
    "master123",
    "trustno1",
    "hello12345",
    "wholesale1",
    "wholesale123",
    "leaflock123",
    "Leaflock123",
    "LeafLock123",
    "stockist123",
    "gummy12345",
  ].map((p) => p.toLowerCase()),
);

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
  const hash = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
  return { algo: "bcrypt", hash };
}

function hasStoredPassword(stored) {
  if (!stored) return false;
  if (stored.algo === "bcrypt" && stored.hash) return true;
  return Boolean(stored.salt && stored.hash);
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.algo === "bcrypt" && stored.hash) {
    try {
      return bcrypt.compareSync(String(password), stored.hash);
    } catch {
      return false;
    }
  }
  if (stored.salt && stored.hash) {
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
  return false;
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return "That password is too common. Choose a longer unique password you have not used on other websites.";
  }
  return null;
}

function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function normalizePasswordToken(token) {
  let value = String(token || "").trim();
  value = value.replace(/[\s\r\n]+/g, "");
  value = value.replace(/[.,;)>]+$/g, "");
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  return value.trim();
}

function passwordTokenCandidates(token) {
  const raw = String(token || "").trim();
  const normalized = normalizePasswordToken(raw);
  const candidates = [];
  if (normalized) candidates.push(normalized);
  if (raw && raw !== normalized) candidates.push(raw);
  return [...new Set(candidates)];
}

function generateSetupCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function generateTemporaryPassword() {
  const part = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `LL-Reset-${part}`;
}

function normalizeSetupCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeMasterResetCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function masterResetCodeConfigured() {
  return Boolean(String(process.env.PORTAL_MASTER_RESET_CODE || "").trim());
}

function verifyMasterResetCode(code) {
  const expected = String(process.env.PORTAL_MASTER_RESET_CODE || "").trim();
  if (!expected) return false;
  const attempt = normalizeMasterResetCode(code);
  const normalizedExpected = normalizeMasterResetCode(expected);
  if (!attempt || attempt.length !== normalizedExpected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(attempt), Buffer.from(normalizedExpected));
  } catch {
    return false;
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token) + passwordPepper()).digest("hex");
}

function hashSetupCode(code) {
  return hashToken(`code:${normalizeSetupCode(code)}`);
}

function createTokenFields(token, purpose = "reset", setupCode = null) {
  const fields = {
    passwordTokenHash: hashToken(token),
    passwordTokenExpiresAt: Date.now() + TOKEN_TTL_MS,
    passwordTokenPurpose: purpose,
  };
  if (setupCode) {
    fields.passwordSetupCodeHash = hashSetupCode(setupCode);
  }
  return fields;
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

function verifySetupCode(code, retailStockist) {
  if (!retailStockist?.passwordSetupCodeHash || !retailStockist?.passwordTokenExpiresAt) return false;
  if (retailStockist.passwordTokenExpiresAt < Date.now()) return false;
  try {
    const attempt = Buffer.from(hashSetupCode(code), "hex");
    const stored = Buffer.from(retailStockist.passwordSetupCodeHash, "hex");
    if (stored.length !== attempt.length) return false;
    return crypto.timingSafeEqual(stored, attempt);
  } catch {
    return false;
  }
}

function clearTokenFields(retailStockist) {
  retailStockist.passwordTokenHash = null;
  retailStockist.passwordSetupCodeHash = null;
  retailStockist.passwordTokenExpiresAt = null;
  retailStockist.passwordTokenPurpose = null;
}

module.exports = {
  TOKEN_TTL_MS,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  normalizeSetupCode,
  normalizePasswordToken,
  passwordTokenCandidates,
  hashPassword,
  hasStoredPassword,
  verifyPassword,
  validatePassword,
  generateToken,
  generateSetupCode,
  generateTemporaryPassword,
  createTokenFields,
  verifyTokenFields,
  verifySetupCode,
  normalizeMasterResetCode,
  masterResetCodeConfigured,
  verifyMasterResetCode,
  clearTokenFields,
};