import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, toErrorEnvelope } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
};

/**
 * Terminal error handler. Always emits the shared envelope:
 *   { error: { code, message, details } }
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Body-parser surfaces malformed JSON as a 400 SyntaxError.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' },
    });
    return;
  }

  const { status, body } = toErrorEnvelope(err);
  if (status >= 500 && !(err instanceof AppError)) {
    console.error('[error]', err);
  }
  res.status(status).json(body);
};
