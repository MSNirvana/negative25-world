export type ApiErrorCode = string;
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}
export function errorResponse(error: ApiError | Error, requestId: string) {
  const apiError = error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR', error.message);
  return { error: { code: apiError.code, message: apiError.message, ...(apiError.details === undefined ? {} : { details: apiError.details }) }, requestId };
}
