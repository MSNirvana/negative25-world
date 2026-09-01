import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { generateVariants } from './variants.js';

describe('photo variants', () => {
  it('creates deterministic, aspect-preserving JPEG variants', async () => {
    const input = await sharp({ create: { width: 1600, height: 800, channels: 3, background: { r: 25, g: 50, b: 75 } } }).png().toBuffer();
    const first = await generateVariants(input);
    const second = await generateVariants(input);
    expect(first.map((item) => [item.kind, item.width, item.height, item.format])).toEqual([
      ['thumbnail', 480, 240, 'jpeg'], ['preview', 1280, 640, 'jpeg'], ['large', 1600, 800, 'jpeg'],
    ]);
    expect(first.map((item) => item.body.equals(second.find((candidate) => candidate.kind === item.kind)!.body))).toEqual([true, true, true]);
  });

  it('rejects invalid image bytes without creating output', async () => {
    await expect(generateVariants(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
});
