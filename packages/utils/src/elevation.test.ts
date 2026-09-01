import { describe, expect, it, vi } from 'vitest';
import { fetchElevation } from './elevation.js';

describe('fetchElevation', () => {
  it('reads the first elevation from a successful response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ elevation: [123.4] }), { status: 200 }));
    await expect(fetchElevation({ latitude: 39.9, longitude: 116.4 }, 'https://elevation.test/v1', 1000, fetcher)).resolves.toBe(123.4);
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ search: '?latitude=39.9&longitude=116.4' }), expect.objectContaining({ headers: { accept: 'application/json' } }));
  });

  it('returns undefined for failed or invalid responses', async () => {
    const failed = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }));
    const invalid = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ elevation: ['not-a-number'] }), { status: 200 }));
    await expect(fetchElevation({ latitude: 0, longitude: 0 }, 'https://elevation.test/v1', 1000, failed)).resolves.toBeUndefined();
    await expect(fetchElevation({ latitude: 0, longitude: 0 }, 'https://elevation.test/v1', 1000, invalid)).resolves.toBeUndefined();
  });
});
