import { Queue, type JobsOptions } from 'bullmq';
import { IMPORT_QUEUE, type ImportJob } from '@negative25/contracts';

export { IMPORT_QUEUE } from '@negative25/contracts';
export type { ImportJob } from '@negative25/contracts';

export function createImportQueue(connection = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'): Queue<ImportJob> {
  return new Queue<ImportJob>(IMPORT_QUEUE, { connection: { url: connection }, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 100, removeOnFail: 500 } satisfies JobsOptions });
}
