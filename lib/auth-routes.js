/**
 * Standard authentication routes.
 *
 * POST /api/auth/signup
 * POST /api/auth/login
 * POST /api/auth/forgot-password
 * POST /api/auth/reset-password
 * GET  /api/auth/session      (JWT required)
 * POST /api/auth/logout       (JWT required)
 */

function registerAuthRoutes(app, handlers, portalAuth) {
  app.post("/api/auth/signup", handlers.signup);
  app.post("/api/auth/login", handlers.login);
  app.post("/api/auth/forgot-password", handlers.forgotPassword);
  app.post("/api/auth/reset-password", handlers.resetPassword);
  app.get("/api/auth/password-token-status", handlers.passwordTokenStatus);
  app.get("/api/auth/play-info", handlers.playInfo);
  app.get("/api/auth/session", portalAuth, handlers.session);
  app.post("/api/auth/logout", portalAuth, handlers.logout);

  app.post("/api/applications", handlers.signup);
  app.post("/api/portal/login", handlers.login);
  app.post("/api/portal/forgot-password", handlers.forgotPassword);
  app.post("/api/portal/set-password", handlers.resetPassword);
  app.post("/api/portal/reset-password", handlers.resetPassword);
  app.get("/api/portal/password-token-status", handlers.passwordTokenStatus);
}

module.exports = { registerAuthRoutes };