import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import { verifySession } from '../lib/tokens.js';
import { hasRequiredRole, type Role } from '../types/auth.js';

/** Requires a valid `Authorization: Bearer <jwt>` header. */
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return next(AppError.unauthorized());
  }
  try {
    req.auth = verifySession(header.slice('Bearer '.length).trim());
    next();
  } catch {
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
    next(AppError.unauthorized('Invalid or expired session'));
  }
};

/** Requires at least `required` on the role hierarchy (viewer < registrar < admin). */
export function requireRole(required: Role): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(AppError.unauthorized());
    if (!hasRequiredRole(req.auth.role, required)) {
      return next(AppError.forbidden(`Requires role "${required}" or higher`));
    }
    next();
  };
}
