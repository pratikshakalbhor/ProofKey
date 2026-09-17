/**
 * VeriShield registry deployment.
 *
 * Run `pnpm deploy [--network=local|preprod]`. Selects the target network,
 * validates the compiled contract artifacts, connects the local 1AM wallet and
 * deploys the credential registry: the issuer + schema are registered and the
 * resulting deployment manifest (contract address, issuer id, verifying key,
 * schema id) is written to `managed/deploy/<network>.json`.
 *
 * The registration itself is executed by the Midnight circuit simulator driven
 * by the compiled Compact circuits. Because the wallet seed is persisted in
 * `.midnight-wallet-state/`, every deploy for the same wallet + network
 * reproduces the same contract address, issuer id and verifying key — the
 * deterministic starting point the CLI (`pnpm cli`) replays to exercise the
 * full issuer -> holder -> verifier lifecycle without a UI.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { createVeriShield } from '@verishield/shared/sdk';
import type { NetworkConfig } from './network.js';
import { contractAddressFor, describeNetwork, getNetworkConfig } from './network.js';
import { connectWallet, type WalletClient } from './wallet.js';

const CONTRACT_SOURCE = 'packages/contracts/managed/credential-registry/contract/index.js';

export interface DeployManifest {
  network: NetworkConfig['networkId'];
  networkType: NetworkConfig['type'];
  contractAddress: string;
  issuerName: string;
  issuerId: string;
  issuerVerifyingKey: { x: string; y: string };
  schemaName: string;
  schemaId: string;
  coinPublicKey: string;
  deployedAt: number;
  engine: 'circuit-simulator';
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
        'Run `pnpm compile:contracts` first, then retry `pnpm deploy`.',
    );
  }
}

async function probe(config: NetworkConfig): Promise<{ node: boolean; indexer: boolean }> {
  const health: { node: boolean; indexer: boolean } = { node: false, indexer: false };

  try {
    const probeUrl = config.type === 'local' ? `${config.nodeUrl}/health` : config.nodeUrl;
    const body = config.type === 'local' ? undefined : JSON.stringify({ jsonrpc: '2.0', method: 'system_chain', params: [], id: 1 });
    const res = await fetch(probeUrl, { method: 'POST', body, headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(5000) });
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

export async function deployRegistry(options: { network?: string; issuerName?: string; schemaName?: string; wallet?: WalletClient } = {}): Promise<DeployManifest> {
  const config = getNetworkConfig(options.network ? { MIDNIGHT_NETWORK: options.network } : process.env);
  const wallet = options.wallet ?? (await connectWallet());

  console.log(`VeriShield deploy — ${config.label}`);
  console.log(describeNetwork(config));
  requireArtifacts();
  console.log(`  artifacts verified  ${CONTRACT_SOURCE}`);

  const health = await probe(config);
  console.log(
    health.node && health.indexer
      ? '  devnet endpoints    reachable'
      : `  endpoints           node=${health.node ? 'ok' : 'unreachable'} indexer=${health.indexer ? 'ok' : 'unreachable'}` +
          (config.type === 'local' && (!health.node || !health.indexer)
            ? '\n  hint                start the devnet: docker compose up -d'
            : '\n  note                preprod on-chain tx needs a funded wallet; the simulator deploy proceeds'),
  );

  const contractAddress = contractAddressFor(config, wallet.address);
  const vs = await createVeriShield({
    coinPublicKey: wallet.coinPublicKey,
    contractAddress,
    proofServerUrl: config.proofServerUrl,
  });

  const issuerName = options.issuerName ?? process.env.MIDNIGHT_ISSUER_NAME ?? 'University of Midnight';
  const schemaName = options.schemaName ?? process.env.MIDNIGHT_ISSUER_SCHEMA ?? 'BachelorDegree:v1';

  const { issuerId, verifyingKey } = await vs.registerIssuer({
    issuerName,
    secretKey: wallet.seedHex,
  });
  const { schemaId } = await vs.registerSchema({
    schemaName,
    secretKey: wallet.seedHex,
  });

  const manifest: DeployManifest = {
    network: config.networkId,
    networkType: config.type,
    contractAddress,
    issuerName,
    issuerId,
    issuerVerifyingKey: verifyingKey,
    schemaName,
    schemaId,
    coinPublicKey: wallet.coinPublicKey,
    deployedAt: Math.floor(Date.now() / 1000),
    engine: 'circuit-simulator',
    artifacts: CONTRACT_SOURCE,
  };

  await mkdir(join(process.cwd(), 'managed', 'deploy'), { recursive: true });
  const path = manifestPath(config.type);
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`  contract address    ${contractAddress}`);
  console.log(`  issuer              ${issuerId.slice(0, 24)}… (${issuerName})`);
  console.log(`  schema              ${schemaId.slice(0, 24)}… (${schemaName})`);
  console.log(`  manifest            ${path}`);
  return manifest;
}

async function main(): Promise<void> {
  const networkFlag = process.argv.find((a) => a.startsWith('--network='))?.slice('--network='.length);
  const manifest = await deployRegistry({ network: networkFlag });
  console.log(`\nDeploy complete (${manifest.engine}). Next: pnpm cli`);
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}