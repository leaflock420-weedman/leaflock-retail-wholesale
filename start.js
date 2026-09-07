const { DATA_DIR } = require("./lib/data-dir");
const { hydrateDataDir, flushRemoteWrites } = require("./lib/remote-data");

async function start() {
  await hydrateDataDir(DATA_DIR);
  require("./server");
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, async () => {
    await flushRemoteWrites();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error("[startup] failed:", err);
  process.exit(1);
});
