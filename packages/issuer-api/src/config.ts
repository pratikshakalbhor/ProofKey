import 'dotenv/config';
import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * Environment configuration, validated once at boot.
 *
 * Security note: in production every secret below (JWT_SECRET,
 * KEY_ENCRYPTION_KEY) must be supplied by a real secret manager / HSM. The
 * fallbacks here exist only so the hackathon demo boots with zero setup, and
 * emit loud warnings when used.
 */

const HEX_32 = /^[0-9a-fA-F]{64}$/;

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_PATH: z.string().default('./data/issuer.sqlite'),
  JWT_SECRET: z.string().min(16).default('verishield-dev-jwt-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  KEY_ENCRYPTION_KEY: z.string().optional(),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  NETWORK_ID: z.enum(['undeployed', 'preview', 'preprod', 'mainnet']).default('undeployed'),
  /** Deployed credential-registry address. Empty => in-memory simulator address. */
  CONTRACT_ADDRESS: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] invalid environment:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}
const env = parsed.data;

const isProd = env.NODE_ENV === 'production';

if (!HEX_32.test(env.JWT_SECRET) && env.JWT_SECRET === 'verishield-dev-jwt-secret-change-me') {
  console.warn('[config] using the default JWT_SECRET — set a real one before deploying');
}

/**
 * Derives the 32-byte AES key. Production: fetch from KMS/HSM. Here we accept a
 * 64-char hex or base64 key; otherwise derive one from JWT_SECRET so the demo
 * still runs (with a warning).
 */
function resolveEncryptionKey(): Buffer {
  const raw = env.KEY_ENCRYPTION_KEY?.trim();
  if (raw) {
    if (HEX_32.test(raw)) return Buffer.from(raw, 'hex');
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === 32) return b64;
    throw new Error('KEY_ENCRYPTION_KEY must be 32 bytes as hex (64 chars) or base64');
  }
  console.warn('[config] KEY_ENCRYPTION_KEY unset — deriving a demo key from JWT_SECRET');
  return createHash('sha256').update(`verishield:kek:${env.JWT_SECRET}`).digest();
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isProd,
  port: env.PORT,
  databasePath: env.DATABASE_PATH,
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  encryptionKey: resolveEncryptionKey(),
  bcryptRounds: env.BCRYPT_ROUNDS,
  networkId: env.NETWORK_ID,
  contractAddress: env.CONTRACT_ADDRESS,
  corsOrigin: env.CORS_ORIGIN,
  authRateLimit: {
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
  },
} as const;

export type AppConfig = typeof config;
