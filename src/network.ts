/**
 * Network selection for the VeriShield CLI / deploy tooling.
 *
 * Resolves which Midnight network a deploy or CLI run targets. Only two
 * targets are exposed:
 *
 *   - `local / undeployed` — the compose.yml devnet (node 9944, indexer 8088,
 *     proof server 6300). This is the default.
 *   - `preprod` — the public Midnight preprod endpoints (https/wss). The proof
 *     server is always local (it never leaves your machine), exactly matching
 *     the local devnet setup.
 *
 * Every field can be overridden with `MIDNIGHT_*` env vars so a deployment can
 * point at a private node/indexer without code changes.
 */

import { resolve } from 'node:path';

export const NETWORK_TYPES = ['local', 'preprod'] as const;

export type NetworkType = (typeof NETWORK_TYPES)[number];

/** Midnight network ids as understood by the runtime / Compact toolchain. */
export type MidnightNetworkId = 'undeployed' | 'preview' | 'preprod' | 'mainnet';

export interface NetworkConfig {
  type: NetworkType;
  networkId: MidnightNetworkId;
  label: string;
  /** JSON-RPC HTTP endpoint of the Midnight node. */
  nodeUrl: string;
  /** WebSocket endpoint of the Midnight node. */
  nodeWsUrl: string;
  /** GraphQL HTTP endpoint of the indexer. */
  indexerUrl: string;
  /** GraphQL WebSocket endpoint of the indexer. */
  indexerWsUrl: string;
  /** Proof server. Always local: it handles private witness data. */
  proofServerUrl: string;
}

const DEFAULTS: Record<NetworkType, Omit<NetworkConfig, 'type'>> = {
  local: {
    networkId: 'undeployed',
    label: 'Local Devnet',
    nodeUrl: 'http://localhost:9944',
    nodeWsUrl: 'ws://localhost:9944',
    indexerUrl: 'http://localhost:8089/api/v4/graphql',
    indexerWsUrl: 'ws://localhost:8089/api/v4/graphql/ws',
    proofServerUrl: 'http://localhost:6300',
  },
  preprod: {
    networkId: 'preprod',
    label: 'Midnight Preprod',
    nodeUrl: 'https://rpc.preprod.midnight.network',
    nodeWsUrl: 'wss://rpc.preprod.midnight.network',
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    proofServerUrl: 'http://localhost:6300',
  },
};

export interface EnvLike {
  MIDNIGHT_NETWORK?: string;
  MIDNIGHT_NODE_URL?: string;
  MIDNIGHT_NODE_WS_URL?: string;
  MIDNIGHT_INDEXER_URL?: string;
  MIDNIGHT_INDEXER_WS_URL?: string;
  MIDNIGHT_PROOF_SERVER_URL?: string;
  [key: string]: string | undefined;
}

/** Parses `MIDNIGHT_NETWORK`: `undeployed`/`local` -> local, `preprod` -> preprod. */
export function getNetworkType(env: EnvLike = process.env): NetworkType {
  const raw = (env.MIDNIGHT_NETWORK ?? 'local').toLowerCase();
  if (raw === 'undeployed' || raw === 'local') return 'local';
  if (raw === 'preprod') return 'preprod';
  throw new Error(
    `Unsupported MIDNIGHT_NETWORK "${env.MIDNIGHT_NETWORK}". Expected one of: local, undeployed, preprod.`,
  );
}

/** Full network config for the selected target, with env overrides applied. */
export function getNetworkConfig(env: EnvLike = process.env): NetworkConfig {
  const type = getNetworkType(env);
  const base = DEFAULTS[type];
  return {
    type,
    ...base,
    nodeUrl: env.MIDNIGHT_NODE_URL ?? base.nodeUrl,
    nodeWsUrl: env.MIDNIGHT_NODE_WS_URL ?? base.nodeWsUrl,
    indexerUrl: env.MIDNIGHT_INDEXER_URL ?? base.indexerUrl,
    indexerWsUrl: env.MIDNIGHT_INDEXER_WS_URL ?? base.indexerWsUrl,
    proofServerUrl: env.MIDNIGHT_PROOF_SERVER_URL ?? base.proofServerUrl,
  };
}

/**
 * Midnight protocol hard-fork boundary (ledger v8 → v9). Nodes report their
 * `specVersion` via `state_getRuntimeVersion`.
 *
 * This is the preprod-v8-compat branch: the compiled contract targets ledger
 * v8 (`ledger-8.0.2`, Compact 0.31.1), which is exactly what preprod runs
 * today (`specVersion 1000300`, verified live via `state_getRuntimeVersion` on
 * 2026-09-22). The boundary therefore marks the point at
 * which the CURRENT branch's contract becomes NON-deployable: once a network
 * reports `specVersion >= 2000000` it has forked to v9 and this v8 contract
 * no longer applies (the v9 in-circuit variant lives on the `main` branch).
 */
export const LEDGER9_FORK_SPEC_VERSION = 2_000_000;

/** Reads the node's `state_getRuntimeVersion.specVersion`, or `undefined` when unreachable. */
export async function fetchSpecVersion(nodeUrl: string): Promise<number | undefined> {
  try {
    const res = await fetch(nodeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'state_getRuntimeVersion', params: [] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { result?: { specVersion?: number } };
    return json.result?.specVersion;
  } catch {
    return undefined;
  }
}

/**
 * Midnight providers environment object (the shape `FluentWalletBuilder` /
 * `initializeMidnightProviders` from `@midnight-ntwrk/testkit-js` expect),
 * derived from a {@link NetworkConfig}.
 */
export function midnightProvidersEnv(config: NetworkConfig): Record<string, string> {
  return {
    walletNetworkId: config.networkId,
    networkId: config.networkId,
    indexer: config.indexerUrl,
    indexerWS: config.indexerWsUrl,
    node: config.nodeUrl,
    nodeWS: config.nodeWsUrl,
    proofServer: config.proofServerUrl,
    faucet: config.nodeUrl,
  };
}

export function describeNetwork(config: NetworkConfig): string {
  return [
    `  target          ${config.label} (${config.networkId})`,
    `  node            ${config.nodeUrl}`,
    `  node (ws)       ${config.nodeWsUrl}`,
    `  indexer         ${config.indexerUrl}`,
    `  indexer (ws)    ${config.indexerWsUrl}`,
    `  proof server    ${config.proofServerUrl}`,
  ].join('\n');
}

/**
 * Deterministic registry contract address for a (network, wallet) pair. The
 * deployment / CLI tools replay the same ledger across processes, so the
 * address must be stable rather than randomly sampled on every run.
 */
export function contractAddressFor(config: NetworkConfig, walletAddress: string): string {
  let hex = '';
  for (const byte of new TextEncoder().encode(`verishield:contract:${config.networkId}:${walletAddress}`)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex.slice(0, 64).padEnd(64, '0');
}

async function main(): Promise<void> {
  const config = getNetworkConfig();
  console.log(`VeriShield network selection (MIDNIGHT_NETWORK=${config.type})`);
  console.log(describeNetwork(config));
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

function isMain(moduleUrl: string): boolean {
  return resolve(process.argv[1] ?? '') === decodeURIComponent(new URL(moduleUrl).pathname);
}