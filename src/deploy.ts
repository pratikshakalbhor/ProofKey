/**
 * VeriShield registry deployment (real ledger-v9 tx).
 *
 * Run `pnpm run deploy [--network=local|preprod]`.
 *
 * For `local / undeployed` this builds a REAL deploy transaction from the
 * compiled contract artifacts, proves it with the real proof server
 * (9.0.0-rc.7), balances it with a real wallet (genesis mint wallet on the
 * current-era devnet: node 2.1.0-beta.1) and submits it to the real node via
 * `submitTxAsync` — which, unlike `submitTx`, does not wait on indexer reads
 * (the public indexer image cannot re-apply the deploy's dust spend — see
 * README "Known Simulations"). The result manifest (`managed/deploy/local.json`)
 * carries the REAL on-chain contract address + deploy tx id, clearly separated
 * from the simulator anchor (`src/network.ts#contractAddressFor`) and from the
 * (still TBD) Preprod address.
 *
 * For `preprod`, the command refuses to broadcast while the network is still
 * pre-fork (ledger v8): our contract compiles against v9, so a preprod deploy
 * can only run once the v9 fork activates there. No manifest is written.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { hashLabel, toHex } from '@verishield/shared/sdk';
import { connectDeployWallet, submitRealDeploy } from '@verishield/deploy-tools';
import type { NetworkConfig } from './network.js';
import {
  describeNetwork,
  fetchSpecVersion,
  getNetworkConfig,
  LEDGER9_FORK_SPEC_VERSION,
} from './network.js';

const CONTRACT_ARTIFACTS = 'packages/contracts/managed/credential-registry';
const CONTRACT_SOURCE = `${CONTRACT_ARTIFACTS}/contract/index.js`;

export interface DeployManifest {
  status: 'deployed' | 'blocked';
  network: NetworkConfig['networkId'];
  networkType: NetworkConfig['type'];
  /** REAL on-chain contract address (from the accepted deploy tx). */
  contractAddress: string;
  deployTxId: string;
  specVersion?: number;
  issuerName: string;
  schemaName: string;
  issuerId: string;
  schemaId: string;
  /** Registration calls are pending the indexer read-path fix (see README). */
  registrationOnChain: boolean;
  coinPublicKey: string;
  deployedAt: number;
  engine: 'real-deploy' | 'circuit-simulator';
  artifacts: string;
}

function manifestPath(type: string): string {
  return resolve(join(process.cwd(), 'managed', 'deploy', `${type}.json`));
}

function requireArtifacts(): void {
  const artifact = resolve(join(process.cwd(), CONTRACT_SOURCE));
  if (!existsSync(artifact)) {
    throw new Error(
      `Compiled contract artifacts not found at ${artifact}.\n` +
        'Run `pnpm compile:contracts` first (Compact 0.34.0 / ledger-v9), then retry `pnpm run deploy`.',
    );
  }
}

async function probe(config: NetworkConfig): Promise<{ node: boolean; indexer: boolean }> {
  const health: { node: boolean; indexer: boolean } = { node: false, indexer: false };

  try {
    const res = await fetch(config.nodeUrl, {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', method: 'system_chain', params: [], id: 1 }),
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    health.node = res.ok;
  } catch {
    health.node = false;
  }

  try {
    const res = await fetch(config.indexerUrl, {
      method: 'POST',
      body: JSON.stringify({ query: '{ __typename }' }),
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    health.indexer = res.ok;
  } catch {
    health.indexer = false;
  }

  return health;
}

/**
 * Refuses to broadcast a v9 deploy against a pre-fork network. Today preprod is
 * still ledger v8 (`specVersion 1000000 < 2000000`), so this always blocks —
 * that is a network-level condition, not a code bug. Post-fork it continues.
 */
async function assertNetworkDeployable(config: NetworkConfig): Promise<void> {
  if (config.type === 'local') return;
  const spec = await fetchSpecVersion(config.nodeUrl);
  if (spec === undefined) {
    throw new Error(`Preprod node unreachable at ${config.nodeUrl} — cannot check fork status.`);
  }
  if (spec < LEDGER9_FORK_SPEC_VERSION) {
    throw new Error(
      `\nPreprod deploy BLOCKED — network-level fork-timing mismatch (outside our control).\n` +
        `  Preprod still runs ledger v8 (specVersion ${spec}); the compiled contract targets ledger v9\n` +
        `  (Compact 0.34.0). The v9 hard fork was staged on 2026-08-21 but is not activated yet;\n` +
        `  no activation date/block has been announced.\n\n` +
        `  The deploy path itself is fully real and working — proven on a local ledger-v9 devnet\n` +
        `  (real node 2.1.0-beta.1 + proof server 9.0.0-rc.7; tx included in a real block; see\n` +
        `  README "Known Simulations" and doc/evidence/). It will deploy to Preprod the moment\n` +
        `  the fork lands, provided the wallet is funded (https://faucet.preprod.midnight.network).\n` +
        `  Nothing has been submitted; no manifest was written.`,
    );
  }
}

export async function deployRegistry(options: { network?: string; issuerName?: string; schemaName?: string } = {}): Promise<DeployManifest> {
  const config = getNetworkConfig(options.network ? { MIDNIGHT_NETWORK: options.network } : process.env);
  console.log(`VeriShield deploy — ${config.label}`);
  console.log(describeNetwork(config));

  await assertNetworkDeployable(config);

  requireArtifacts();
  console.log(`  artifacts verified  ${CONTRACT_SOURCE}`);

  const health = await probe(config);
  console.log(
    health.node
      ? '  devnet node         reachable'
      : `  devnet node         unreachable (${config.nodeUrl})`,
  );
  if (!health.indexer) {
    console.log(
      '  indexer             unreachable (expected on this build once a deploy lands; the deploy\n' +
        '                        path uses submitTxAsync and does not depend on indexer reads)',
    );
  }

  const deployWallet = await connectDeployWallet(config);
  console.log(`  wallet              started (coin pub key ${deployWallet.coinPublicKey.slice(0, 16)}…)`);
  console.log('  creating deploy tx + proving + balancing + submitting…');

  const { contractAddress, deployTxId } = await submitRealDeploy(config, deployWallet);

  const issuerName = options.issuerName ?? process.env.MIDNIGHT_ISSUER_NAME ?? 'University of Midnight';
  const schemaName = options.schemaName ?? process.env.MIDNIGHT_ISSUER_SCHEMA ?? 'BachelorDegree:v1';
  const specVersion = await fetchSpecVersion(config.nodeUrl);

  const manifest: DeployManifest = {
    status: 'deployed',
    network: config.networkId,
    networkType: config.type,
    contractAddress,
    deployTxId,
    specVersion,
    issuerName,
    schemaName,
    issuerId: toHex(hashLabel(`issuer:${issuerName}`)),
    schemaId: toHex(hashLabel(`schema:${schemaName}`)),
    registrationOnChain: false,
    coinPublicKey: deployWallet.coinPublicKey,
    deployedAt: Math.floor(Date.now() / 1000),
    engine: 'real-deploy',
    artifacts: CONTRACT_SOURCE,
  };

  await mkdir(join(process.cwd(), 'managed', 'deploy'), { recursive: true });
  const path = manifestPath(config.type);
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`  contract address    ${contractAddress}  (local ledger-v9 devnet)`);
  console.log(`  deploy tx id        ${deployTxId}`);
  console.log(`  spec version        ${specVersion}`);
  console.log(`  manifest            ${path}`);
  console.log('');
  console.log(
    '  NOTE — issuer/schema registration is NOT executed on-chain yet: it needs indexer reads\n' +
      `  (registerIssuer/registerSchema), which are blocked by the public indexer image\n` +
      `  (4.4.0-rc.2 cannot re-apply the deploy's dust spend; the fix exists only in a private\n` +
      `  GHCR build). Registration will run the moment the read path is unblocked.\n` +
      `  Preprod remains blocked until the v9 fork activates (see README "Known Simulations").\n`,
  );
  return manifest;
}

async function main(): Promise<void> {
  const networkFlag = process.argv.find((a) => a.startsWith('--network='))?.slice('--network='.length);
  const manifest = await deployRegistry({ network: networkFlag });
  console.log(`\nDeploy complete (${manifest.engine}). Next: pnpm cli`);
  // The wallet SDK keeps background fibers alive (PendingTransactionsService
  // polls the (indexer-limited) transaction state after the tx is submitted).
  // The deploy tx is already handed to the node, so exit explicitly.
  process.exit(0);
}

function isMain(moduleUrl: string): boolean {
  return resolve(process.argv[1] ?? '') === decodeURIComponent(new URL(moduleUrl).pathname);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}