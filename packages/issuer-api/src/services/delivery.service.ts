import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

/**
 * DeliveryService — one-time claim links / QR codes.
 *
 * A claim token is a short-lived JWT scoped to a single credential and the
 * `credential-claim` purpose. The holder's wallet exchanges it for the full
 * credential material exactly once; after that, everything is local.
 */

const CLAIM_PURPOSE = 'credential-claim';

export interface ClaimTokenPayload {
  credentialId: string;
  institutionId: string;
  purpose: typeof CLAIM_PURPOSE;
}

export function createClaimToken(
  credentialId: string,
  institutionId: string,
  ttlDays = 30,
): { token: string; expiresAt: Date } {
  const token = jwt.sign(
    { credentialId, institutionId, purpose: CLAIM_PURPOSE },
    config.jwt.secret,
    { expiresIn: `${ttlDays}d` as jwt.SignOptions['expiresIn'] },
  );
  const decoded = jwt.decode(token) as { exp: number } | null;
  if (!decoded) throw AppError.internal('Claim token could not be generated');
  return { token, expiresAt: new Date(decoded.exp * 1000) };
}

export function verifyClaimToken(token: string): ClaimTokenPayload {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
  } catch {
    throw AppError.unauthorized('Claim link is invalid or has expired');
  }
  if (decoded.purpose !== CLAIM_PURPOSE) {
    throw AppError.unauthorized('Token is not a credential claim token');
  }
  return {
    credentialId: String(decoded.credentialId),
    institutionId: String(decoded.institutionId),
    purpose: CLAIM_PURPOSE,
  };
}

/** Builds the claim URL the wallet opens. */
export function buildClaimUrl(baseUrl: string, token: string): string {
  const url = new URL('/claim', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function renderQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
    color: { dark: '#0b1220ff', light: '#ffffffff' },
  });
}
