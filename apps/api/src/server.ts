import { buildApp } from './app.js';

// Load the workspace-local runtime settings when the API is started directly.
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(new URL('../../../.env', import.meta.url)); } catch { /* optional local file */ }
}

const app = buildApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
