/**
 * User authentication with password reset flow.
 *
 * Standard names          →  LeafLock routes
 * ----------------          -----------------
 * POST /api/auth/signup     →  POST /api/auth/signup  (also POST /api/applications)
 * POST /api/auth/login      →  POST /api/auth/login   (also POST /api/portal/login)
 * POST /api/auth/forgot-password → POST /api/auth/forgot-password (also /api/portal/forgot-password)
 * POST /api/auth/reset-password  → POST /api/auth/reset-password  (also /api/portal/set-password)
 *
 * Session: JWT in Authorization: Bearer <token> (see lib/portal-auth.js)
 * Passwords: bcrypt (legacy scrypt hashes still verify — see lib/portal-password.js)
 * Reset tokens: expire after PORTAL_PASSWORD_TOKEN_HOURS (default 48h)
 */

function createAuthHandlers({
  rateLimitLogin,
  rateLimitKey,
  applicationRateMax,
  clientMeta,
  findByEmail,
  findByPasswordToken,
  recordLogin,
  recordFailedEmailLogin,
  verifyPassword,
  createPortalToken,
  sendPasswordReset,
  notifyPasswordReset,
  setPasswordForStockist,
  submitApplication,
  notifyAdminNewApplication,
  demoPortalInfo,
  demoPortalPassword,
  getAdminPassword,
  publicRetailStockist,
  revokePortalToken,
}) {
  function signup(req, res) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    if (!rateLimitKey(`apply:${ip}`, applicationRateMax)) {
      return res.status(429).json({ error: "Too many applications. Try again later." });
    }
    const body = req.body || {};
    const required = ["businessName", "fullName", "abn", "email", "password", "passwordConfirm"];
    for (const field of required) {
      if (!String(body[field] || "").trim()) {
        if (field === "password" || field === "passwordConfirm") {
          return res.status(400).json({
            error: "Portal password is required (at least 10 characters).",
          });
        }
        return res.status(400).json({ error: `Missing field: ${field}` });
      }
    }
    try {
      const application = submitApplication(body);
      if (application?.error) return res.status(400).json({ error: application.error });
      notifyAdminNewApplication(application).catch((err) => {
        console.warn("[mail] application notify:", err.message);
      });
      res.status(201).json({ message: "Account application submitted", id: application.id, status: application.status });
    } catch (err) {
      console.error("[auth] signup:", err);
      res.status(500).json({ error: "Could not save application." });
    }
  }

  function login(req, res) {
    try {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const { email, password } = req.body || {};
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const loginPassword = String(password || "");
      if (!normalizedEmail || !loginPassword) {
        return res.status(400).json({ error: "Email and password required" });
      }
      if (!rateLimitLogin(`portal:${ip}:${normalizedEmail}`)) {
        return res.status(429).json({ error: "Too many attempts. Try again later." });
      }

      const retailStockist = findByEmail(normalizedEmail);
      if (!retailStockist || !retailStockist.passwordHash || !verifyPassword(loginPassword, retailStockist.passwordHash)) {
        recordFailedEmailLogin(normalizedEmail, clientMeta(req));
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const publicInfo = recordLogin(retailStockist.id, clientMeta(req));
      const token = createPortalToken(retailStockist.id);
      res.json({
        message: "Logged in successfully",
        token,
        userId: retailStockist.id,
        retailStockist: publicInfo,
      });
    } catch (err) {
      console.error("[auth] login:", err);
      res.status(500).json({ error: "Login unavailable. Try again shortly." });
    }
  }

  async function forgotPassword(req, res) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    if (!rateLimitLogin(`forgot:${ip}`)) {
      return res.status(429).json({ error: "Too many attempts. Try again later." });
    }
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email required" });
    const retailStockist = findByEmail(email);
    if (retailStockist) {
      const result = sendPasswordReset(retailStockist.id);
      if (result?.setupToken) {
        notifyPasswordReset({
          retailStockist: result.retailStockist,
          resetToken: result.setupToken,
        }).catch((err) => {
          console.warn("[mail] password reset:", err.message);
        });
      }
    }
    res.json({
      ok: true,
      message: "If that email exists, a reset link has been sent",
    });
  }

  function resetPassword(req, res) {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.newPassword || req.body?.password || "");
    if (!password) {
      return res.status(400).json({ error: "Password required" });
    }
    if (!token) {
      return res.status(400).json({ error: "Use the reset link from your email." });
    }
    const result = setPasswordForStockist({ token, password });
    if (!result) return res.status(500).json({ error: "Could not save password" });
    if (result.error === "invalid_or_expired_token") {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }
    if (result.error === "save_failed") {
      return res.status(500).json({ error: "Password could not be saved. Request a new reset link." });
    }
    if (result.error) return res.status(400).json({ error: result.error });
    const saved = findByEmail(result.retailStockist.email);
    if (!saved || !verifyPassword(password, saved.passwordHash)) {
      console.error("[auth] reset verification failed for", result.retailStockist.email);
      return res.status(500).json({ error: "Password did not save correctly." });
    }
    res.json({
      ok: true,
      message: "Password updated successfully",
      retailStockist: result.retailStockist,
    });
  }

  function passwordTokenStatus(req, res) {
    const token = String(req.query.token || "");
    const retailStockist = findByPasswordToken(token);
    if (!retailStockist) {
      return res.status(400).json({ valid: false });
    }
    res.json({
      valid: true,
      email: retailStockist.email,
      businessName: retailStockist.businessName,
      purpose: retailStockist.passwordTokenPurpose || "setup",
    });
  }

  function playInfo(_req, res) {
    if (process.env.RENDER) {
      return res.status(404).json({ error: "Not available on production" });
    }
    const demo = demoPortalInfo();
    res.json({
      title: "LeafLock auth playground (local only)",
      demoStockist: {
        email: demo.email,
        password: demoPortalPassword(),
        portalUrl: demo.portalUrl,
      },
      admin: {
        url: "/admin/",
        password: getAdminPassword() || "(set ANALYTICS_ADMIN_PASSWORD in .env.local)",
        loginRoute: "POST /api/analytics/login",
      },
      routes: {
        signup: "POST /api/auth/signup",
        login: "POST /api/auth/login",
        forgotPassword: "POST /api/auth/forgot-password",
        resetPassword: "POST /api/auth/reset-password",
        session: "GET /api/auth/session (Bearer JWT)",
        logout: "POST /api/auth/logout (Bearer JWT)",
      },
      pages: {
        login: "/login.html",
        signup: "/signup.html",
        portal: "/portal.html",
        forgotPassword: "/forgot-password.html",
        resetPassword: "/set-password.html?token=...",
        admin: "/admin/",
        playground: "/auth-playground.html",
      },
    });
  }

  function session(req, res) {
    res.json({
      userId: req.portalRetailStockist.id,
      retailStockist: publicRetailStockist(req.portalRetailStockist),
    });
  }

  function logout(req, res) {
    revokePortalToken(req.portalToken);
    res.status(204).end();
  }

  return {
    signup,
    login,
    forgotPassword,
    resetPassword,
    passwordTokenStatus,
    session,
    logout,
    playInfo,
  };
}

module.exports = { createAuthHandlers };