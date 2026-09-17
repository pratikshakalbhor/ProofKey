/**
 * Lazy loader for the VeriShield cryptographic SDK.
 *
 * `@verishield/shared/sdk` bundles the Midnight onchain-runtime WASM, so it is
 * never imported statically from the app shell. Every consumer goes through
 * this module, which imports once and caches the same module instance for the
 * lifetime of the page.
 *
 * Type-only imports are erased at build time, so they never pull the runtime
 * into the main bundle.
 */

import type * as VeriShieldSdk from '@verishield/shared/sdk';

let sdkPromise: Promise<typeof VeriShieldSdk> | null = null;

export function loadVeriShieldSdk(): Promise<typeof VeriShieldSdk> {
  sdkPromise ??= import('@verishield/shared/sdk');
  return sdkPromise;
}
