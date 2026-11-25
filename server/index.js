import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openStore } from './store.js';

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

async function main() {
  const config = loadConfig();
  const store = await openStore(config.dataDir);
  const server = createApp({ config, store });

  const runCleanup = () => store.cleanup().catch((error) => console.error('Cleanup failed:', error));
  const cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
  runCleanup();

  const shutdown = () => {
    clearInterval(cleanupTimer);
    server.close(() => store.close());
    server.closeIdleConnections();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  server.listen(config.port, config.host, () => {
    console.info(`arca: listening on http://${config.host}:${config.port}`);
  });
}

main().catch((error) => {
  console.error(`arca: failed to start: ${error.message}`);
  process.exit(1);
});
