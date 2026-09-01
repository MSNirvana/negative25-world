import { Queue, type JobsOptions } from 'bullmq';
import { IMPORT_QUEUE, type ImportJob, type ImportJobPublisher } from '@negative25/contracts';

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export class BullMqImportPublisher implements ImportJobPublisher {
  constructor(private readonly queue: Queue<ImportJob>) {}

  async publish(job: ImportJob): Promise<void> {
    // The deterministic id makes confirm/retry safe when the API is called twice.
    // BullMQ rejects ':' in custom IDs; underscore remains stable and readable.
    const jobId = `${job.batchId}_${job.itemId}`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state !== 'failed') return;
      await existing.remove();
    }
    await this.queue.add('import-item', job, { ...defaultJobOptions, jobId });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export function createImportPublisher(connection = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'): BullMqImportPublisher {
  return new BullMqImportPublisher(new Queue<ImportJob>(IMPORT_QUEUE, { connection: { url: connection }, defaultJobOptions }));
}

export function shouldEnableImportQueue(env: NodeJS.ProcessEnv = process.env): boolean {
  const queueSetting = env.N25_IMPORT_QUEUE;
  return env.NODE_ENV !== 'test' && queueSetting !== '0';
}
