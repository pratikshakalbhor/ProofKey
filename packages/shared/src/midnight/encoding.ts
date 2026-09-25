/**
 * Browser-safe encoding helpers.
 *
 * Hashing goes through `@midnight-ntwrk/compact-runtime`'s `persistentHash`
 * so that every off-chain derivation uses exactly the same construction as
 * the Compact circuits. That means no `node:crypto` and no duplicated hash
 * implementations.
 */

import {
  persistentHash,
  CompactTypeBytes,
} from '@midnight-ntwrk/compact-runtime';

const encoder = new TextEncoder();

/**
 * The Compact `Field` modulus used by the ledger-v8 runtime circuits
 * (revealed by `ecMulGenerator`/`bigIntToValue` decode bounds and
 * `bigIntModFr` validation): the ~252-bit prime
 * `0xe7db4ea6533afa906673b0101343b00a6682093ccc81082d0970e5ed6f72cb7`.
 * `compact-runtime.bigIntModFr` only *validates* (it rejects inputs at or
 * above this modulus) — it never reduces — so a 256-bit issuer secret must be
 * reduced into the field explicitly before it can be used as a scalar.
 */
export const FIELD_MODULUS: bigint =
  0xe7db4ea6533afa906673b0101343b00a6682093ccc81082d0970e5ed6f72cb7n;

/** Canonical byte length for all on-chain commitments and digests. */
export const BYTES_32 = 32;

export function utf8(value: string): Uint8Array {
  return encoder.encode(value);
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error(`Invalid hex length: ${clean.length}`);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Hashes arbitrary bytes to a 32-byte digest using the circuit hash. */
export function hashBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) throw new Error('hashBytes: empty input');
  return persistentHash(new CompactTypeBytes(bytes.length), bytes);
}

/** Hashes a UTF-8 label to a deterministic 32-byte identifier. */
export function hashLabel(label: string): Uint8Array {
  return hashBytes(utf8(`verishield:${label}`));
}

/**
 * Encodes a short string into a fixed `Bytes<32>` field: UTF-8 bytes,
 * zero-padded on the right, rejected if it does not fit.
 */
export function encodeField(value: string): Uint8Array {
  const bytes = utf8(value);
  if (bytes.length > BYTES_32) {
    throw new Error(`encodeField: "${value}" exceeds ${BYTES_32} bytes`);
  }
  const out = new Uint8Array(BYTES_32);
  out.set(bytes, 0);
  return out;
}

/** Reads a zero-padded `Bytes<32>` field back into a string. */
export function decodeField(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end -= 1;
  return new TextDecoder().decode(bytes.subarray(0, end));
}

/** Big-endian interpretation of a byte string as an integer. */
export function bytesToBigIntBE(bytes: Uint8Array): bigint {
  let out = 0n;
  for (const b of bytes) out = (out << 8n) | BigInt(b);
  return out;
}

/**
 * Derives the canonical scalar from a 32-byte issuer secret.
 * Reduces the value into the circuit's `Field` (`% FIELD_MODULUS`), so the
 * result is always a valid scalar for both the off-chain `ecMulGenerator`
 * verifying-key derivation and the on-chain `issuerSigningKey()` witness that
 * the ledger-level authority check uses (identical op: `ecMulGenerator(sk)`).
 */
export function signingKeyFromSecret(secret: Uint8Array): bigint {
  return bytesToBigIntBE(secret) % FIELD_MODULUS;
}

/** Hex-encodes a JubJub point for JSON / UI display. */
export function pointToHex(point: { x: bigint; y: bigint }): { x: string; y: string } {
  const hex = (v: bigint) => v.toString(16).padStart(64, '0');
  return { x: hex(point.x), y: hex(point.y) };
}

/** Cryptographically secure random bytes (works in Node and the browser). */
export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** Coerces a `Uint8Array`-like value returned by the runtime. */
export function asBytes32(value: Uint8Array, label = 'value'): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== BYTES_32) {
    throw new Error(`${label}: expected Uint8Array(${BYTES_32})`);
  }
  return value;
}

/** Accepts a unix-seconds number, an ISO string, or a Date. */
export function toUnixSeconds(value: number | string | Date): number {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === 'number') return Math.floor(value);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`toUnixSeconds: invalid date "${value}"`);
  return Math.floor(parsed / 1000);
}

export function equalsBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
