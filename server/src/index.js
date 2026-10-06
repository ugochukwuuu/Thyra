import { config } from './config.js';
import { createApp } from './app.js';
import { pool } from './db.js';
import { startJobs } from './lib/jobs.js';
import { migrate } from '../scripts/migrate.js';

await migrate();
startJobs();

const server = createApp().listen(config.port, () => {
  console.log(`Thyra API listening on http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
