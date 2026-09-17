/**
 * Shared types and constants.
 *
 * This entry point is DOM/browser-safe and has NO Midnight runtime
 * dependency, so it can be imported by the web app without pulling in the
 * onchain-runtime WASM. Import the cryptographic SDK from the `sdk` subpath:
 *
 *   import { createVeriShield } from '@verishield/shared/sdk';
 */

export * from './types';
export * from './constants';
export * from './midnight/serialization.js';
