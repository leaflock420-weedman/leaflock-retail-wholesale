const fs = require("fs");
const path = require("path");

const LOCAL_DATA_DIR = path.join(__dirname, "..", "data");
const RENDER_DISK_DIR = "/var/data";

function probeWritable(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch (err) {
    if (process.env.RENDER) {
      console.warn(`[data-dir] ${dir} not writable: ${err.message}`);
    }
    return false;
  }
}

function pickDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    process.env.RENDER || process.env.RENDER_SERVICE_ID ? RENDER_DISK_DIR : null,
    LOCAL_DATA_DIR,
  ].filter(Boolean);
  const seen = new Set();
  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (probeWritable(resolved)) return resolved;
  }
  return path.resolve(candidates[0] || LOCAL_DATA_DIR);
}

const DATA_DIR = pickDataDir();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

const configuredDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null;
if (configuredDir && configuredDir !== DATA_DIR) {
  console.warn(`[data-dir] ${configuredDir} not writable — using ${DATA_DIR}`);
} else {
  console.log(`[data-dir] using ${DATA_DIR}`);
}

module.exports = { DATA_DIR, LOCAL_DATA_DIR, ensureDataDir };