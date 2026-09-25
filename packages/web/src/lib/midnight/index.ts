/**
 * Midnight integration surface for the web app.
 *
 *  - `config.ts`          network + deployed-contract configuration (Preprod)
 *  - `sdk.ts`             lazy loader for `@verishield/shared/sdk` (WASM, code-split)
 *  - `demo.ts`            in-browser circuit-simulator engine (owns private material)
 *  - `wallet.ts`          1AM DApp Connector discovery + v4 sessions (browser-safe)
 *  - `claims.ts`          claim labels/options (browser-safe)
 *  - `indexer.ts`         live Preprod GraphQL indexer client (reads real state)
 *  - `artifacts.ts`       browser registry of compiled circuit artifacts (?url)
 *  - `zk-key-provider.ts` ZK key-material providers for on-chain proving
 *  - `onchain.ts`         real on-chain pipeline: inspect -> unproven tx -> prove /
 *                         balance / submit / indexer-confirm
 *
 * The interactive demo runs against the circuit simulator; the on-chain
 * modules read the REAL deployed Preprod contract and construct real
 * transactions, throwing a precise error whenever a runtime prerequisite
 * (codec, deployment, wallet, provisioning) is missing.
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
export * from './config';
export * from './wallet';
export * from './claims';
export * from './indexer';
export * from './artifacts';
export * from './zk-key-provider';
export * from './onchain';