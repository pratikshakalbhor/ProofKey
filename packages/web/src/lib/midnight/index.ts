/**
 * Midnight integration surface for the web app.
 *
 *  - `sdk.ts`      lazy loader for `@verishield/shared/sdk` (WASM, code-split)
 *  - `demo.ts`     in-browser circuit-simulator engine (owns private material)
 *  - `wallet.ts`   1AM DApp Connector discovery + helpers (browser-safe)
 *  - `claims.ts`   claim labels/options (browser-safe)
 *
 * The real on-chain path (indexer reads, proof server) is intentionally not
 * wired yet: the local devnet is deferred and the demo runs against the
 * circuit simulator. See the Phase 3 notes in the README.
 */

export { loadVeriShieldSdk } from './sdk';
export { getDemoEngine } from './demo';
export type {
  DemoEngine,
  DemoIssuerInfo,
  HolderCredentialView,
  NewCredentialInput,
  PublicLedgerState,
} from './demo';
export * from './wallet';
export * from './claims';

export interface MidnightNetworkConfig {
  networkId: 'undeployed' | 'preview' | 'preprod' | 'mainnet';
  indexerUrl: string;
  indexerWsUrl: string;
  nodeUrl: string;
  proofServerUrl: string;
}

/** Expected local devnet endpoints (deferred — not started by the demo). */
export const LOCAL_DEVNET: MidnightNetworkConfig = {
  networkId: 'undeployed',
  indexerUrl: 'http://localhost:8088/api/v4/graphql',
  indexerWsUrl: 'ws://localhost:8088/api/v4/graphql/ws',
  nodeUrl: 'http://localhost:9944',
  proofServerUrl: 'http://localhost:6300',
};
