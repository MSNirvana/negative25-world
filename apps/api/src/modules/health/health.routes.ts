import type { FastifyInstance } from 'fastify';

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/api/v1/health', async () => ({ ok: true, services: { api: 'ok', database: 'not-configured', redis: 'not-configured', storage: 'not-configured' } }));
}
