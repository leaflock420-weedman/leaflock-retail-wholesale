const path = require("path");
const { DATA_DIR, ensureDataDir } = require("./data-dir");
const {
  writeJsonWithBackup,
  restoreAnalyticsData,
  normalizeEventsList,
  readJsonFile,
} = require("./data-backup");

const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const META_FILE = path.join(DATA_DIR, "meta.json");
const MAX_EVENTS = 50000;
let analyticsDataInitialized = false;

function readJson(file, fallback) {
  ensureDataDir();
  return readJsonFile(file, fallback);
}

function writeJson(file, data) {
  ensureDataDir();
  return writeJsonWithBackup(file, data);
}

function initializeAnalyticsData() {
  if (analyticsDataInitialized) return { changed: false, results: [] };
  analyticsDataInitialized = true;
  const restore = restoreAnalyticsData();
  const events = normalizeEventsList(readJson(EVENTS_FILE, []));
  if (restore.results.length) {
    console.log("[analytics] Data init:", restore.results.join("; "));
  }
  return { changed: restore.changed, results: restore.results, eventCount: events.length };
}

function loadEvents() {
  initializeAnalyticsData();
  return normalizeEventsList(readJson(EVENTS_FILE, []));
}

function saveEvents(events) {
  const trimmed = events.slice(-MAX_EVENTS);
  writeJson(EVENTS_FILE, trimmed);
}

function loadMeta() {
  return readJson(META_FILE, { lastDailyReport: null });
}

function saveMeta(meta) {
  writeJson(META_FILE, meta);
}

function classifySource(event) {
  const ref = (event.referrer || "").toLowerCase();
  const utm = event.utm || {};
  if (utm.utm_source) return `Campaign: ${utm.utm_source}${utm.utm_medium ? ` / ${utm.utm_medium}` : ""}`;
  if (!ref || ref === "direct") return "Direct";
  if (ref.includes("google.")) return "Google";
  if (ref.includes("bing.")) return "Bing";
  if (ref.includes("facebook.") || ref.includes("fb.")) return "Facebook";
  if (ref.includes("instagram.")) return "Instagram";
  if (ref.includes("mail.") || ref.includes("outlook.") || ref.includes("gmail.")) return "Email client";
  try {
    return new URL(ref).hostname.replace(/^www\./, "");
  } catch {
    return "Other";
  }
}

function recordEvent(payload) {
  const events = loadEvents();
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ts: payload.ts || Date.now(),
    type: payload.type || "pageview",
    path: payload.path || "/",
    referrer: payload.referrer || "",
    utm: payload.utm || {},
    sessionId: payload.sessionId || "unknown",
    eventName: payload.eventName || null,
    userAgent: payload.userAgent || "",
  };
  events.push(event);
  saveEvents(events);
  return event;
}

function inRange(ts, start, end) {
  return ts >= start && ts < end;
}

function summarize({ days = 1, end = Date.now() } = {}) {
  const events = loadEvents();
  const start = end - days * 24 * 60 * 60 * 1000;
  const windowed = events.filter((e) => inRange(e.ts, start, end));

  const pageviews = windowed.filter((e) => e.type === "pageview");
  const sessions = new Set(pageviews.map((e) => e.sessionId));
  const liveCutoff = Date.now() - 5 * 60 * 1000;
  const liveSessions = new Set(
    pageviews.filter((e) => e.ts >= liveCutoff).map((e) => e.sessionId),
  );

  const pages = {};
  const sources = {};
  const pathsBySession = {};

  for (const e of pageviews) {
    pages[e.path] = (pages[e.path] || 0) + 1;
    const source = classifySource(e);
    sources[source] = (sources[source] || 0) + 1;
    if (!pathsBySession[e.sessionId]) pathsBySession[e.sessionId] = [];
    pathsBySession[e.sessionId].push({ path: e.path, ts: e.ts });
  }

  const topPages = Object.entries(pages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  const topSources = Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([source, count]) => ({ source, count }));

  let portalViews = 0;
  let accessRequests = 0;
  for (const e of pageviews) {
    if (e.path.includes("portal")) portalViews += 1;
    if (e.path.includes("request-access")) accessRequests += 1;
  }

  const daily = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const dayEnd = new Date(end);
    dayEnd.setHours(0, 0, 0, 0);
    dayEnd.setDate(dayEnd.getDate() - i + 1);
    const dayStart = new Date(dayEnd);
    dayStart.setDate(dayStart.getDate() - 1);
    const count = pageviews.filter((e) => inRange(e.ts, dayStart.getTime(), dayEnd.getTime())).length;
    daily.push({
      label: dayStart.toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" }),
      count,
    });
  }

  const highlights = [];
  if (liveSessions.size > 0) highlights.push(`${liveSessions.size} visitor${liveSessions.size === 1 ? "" : "s"} on site right now`);
  if (accessRequests > 0) highlights.push(`${accessRequests} visit${accessRequests === 1 ? "" : "s"} to Request Access`);
  if (portalViews > 0) highlights.push(`${portalViews} wholesale portal view${portalViews === 1 ? "" : "s"}`);
  const googleHits = sources.Google || 0;
  if (googleHits > 0) highlights.push(`${googleHits} visit${googleHits === 1 ? "" : "s"} from Google`);
  if (!highlights.length) highlights.push("Quiet period — no standout traffic yet.");

  return {
    rangeDays: days,
    pageviews: pageviews.length,
    uniqueSessions: sessions.size,
    liveVisitors: liveSessions.size,
    topPages,
    topSources,
    portalViews,
    accessRequests,
    daily,
    highlights,
  };
}

function buildDailyReportHtml(summary) {
  const pageRows = summary.topPages.map((p) => `<tr><td>${p.path}</td><td>${p.count}</td></tr>`).join("");
  const sourceRows = summary.topSources.map((s) => `<tr><td>${s.source}</td><td>${s.count}</td></tr>`).join("");
  const highlightItems = summary.highlights.map((h) => `<li>${h}</li>`).join("");

  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#17211d;max-width:640px">
      <h1 style="color:#1d5730;margin:0 0 8px">LeafLock Wholesale — Daily Traffic Report</h1>
      <p style="color:#5c6963;margin:0 0 20px">Yesterday's snapshot for retail stockist wholesale</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
        <tr><td style="padding:12px;background:#eaf5ed;border-radius:8px"><strong>${summary.pageviews}</strong> pageviews</td>
        <td width="8"></td>
        <td style="padding:12px;background:#eaf5ed;border-radius:8px"><strong>${summary.uniqueSessions}</strong> sessions</td></tr>
      </table>
      <h2 style="font-size:16px;color:#1d5730">Highlights</h2>
      <ul>${highlightItems}</ul>
      <h2 style="font-size:16px;color:#1d5730">Top pages</h2>
      <table cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse">${pageRows || "<tr><td>No data yet</td></tr>"}</table>
      <h2 style="font-size:16px;color:#1d5730;margin-top:20px">Traffic sources</h2>
      <table cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse">${sourceRows || "<tr><td>No data yet</td></tr>"}</table>
      <p style="color:#5c6963;font-size:12px;margin-top:24px">View live dashboard: /admin/</p>
    </div>`;
}

module.exports = {
  initializeAnalyticsData,
  recordEvent,
  summarize,
  buildDailyReportHtml,
  loadMeta,
  saveMeta,
};