import { describe, expect, it } from 'vitest';
import type { Queue } from 'bullmq';
import type { ImportJob } from '@negative25/contracts';
import { BullMqImportPublisher, shouldEnableImportQueue } from './import-queue.js';

describe('import queue publisher', () => {
  it('publishes a deterministic job id for retries and duplicate confirms', async () => {
    const calls: Array<{ name: string; data: ImportJob; options?: Record<string, unknown> }> = [];
    const queue = {
      add: async (name: string, data: ImportJob, options?: Record<string, unknown>) => { calls.push({ name, data, options }); },
      getJob: async () => undefined,
      close: async () => undefined,
    } as unknown as Queue<ImportJob>;
    const publisher = new BullMqImportPublisher(queue);
    const job = { batchId: 'batch-1', itemId: 'item-1', workspaceId: 'space-1' };

    await publisher.publish(job);
    await publisher.publish(job);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ name: 'import-item', data: job, options: { jobId: 'batch-1_item-1' } });
    expect(calls[1]?.options?.jobId).toBe(calls[0]?.options?.jobId);
  });

  it('does not enable queue in tests or when explicitly disabled', () => {
    expect(shouldEnableImportQueue({ NODE_ENV: 'test' })).toBe(false);
    expect(shouldEnableImportQueue({ NODE_ENV: 'production', N25_IMPORT_QUEUE: '0' })).toBe(false);
    expect(shouldEnableImportQueue({ NODE_ENV: 'production', N25_IMPORT_QUEUE: '1' })).toBe(true);
  });
});
