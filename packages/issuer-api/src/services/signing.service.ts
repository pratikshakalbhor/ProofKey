import type { BuiltCredential, CredentialIssuanceRequest } from '@verishield/shared';
import type { Institution } from '../db/schema.js';
import { decryptSecret, encryptSecret } from '../lib/crypto.js';
import { AppError } from '../lib/errors.js';
import { loadSdk } from '../lib/sdk.js';

/**
 * SigningService — owns the institution's JubJub signing key.
 *
 * The private key is generated once, sealed in an AES-256-GCM envelope and
 * stored as `institutions.encrypted_private_key`. It is only ever unwrapped in
 * memory, immediately before a signing operation.
 *
 * PRODUCTION: replace `encryptSecret`/`decryptSecret` with a real KMS/HSM so the
 * key never leaves the boundary in plaintext. See `lib/crypto.ts`.
 */

export interface GeneratedKeypair {
  encryptedSecret: string;
  publicKey: { x: string; y: string };
}

export async function generateInstitutionKeypair(): Promise<GeneratedKeypair> {
  const sdk = await loadSdk();
  const secret = sdk.randomBytes(32);
  const verifyingKey = sdk.issuerVerifyingKeyFromSecret(secret);
  return {
    encryptedSecret: encryptSecret(secret),
    publicKey: sdk.pointToHex(verifyingKey),
  };
}

/** Fresh 32-byte commitment salt. */
export async function generateSalt(): Promise<Uint8Array> {
  const sdk = await loadSdk();
  return sdk.randomBytes(32);
}

export async function getInstitutionSecret(institution: Institution): Promise<Uint8Array> {  try {
    return new Uint8Array(decryptSecret(institution.encryptedPrivateKey));
  } catch {
    throw AppError.internal(`Signing key for institution "${institution.id}" could not be decrypted`);
  }
}

/**
 * Builds (and signs) a credential without touching the chain. Useful for
 * dry-runs and key verification; issuance goes through `MidnightService`.
 */
export async function buildSignedCredential(
  request: CredentialIssuanceRequest,
  secret: Uint8Array,
): Promise<BuiltCredential> {
  const sdk = await loadSdk();
  return sdk.buildCredential(request, secret);
}

export function describeKeyStatus(institution: Institution): {
  hasKey: boolean;
  algorithm: string;
  encryption: string;
  publicKey: { x: string; y: string };
  anchored: boolean;
  midnightTxId: string | null;
} {
  return {
    hasKey: institution.encryptedPrivateKey.length > 0,
    algorithm: 'JubJub Schnorr (verified in-circuit)',
    encryption: 'AES-256-GCM envelope (demo; KMS/HSM required in production)',
    publicKey: JSON.parse(institution.publicKey) as { x: string; y: string },
    anchored: institution.midnightTxId !== null,
    midnightTxId: institution.midnightTxId,
  };
}
