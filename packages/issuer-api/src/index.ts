import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';

migrate();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(
    `[issuer-api] listening on http://localhost:${config.port} ` +
      `(env=${config.nodeEnv}, network=${config.networkId})`,
  );
  console.log(`[issuer-api] OpenAPI docs at http://localhost:${config.port}/docs`);
});

function shutdown(signal: string): void {
  console.log(`[issuer-api] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
