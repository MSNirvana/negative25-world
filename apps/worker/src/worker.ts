import { Worker } from 'bullmq';
import { IMPORT_QUEUE, type ImportJob } from './queue.js';
import { processImportJob } from './jobs/import-batch.js';
import { createImportPersistenceFromEnv } from './persistence.js';
import { createObjectStorageFromEnv } from './storage.js';

// Keep the standalone worker on the same local configuration as the API.
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(new URL('../../../.env', import.meta.url)); } catch { /* optional local file */ }
}

export function startWorker(): Worker<ImportJob> | undefined {
  if (process.env.RUN_WORKER !== '1') {
    console.log('negative25 worker ready (set RUN_WORKER=1 to consume Redis jobs)');
    return undefined;
  }
  const connection = { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' };
  const persistence = createImportPersistenceFromEnv();
  const storage = createObjectStorageFromEnv();
  const worker = new Worker<ImportJob>(IMPORT_QUEUE, async (job) => processImportJob(job.data, { persistence, storage }), { connection });
  worker.on('failed', (job, error) => console.error('Import job failed', { jobId: job?.id, code: error.name }));
  worker.on('closing', () => { void persistence.close(); });
  console.log(`negative25 worker listening on ${IMPORT_QUEUE}`);
  return worker;
}

if (process.env.NODE_ENV !== 'test') startWorker();
