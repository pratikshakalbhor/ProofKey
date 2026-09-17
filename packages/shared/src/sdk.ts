/**
 * Cryptographic SDK entry point.
 *
 * Loads `@midnight-ntwrk/compact-runtime` (which bundles the onchain-runtime
 * WASM), so it is published as a separate subpath and must be imported
 * explicitly:
 *
 *   import { createVeriShield } from '@verishield/shared/sdk';
 *
 * Bundlers that target the browser need WASM support (e.g. `vite-plugin-wasm`)
 * when consuming this entry point. The Node e2e harness consumes it directly.
 */

export * from './midnight/index.js';
