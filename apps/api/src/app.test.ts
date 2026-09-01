import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('API foundation', () => {
  it('reports health without binding a port', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });

  it('handles browser preflight requests for the configured web origin', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'OPTIONS', url: '/api/v1/auth/login', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    await app.close();
  });

  it('accepts authenticated binary uploads for local memory storage', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const authorization = 'Bearer ' + login.json().accessToken;
    const reservation = await app.inject({ method: 'POST', url: '/api/v1/media/upload-url', headers: { authorization }, payload: { spaceSlug: 'primary', filename: 'test.jpg', contentType: 'image/jpeg', byteSize: 4 } });
    expect(reservation.statusCode).toBe(200);
    const upload = reservation.json();
    const content = await app.inject({ method: 'POST', url: '/api/v1/media/upload-content', headers: { authorization, 'content-type': 'application/octet-stream', 'x-space-slug': 'primary', 'x-upload-key': upload.key, 'x-expected-byte-size': '4', 'x-expected-content-type': 'image/jpeg' }, payload: Buffer.from([1, 2, 3, 4]) });
    expect(content.statusCode).toBe(200);
    expect(content.json()).toMatchObject({ key: upload.key, byteSize: 4 });
    await app.close();
  });

  it('creates and resumes multipart upload sessions for local memory storage', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const authorization = 'Bearer ' + login.json().accessToken;
    const initiated = await app.inject({ method: 'POST', url: '/api/v1/media/multipart/initiate', headers: { authorization }, payload: { spaceSlug: 'primary', filename: 'large.jpg', contentType: 'image/jpeg', byteSize: 33 * 1024 * 1024 } });
    expect(initiated.statusCode).toBe(200);
    const upload = initiated.json();
    expect(upload).toMatchObject({ partCount: 3, partSize: 16 * 1024 * 1024 });
    const partUrl = await app.inject({ method: 'POST', url: `/api/v1/media/multipart/${upload.id}/part-url`, headers: { authorization }, payload: { spaceSlug: 'primary', partNumber: 1 } });
    expect(partUrl.statusCode).toBe(200);
    expect(partUrl.json().url).toMatch(/^memory:\/\/part\//);
    const status = await app.inject({ method: 'GET', url: `/api/v1/media/multipart/${upload.id}/status?spaceSlug=primary`, headers: { authorization } });
    expect(status.statusCode).toBe(200);
    expect(status.json().upload.id).toBe(upload.id);
    await app.close();
  });
});
