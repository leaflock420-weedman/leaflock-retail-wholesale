/** Paths that must never be served as public static files. */
const BLOCKED_STATIC_PATTERNS = [
  /^\/data(\/|$)/i,
  /^\/private(\/|$)/i,
  /^\/lib(\/|$)/i,
  /^\/scripts(\/|$)/i,
  /^\/node_modules(\/|$)/i,
  /^\/\.git(\/|$)/i,
  /^\/\.cursor(\/|$)/i,
  /^\/\.env/i,
  /^\/package(-lock)?\.json$/i,
  /^\/render\.yaml$/i,
  /^\/project\.config\.json$/i,
  /^\/Userswordo/i,
  /^\/docs(\/|$)/i,
  /^\/help\.html$/i,
  /^\/demo\.html$/i,
  /^\/demo-restyle\.html$/i,
];

function isBlockedStaticPath(pathname) {
  return BLOCKED_STATIC_PATTERNS.some((pattern) => pattern.test(pathname));
}

function blockSensitiveStatic(req, res, next) {
  if (isBlockedStaticPath(req.path)) {
    return res.status(404).end();
  }
  next();
}

function noStoreJson(_req, res, next) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
}

module.exports = { BLOCKED_STATIC_PATTERNS, isBlockedStaticPath, blockSensitiveStatic, noStoreJson };