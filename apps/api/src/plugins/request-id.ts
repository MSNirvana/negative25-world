import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export function registerRequestId(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const requestId = request.headers['x-request-id']?.toString() || randomUUID();
    request.id = requestId;
    reply.header('x-request-id', requestId);
  });
}
