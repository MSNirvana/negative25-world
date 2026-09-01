import type { FastifyInstance } from 'fastify';

export function registerCors(app: FastifyInstance): void {
  const allowedOrigins = new Set((process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5175,http://127.0.0.1:5175').split(',').map((origin) => origin.trim()).filter(Boolean));
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) return;
    reply.header('access-control-allow-origin', origin);
    reply.header('access-control-allow-credentials', 'true');
    reply.header('access-control-allow-headers', 'authorization, content-type, x-request-id, x-space-slug, x-upload-key, x-expected-byte-size, x-expected-content-type');
    reply.header('access-control-allow-methods', 'GET,HEAD,POST,PATCH,OPTIONS');
    reply.header('vary', 'Origin');
    if (request.method === 'OPTIONS') return reply.code(204).send();
  });
}
