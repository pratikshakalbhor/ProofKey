import type * as VeriShieldSdk from '@verishield/shared/sdk';

export type Sdk = typeof VeriShieldSdk;

let cached: Promise<Sdk> | null = null;

/**
 * Lazily loads the cryptographic SDK from its `./sdk` subpath.
 *
 * The subpath pulls in `@midnight-ntwrk/compact-runtime` (WASM), so it is only
 * imported when a signing / anchoring / proving operation actually runs. The
 * API boot path stays free of WASM.
 */
export function loadSdk(): Promise<Sdk> {
  cached ??= import('@verishield/shared/sdk');
  return cached;
}
