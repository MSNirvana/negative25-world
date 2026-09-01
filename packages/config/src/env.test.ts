import { describe, expect, it } from 'vitest';
import { parseServerEnv, parseWebEnv } from './env.js';

const validServerEnv = {
  NODE_ENV: 'test', PORT: '3000', DATABASE_URL: 'postgres://localhost/negative25',
  N25_USE_DATABASE: '0', N25_IMPORT_QUEUE: '1',
  REDIS_URL: 'redis://localhost:6379', S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'negative25', S3_REGION: 'us-east-1', S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret', JWT_SECRET: 'jwt-secret',
  JWT_REFRESH_SECRET: 'refresh-secret', WEB_ORIGIN: 'http://localhost:5173',
  PRIMARY_WORKSPACE_SLUG: 'primary', MAP_STYLE_URL: 'https://maps.test/style.json',
  GEOCODER_URL: 'https://geo.test',
};

describe('environment configuration', () => {
  it('rejects server startup without required secrets', () => {
    const missing = { ...validServerEnv, JWT_SECRET: '' };
    expect(() => parseServerEnv(missing)).toThrow();
  });

  it('keeps web configuration limited to Vite client values', () => {
    expect(parseWebEnv({ VITE_API_BASE_URL: 'http://localhost:3000/api/v1' })).toEqual({
      apiBaseUrl: 'http://localhost:3000/api/v1',
    });
  });

});
