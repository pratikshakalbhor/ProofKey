import type { SessionClaims } from './auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: SessionClaims;
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

export {};
