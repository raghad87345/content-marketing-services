'use strict';

const config = require('./config');
const { initStore } = require('./db/store');
const { seedDemoData } = require('./db/seed');
const { createApp } = require('./app');

async function start() {
  await initStore(config);

  if (config.seedDemoData) {
    const result = await seedDemoData();
    if (result.seeded) {
      console.log(`[seed] demo workspace created — ${result.email} / ${result.password}`);
    }
  }

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`MOHTAWA running at http://localhost:${config.port} (${config.env})`);
    console.log(
      config.ai.enabled
        ? `[ai] Content Studio is using ${config.ai.model}.`
        : '[ai] ANTHROPIC_API_KEY not set — Content Studio uses the built-in generator.'
    );
  });

  const shutdown = (signal) => () => {
    console.log(`\n[${signal}] shutting down…`);
    server.close(() => process.exit(0));
    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start MOHTAWA:', err);
    process.exit(1);
  });
}

module.exports = { start };
