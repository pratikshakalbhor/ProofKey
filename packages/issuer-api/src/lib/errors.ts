/**
 * Application error type + the consistent error envelope:
 *   { error: { code, message, details } }
 */

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'UPSTREAM_ERROR',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static validation(message = 'Request validation failed', details?: unknown): AppError {
    return new AppError(422, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Insufficient permissions'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(409, 'CONFLICT', message, details);
  }

  static upstream(message: string, details?: unknown): AppError {
    return new AppError(502, 'UPSTREAM_ERROR', message, details);
  }

  static internal(message = 'Internal server error', details?: unknown): AppError {
    return new AppError(500, 'INTERNAL', message, details);
  }

  toEnvelope(): ErrorEnvelope {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

export function toErrorEnvelope(error: unknown): { status: number; body: ErrorEnvelope } {
  if (error instanceof AppError) {
    return { status: error.status, body: error.toEnvelope() };
  }
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return { status: 500, body: { error: { code: 'INTERNAL', message } } };
}
