import { ZodError } from 'zod';
import type { FastifyInstance } from 'fastify';
import { ApiError, errorResponse } from '@negative25/utils';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.status(400).send(errorResponse(new ApiError('VALIDATION_ERROR', 'Request validation failed', error.flatten()), request.id));
    if (error instanceof ApiError) return reply.status(error.code === 'UNAUTHORIZED' ? 401 : error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 400).send(errorResponse(error, request.id));
    request.log.error(error);
    return reply.status(500).send(errorResponse(new ApiError('INTERNAL_ERROR', 'Internal server error'), request.id));
  });
}
