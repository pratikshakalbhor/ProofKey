import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { SessionClaims } from '../types/auth.js';

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifySession(token: string): SessionClaims {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (typeof decoded === 'string') throw new Error('Malformed token payload');
  return {
    sub: String(decoded.sub),
    institutionId: String((decoded as Record<string, unknown>).institutionId),
    role: (decoded as Record<string, unknown>).role as SessionClaims['role'],
    email: String((decoded as Record<string, unknown>).email),
  };
}
