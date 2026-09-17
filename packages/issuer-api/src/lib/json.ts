/**
 * JSON helpers for values that cross the SDK boundary.
 *
 * Credential signatures contain `bigint`, which `JSON.stringify` refuses to
 * encode. We tag bigints so the value round-trips losslessly between the
 * issuer's database and the holder's wallet.
 */

const BIGINT_TAG = '$bigint';

export function stringifyBigInts(value: unknown): string {
  return JSON.stringify(value, (_key, val) =>
    typeof val === 'bigint' ? { [BIGINT_TAG]: val.toString() } : val,
  );
}

export function parseBigInts<T = unknown>(text: string): T {
  return JSON.parse(text, (_key, val) => {
    if (val && typeof val === 'object' && typeof (val as Record<string, unknown>)[BIGINT_TAG] === 'string') {
      return BigInt((val as Record<string, string>)[BIGINT_TAG]);
    }
    return val;
  }) as T;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '');
  if (clean.length % 2 !== 0) throw new Error('Hex string must have an even length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
