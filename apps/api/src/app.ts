import Fastify, { type FastifyInstance } from 'fastify';
import { registerRequestId } from './plugins/request-id.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerCors } from './plugins/cors.js';
import { registerRoutes } from './routes.js';

export function buildApp(): FastifyInstance {
  const uploadBodyLimit = Number(process.env.MAX_UPLOAD_BYTES ?? 100 * 1024 * 1024);
  const app = Fastify({ logger: false, bodyLimit: Number.isSafeInteger(uploadBodyLimit) && uploadBodyLimit > 0 ? uploadBodyLimit : 100 * 1024 * 1024 });
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
  registerRequestId(app);
  registerCors(app);
  registerErrorHandler(app);
  app.get('/health', async () => ({ ok: true }));
  app.register(async () => { await registerRoutes(app); });

  return app;
}
