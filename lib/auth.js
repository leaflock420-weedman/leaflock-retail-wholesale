/**
 * Authentication system overview (LeafLock wholesale app).
 *
 * Frontend pages          Backend routes                    Storage
 * ----------------        --------------                    -------
 * signup.html             POST /api/auth/signup             retail-stockists.json (bcrypt passwordHash)
 * login.html              POST /api/auth/login              → returns JWT
 * forgot-password.html    POST /api/auth/forgot-password    reset token + expiry on user row
 * set-password.html       POST /api/auth/reset-password     updates bcrypt hash, clears token
 * portal.html (gated)     GET  /api/auth/session            JWT in Authorization header
 * admin/ (gated)          POST /api/analytics/login         admin JWT; all /api/admin/* protected
 *
 * Password hashing: bcrypt (lib/portal-password.js)
 * Sessions: JWT (lib/portal-auth.js, lib/admin-auth.js)
 * Reset tokens: crypto random token, SHA-256 hash stored, expires PORTAL_PASSWORD_TOKEN_HOURS
 */

module.exports = {
  routes: {
    signup: "POST /api/auth/signup",
    login: "POST /api/auth/login",
    forgotPassword: "POST /api/auth/forgot-password",
    resetPassword: "POST /api/auth/reset-password",
    session: "GET /api/auth/session",
    logout: "POST /api/auth/logout",
    adminLogin: "POST /api/analytics/login",
  },
  pages: {
    signup: "/signup.html",
    login: "/login.html",
    forgotPassword: "/forgot-password.html",
    resetPassword: "/set-password.html",
    portal: "/portal.html",
    admin: "/admin/",
  },
};