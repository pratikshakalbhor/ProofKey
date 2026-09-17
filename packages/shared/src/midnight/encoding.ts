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
  convertNumericToJubjubScalar,
} from '@midnight-ntwrk/compact-runtime';

const encoder = new TextEncoder();

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
 * Derives a canonical JubJub signing scalar from a 32-byte issuer secret.
 * `convertNumericToJubjubScalar` reduces the value into the scalar field, so
 * the result is always a valid `JubjubScalar` for both off-chain signing and
 * the in-circuit `ecMulGenerator` authority check.
 */
export function signingKeyFromSecret(secret: Uint8Array): bigint {
  return convertNumericToJubjubScalar(bytesToBigIntBE(secret));
}

/**
 * The message signed by the issuer and verified in-circuit: the commitment
 * reinterpreted byte-per-field as a `Vector<32, Field>` (mirrors the
 * `commitment as Vector<32, Field>` cast in the contract).
 */
export function commitmentMessageFields(commitment: Uint8Array): bigint[] {
  return Array.from(commitment, (b) => BigInt(b));
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
