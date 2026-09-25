/**
 * Browser polyfills required by the Midnight SDK.
 *
 * Several `@midnight-ntwrk/*` packages (e.g. `wallet-sdk-address-format`,
 * `compact-runtime`) call Node.js' global `Buffer` as a free identifier. The
 * browser has no such global, so register the `buffer` package's implementation
 * before any Midnight module runs. This is the officially documented approach
 * for Midnight browser dapps (see docs.midnight.network Browser DApp tutorial).
 *
 * This is loaded as the very first import of the app entry (`main.tsx`). All
 * `Buffer` calls in the SDK happen inside functions executed at runtime (never
 * at module evaluation time), so no SDK code can observe the bare global before
 * this runs.
 *
 * No cryptographic semantics change: the exact same byte arrays flow through.
 */
import { Buffer } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}