import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../lib/errors.js';

/** Validates `req.body` and replaces it with the parsed value. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(AppError.validation('Invalid request body', result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}

/** Validates `req.query` and stores the parsed value on `req.validatedQuery`. */
export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(AppError.validation('Invalid query parameters', result.error.flatten()));
    }
    req.validatedQuery = result.data;
    next();
  };
}

/** Validates `req.params` and stores the parsed value on `req.validatedParams`. */
export function validateParams(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return next(AppError.validation('Invalid path parameters', result.error.flatten()));
    }
    req.validatedParams = result.data;
    next();
  };
}

export function getQuery<T>(req: Request): T {
  return req.validatedQuery as T;
}

export function getParams<T>(req: Request): T {
  return req.validatedParams as T;
}

export function getBody<T>(req: Request): T {
  return req.body as T;
}
