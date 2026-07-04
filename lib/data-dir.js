const fs = require("fs");
const path = require("path");

const CANDIDATE_DIRS = [
  process.env.DATA_DIR,
  path.join(__dirname, "..", "data"),
].filter(Boolean);

function probeWritable(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

const DATA_DIR = CANDIDATE_DIRS.find(probeWritable) || CANDIDATE_DIRS[0];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (process.env.DATA_DIR && DATA_DIR !== process.env.DATA_DIR) {
  console.warn(
    `[data-dir] ${process.env.DATA_DIR} not writable — using fallback ${DATA_DIR}`,
  );
} else {
  console.log(`[data-dir] using ${DATA_DIR}`);
}

module.exports = { DATA_DIR, ensureDataDir };