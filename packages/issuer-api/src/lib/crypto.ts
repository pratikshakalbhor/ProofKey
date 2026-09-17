import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';

/**
 * Envelope encryption for the institution signing key.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ DEMO ONLY. This is AES-256-GCM with a key read from the environment.   │
 * │ Production MUST replace this with a real KMS/HSM (AWS KMS, GCP KMS,    │
 * │ HashiCorp Vault Transit, …): generate/never-export the key material    │
 * │ there, keep only a key id here, and call the KMS for sign operations.  │
 * │ Do NOT ship this file's key handling to production.                    │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * The envelope is stored as JSON so it can live in the `encrypted_private_key`
 * TEXT column and be rotated by bumping `v`.
 */

const ALG = 'aes-256-gcm';
const VERSION = 1;

interface KeyEnvelope {
  v: number;
  alg: string;
  iv: string;
  tag: string;
  ct: string;
}

export function encryptSecret(plaintext: Uint8Array): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, config.encryptionKey, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: KeyEnvelope = {
    v: VERSION,
    alg: ALG,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64'),
  };
  return JSON.stringify(envelope);
}

export function decryptSecret(envelopeJson: string): Buffer {
  let envelope: KeyEnvelope;
  try {
    envelope = JSON.parse(envelopeJson) as KeyEnvelope;
  } catch {
    throw new Error('Malformed key envelope');
  }
  if (envelope.v !== VERSION || envelope.alg !== ALG) {
    throw new Error(`Unsupported key envelope v${envelope.v} (${envelope.alg})`);
  }
  const decipher = createDecipheriv(ALG, config.encryptionKey, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ct, 'base64')), decipher.final()]);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.bcryptRounds);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
