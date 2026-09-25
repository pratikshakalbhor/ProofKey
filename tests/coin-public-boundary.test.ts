/**
 * Regression tests for the `coinPublic` string/bytes boundary.
 *
 * The on-chain call flow previously decoded the wallet's Bech32m Zswap keys to
 * raw bytes (`Uint8Array`) and handed them to the Midnight SDK. The SDK's
 * contract runtime validates `coinPublic` as a Hex/Bech32m STRING and threw:
 *
 *   Invalid data at keys.coinPublic: Expected string, actual Uint8Array
 *
 * These tests pin the fix at the exact SDK boundary:
 *
 *  1. the value passed forward is the wallet's Bech32m string (never decoded);
 *  2. feeding that string through the SDK's own parse functions
 *     (`parseCoinPublicKeyToHex` / `parseEncPublicKeyToHex` — the exact
 *     conversions midnight-js-contracts applies to the supplied keys)
 *     reproduces the original 32-byte key byte-for-byte.
 */

import { describe, expect, it } from 'vitest';
import {
  parseCoinPublicKeyToHex,
  parseEncPublicKeyToHex,
} from '@midnight-ntwrk/midnight-js-utils';
import {
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import { walletShieldedKeys } from '../packages/web/src/lib/midnight/onchain';

// Deterministic 32-byte test keys (fixed hex, not real secrets).
const COIN_PUBLIC_HEX = '9f2c4a1d7b3e5086ac91d42f6b8e07c5d3a41f928b6c0e7d5a3f1902c8b4e6a1';
const ENC_PUBLIC_HEX = '0acd13e95f7b2a64d08c315e7fa294b6d1c05e8f3a7b26d490f15e8c3b7a24d1';

const HEX64 = /^[0-9a-f]{64}$/;

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(
    Array.from({ length: hex.length / 2 }, (_, i) => Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)),
  );
}

/** The exact Bech32m form the 1AM/DApp Connector returns from getShieldedAddresses(). */
function shieldedCoinPublicKeyString(hex: string): string {
  return ShieldedCoinPublicKey.codec
    .encode('preprod', new ShieldedCoinPublicKey(hexToBytes(hex)))
    .toString();
}

/** The exact Bech32m form the 1AM/DApp Connector returns from getShieldedAddresses(). */
function shieldedEncryptionPublicKeyString(hex: string): string {
  return ShieldedEncryptionPublicKey.codec
    .encode('preprod', new ShieldedEncryptionPublicKey(hexToBytes(hex)))
    .toString();
}

describe('coinPublic type boundary (buildUnprovenCallTx → Midnight SDK)', () => {
  const cpkAddress = shieldedCoinPublicKeyString(COIN_PUBLIC_HEX);
  const epkAddress = shieldedEncryptionPublicKeyString(ENC_PUBLIC_HEX);

  it('passes the wallet Zswap keys on as Bech32m strings, not Uint8Array', () => {
    const keys = walletShieldedKeys({
      shieldedCoinPublicKey: cpkAddress,
      shieldedEncryptionPublicKey: epkAddress,
    });

    expect(typeof keys.coinPublicKey).toBe('string');
    expect(typeof keys.walletEncryptionPublicKey).toBe('string');
    expect(keys.coinPublicKey).not.toBeInstanceOf(Uint8Array);
    expect(keys.walletEncryptionPublicKey).not.toBeInstanceOf(Uint8Array);

    // Passed through byte-identically: no re-encoding, no JSON stringify.
    expect(keys.coinPublicKey).toBe(cpkAddress);
    expect(keys.walletEncryptionPublicKey).toBe(epkAddress);
  });

  it('reproduces the exact 32-byte coin public key through the SDK boundary', () => {
    // midnight-js-contracts consumes our value with parseCoinPublicKeyToHex.
    expect(parseCoinPublicKeyToHex(cpkAddress, 'preprod')).toBe(COIN_PUBLIC_HEX);
    expect(parseCoinPublicKeyToHex(cpkAddress, 'preprod')).toMatch(HEX64);
  });

  it('reproduces the exact 32-byte encryption public key through the SDK boundary', () => {
    // The encryption resolver consumes our value with parseEncPublicKeyToHex.
    expect(parseEncPublicKeyToHex(epkAddress, 'preprod')).toBe(ENC_PUBLIC_HEX);
    expect(parseEncPublicKeyToHex(epkAddress, 'preprod')).toMatch(HEX64);
  });

  it('the SDK boundary accepts Bech32m strings as the expected type', () => {
    // What the runtime Effect config requires: a Hex or Bech32m string.
    expect(parseCoinPublicKeyToHex(cpkAddress, 'preprod')).toBeTypeOf('string');
    expect(parseEncPublicKeyToHex(epkAddress, 'preprod')).toBeTypeOf('string');
  });
});