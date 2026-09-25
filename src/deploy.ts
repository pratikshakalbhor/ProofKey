/**
 * VeriShield registry deployment (real ledger-v8 tx — preprod-v8-compat branch).
 *
 * Run `npm run deploy -- --network=local|preprod`.
 *
 * For `local / undeployed` this builds a REAL deploy transaction from the
 * compiled contract artifacts, proves it with the real proof server
 * (ledger-v8 image), balances it with a real wallet (genesis mint wallet on
 * the v8 devnet) and submits it to the real node via `submitTxAsync` — which,
 * unlike `submitTx`, does not wait on indexer reads (the public indexer image
 * cannot re-apply the deploy's dust spend — see README "Known Simulations").
 * The result manifest (`managed/deploy/local.json`) carries the REAL on-chain
 * contract address + deploy tx id, clearly separated from the simulator anchor
 * (`src/network.ts#contractAddressFor`).
 *
 * For `preprod` the contract is compatible TODAY (preprod still runs ledger
 * v8, `specVersion 1000000`), so the v8 network-level block no longer applies.
 * Broadcasting real funds still requires an explicit opt-in
 * (`MIDNIGHT_PREPROD_DEPLOY_CONFIRM=yes`) — this session stops at the
 * green-that-ready state and reports back before anyone broadcasts. No
 * manifest is written until a deploy actually lands.
 */

import 'dotenv/config';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { firstValueFrom } from 'rxjs';

import { hashLabel, toHex } from '@verishield/shared/sdk';
import {
  buildPreflightDeployTx,
  connectDeployWallet,
  connectDeployWalletRestored,
  submitRealDeploy,
  submitRealDeployChecked,
} from '@verishield/deploy-tools';
import type { DeployWallet } from '@verishield/deploy-tools';
import type { NetworkConfig } from './network.js';
import {
  describeNetwork,
  fetchSpecVersion,
  getNetworkConfig,
  LEDGER9_FORK_SPEC_VERSION,
} from './network.js';

const CONTRACT_ARTIFACTS = 'packages/contracts/managed/credential-registry';
const CONTRACT_SOURCE = `${CONTRACT_ARTIFACTS}/contract/index.js`;

/** Official Preprod endpoints — a deployment must point at these (gate: not local/Preview). */
const PREPROD_NODE_URL = 'https://rpc.preprod.midnight.network';
const PREPROD_INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v4/graphql';

/** The local-devnet contract address that must NOT be the Preprod deploy target. */
const LOCAL_DEVNET_CONTRACT = 'b72da755eea42269a7d21853c42e2c3b630f78fec8d3712d93b4a4bb66e08499';

/** The funded Preprod wallet this branch is allowed to deploy from (gate 1). */
const PREPROD_EXPECTED_ADDRESS = 'mn_addr_preprod1yccfqe5up5g847f3rg5qktev5hz8dvzghe58fn95qpgyekzh96dsk7psx0';

const RECONSTRUCT_SCRIPT = resolve(join(process.cwd(), '.wallet-dust-sync', 'reconstruct-snapshot.mjs'));
const DUST_SNAPSHOT_FILE = resolve(join(process.cwd(), '.wallet-dust-sync', 'dust-state-snapshot.json'));

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
  /** Set for the confirmed public Preprod broadcast (proof recorded live on a chain block). */
  blockHeight?: number;
  blockHash?: string;
  confirmedAt?: number;
}

function manifestPath(type: string): string {
  return resolve(join(process.cwd(), 'managed', 'deploy', `${type}.json`));
}

function requireArtifacts(): void {
  const artifact = resolve(join(process.cwd(), CONTRACT_SOURCE));
  if (!existsSync(artifact)) {
    throw new Error(
      `Compiled contract artifacts not found at ${artifact}.\n` +
        'Run `npm run compile:contracts` first (Compact 0.31.1 / ledger-v8), then retry `npm run deploy`.',
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
 * Guards a real broadcast for the ledger-v8 contract on this branch.
 *
 * - Local devnet is always allowed.
 * - Preprod runs ledger v8 today (`specVersion 1000300 < 2000000`, verified live
 *   2026-09-22), so the
 *   contract is compatible there; a broadcast is real money, so it requires an
 *   explicit opt-in (`MIDNIGHT_PREPROD_DEPLOY_CONFIRM=yes`). Without it the
 *   deploy stops here — no tx is created, no manifest is written.
 * - If a network has already forked to v9 (`specVersion >= 2000000`), this v8
 *   contract cannot be deployed there; use the `main` branch variant instead.
 */
async function assertNetworkDeployable(config: NetworkConfig, requireConfirm = true): Promise<void> {
  if (config.type === 'local') return;
  const spec = await fetchSpecVersion(config.nodeUrl);
  if (spec === undefined) {
    throw new Error(`Preprod node unreachable at ${config.nodeUrl} — cannot check fork status.`);
  }
  if (spec >= LEDGER9_FORK_SPEC_VERSION) {
    throw new Error(
      `\nPublic deploy BLOCKED for this branch — ${config.label} already runs ledger v9\n` +
        `  (specVersion ${spec} >= ${LEDGER9_FORK_SPEC_VERSION}). The preprod-v8-compat contract targets\n` +
        `  ledger v8 (Compact 0.31.1 / runtime 0.16.0) and cannot be deployed there. Use the ` +
        `v9 in-circuit variant on the main branch.\n`,
    );
  }
  if (!requireConfirm) return;
  const confirmed = (process.env.MIDNIGHT_PREPROD_DEPLOY_CONFIRM ?? '').toLowerCase();
  if (confirmed !== 'yes') {
    throw new Error(
      `\nSTOPPED before any real Preprod broadcast (per instruction — report first).\n` +
        `  ${config.label} runs ledger v8 (specVersion ${spec}), which this branch targets; the deploy\n` +
        `  path is real and ready (see README "Known Simulations" for exactly what is proven).\n` +
        `  Broadcasting spends real funds. To override this stop, set\n` +
        `    MIDNIGHT_PREPROD_DEPLOY_CONFIRM=yes\n` +
        `  — after reviewing the compile + e2e confirmation. Nothing was submitted; no manifest written.\n`,
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

  if (config.type === 'preprod') {
    return deployPreprodRegistered(config, options);
  }

  const deployWallet = await connectDeployWallet(config);
  console.log(`  wallet              started (coin pub key ${deployWallet.coinPublicKey.slice(0, 16)}…)`);
  console.log(`  wallet address      ${deployWallet.walletAddress}`);
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

  console.log(`  contract address    ${contractAddress}  (local ledger-v8 devnet)`);
  console.log(`  deploy tx id        ${deployTxId}`);
  console.log(`  spec version        ${specVersion}`);
  console.log(`  manifest            ${path}`);
  console.log('');
  console.log(
    '  NOTE — issuer/schema registration is NOT executed on-chain yet: it needs indexer reads\n' +
      `  (registerIssuer/registerSchema), which are blocked by the public indexer image\n` +
      `  (cannot re-apply the deploy's dust spend). Registration will run the moment the read\n` +
      `  path is unblocked. Preprod is deployable with this v8 contract once explicitly\n` +
      `  confirmed (MIDNIGHT_PREPROD_DEPLOY_CONFIRM=yes) — see README "Known Simulations".\n`,
  );
  return manifest;
}

/**
 * The human-confirmed public Preprod broadcast. Uses the SAME restored-wallet
 * path the preflight proved (dust snapshot => restored wallet) and stops before
 * broadcasting if any guard fails. On broadcast, waits for the deploy to be
 * confirmed inside an indexer block before declaring success.
 */
async function deployPreprodRegistered(
  config: NetworkConfig,
  options: { network?: string; issuerName?: string; schemaName?: string },
): Promise<DeployManifest> {
  const expectedAddress = process.env.MIDNIGHT_EXPECTED_WALLET_ADDRESS ?? PREPROD_EXPECTED_ADDRESS;
  if (config.nodeUrl !== PREPROD_NODE_URL || config.indexerUrl !== PREPROD_INDEXER_URL) {
    throw new Error(
      `STOPPED: a Preprod broadcast requires the official endpoints (${PREPROD_NODE_URL} / ${PREPROD_INDEXER_URL}) — got ${config.nodeUrl} / ${config.indexerUrl}.`,
    );
  }
  if (!expectedAddress) {
    throw new Error('STOPPED: MIDNIGHT_EXPECTED_WALLET_ADDRESS is required for a real Preprod broadcast.');
  }
  console.log('  [PREPROD, human-confirmed] rebuilding verified dust snapshot at current tip…');

  const snapshot = await reconstructFreshSnapshot();
  const deployWallet = await connectDeployWalletRestored(config, snapshot, {
    ...process.env,
    MIDNIGHT_EXPECTED_WALLET_ADDRESS: expectedAddress,
  });
  console.log(`  wallet              restored (dust snapshot) — addr ${deployWallet.walletAddress}`);

  if (deployWallet.walletAddress !== expectedAddress) {
    throw new Error(
      `STOPPED before broadcast: restored wallet address ${deployWallet.walletAddress} ≠ expected ${expectedAddress}.`,
    );
  }

  const { contractAddress, deployTxId } = await submitRealDeployChecked(config, deployWallet, (addr) => {
    const isNotLocalDevnetContract = addr !== LOCAL_DEVNET_CONTRACT;
    const walletStillMatches = deployWallet.walletAddress === expectedAddress;
    const chainIsStillPreprod = config.nodeUrl === PREPROD_NODE_URL && config.indexerUrl === PREPROD_INDEXER_URL;
    console.log(
      `  pre-submit checks   target=${addr.slice(0, 20)}… | not-local-contract=${isNotLocalDevnetContract} | wallet-ok=${walletStillMatches} | preprod=${chainIsStillPreprod}`,
    );
    return isNotLocalDevnetContract && walletStillMatches && chainIsStillPreprod;
  });

  console.log(`  deploy tx submitted ${deployTxId}`);
  const onChain = await confirmDeployOnChain(config, contractAddress, deployTxId, Date.now() - 60_000);

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
    blockHeight: onChain.blockHeight,
    blockHash: onChain.blockHash,
    confirmedAt: Math.floor(Date.now() / 1000),
  };

  await mkdir(join(process.cwd(), 'managed', 'deploy'), { recursive: true });
  const path = manifestPath(config.type);
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('');
  console.log('  PREPROD DEPLOYMENT CONFIRMED ON-CHAIN');
  console.log(`  network             preprod (${PREPROD_NODE_URL})`);
  console.log(`  wallet address      ${deployWallet.walletAddress}`);
  console.log(`  contract address    ${contractAddress}`);
  console.log(`  deploy tx hash      ${onChain.txHash}`);
  console.log(`  block               ${onChain.blockHeight} / ${onChain.blockHash}`);
  console.log(`  confirmed after     ${onChain.seconds}s`);
  console.log(`  spec version        ${specVersion}`);
  console.log(`  manifest            ${path}`);
  console.log('  NOTE: issuer/schema registration stays pending the public indexer read-path fix;');
  console.log('  the deploy itself is live and on-chain.');
  process.exit(0);
  return manifest;
}

const execFileAsync = promisify(execFile);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface OnChainConfirmation {
  txHash: string;
  blockHeight: number;
  blockHash: string;
  seconds: number;
}

/**
 * Confirms an on-chain Preprod deployment by polling the public indexer for a
 * `contractAction` on the deployed address. Returns once that action is a
 * genuine `ContractDeploy` carrying a containing block (the deploy is actually
 * in a chain block — not merely handed to the node) whose timestamp is no older
 * than when this run started (a deploy address is deterministic per submit, so
 * any matching record is ours — but the freshness guard covers a stale block).
 *
 * The SDK-returned tx id (`submitTxAsync`) is the local transaction id; the
 * indexer's `Transaction.hash` is the on-chain transaction hash (wrapper
 * normalization can make them differ). The on-chain hash is what we verify and
 * return. Throws on timeout rather than guessing.
 */
async function confirmDeployOnChain(
  config: NetworkConfig,
  contractAddress: string,
  expectedTxId: string,
  sinceMs: number,
  timeoutMs = 15 * 60_000,
): Promise<OnChainConfirmation> {
  const body = JSON.stringify({
    query: `{ contractAction(address: ${JSON.stringify(contractAddress)}) {
      __typename transaction { id hash block { height hash timestamp } }
    } }`,
  });
  const started = Date.now();
  let lastPoll = Date.now();
  console.log(`  confirming deployment on-chain (indexer: ${config.indexerUrl})…`);
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(config.indexerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: {
            contractAction?: {
              __typename?: string;
              transaction?: { id?: number; hash?: string; block?: { height?: number; hash?: string; timestamp?: number } | null } | null;
            } | null;
          };
        };
        const action = json.data?.contractAction;
        const tx = action?.transaction;
        if (action?.__typename === 'ContractDeploy' && tx && tx.hash && tx.block?.height && tx.block?.hash) {
          if (typeof tx.block.timestamp === 'number' && tx.block.timestamp < sinceMs - 5 * 60_000) {
            throw new Error(
              `On-chain deploy for ${contractAddress} is in block ${tx.block.height} (ts ${tx.block.timestamp}) which predates this submit — this is not our deployment. STOP, do not guess.`,
            );
          }
          const seconds = Math.round((Date.now() - started) / 1000);
          console.log(`  on-chain confirmed  after ${seconds}s at block ${tx.block.height}/${tx.block.hash.slice(0, 16)}…`);
          console.log(`  on-chain tx hash    ${tx.hash}`);
          if (expectedTxId && tx.hash !== expectedTxId) {
            console.log(`  sdk tx id           ${expectedTxId} (wrapper-normalized; the on-chain hash above is authoritative)`);
          }
          return { txHash: tx.hash, blockHeight: tx.block.height, blockHash: tx.block.hash, seconds };
        }
      }
    } catch (error) {
      console.log(`  confirmation poll error (transient — continuing): ${error instanceof Error ? error.message : String(error)}`);
    }
    lastPoll = Date.now();
    await sleep(10_000);
  }
  throw new Error(
    `Deployment confirmation TIMEOUT after ${Math.round((lastPoll - started) / 1000)}s — tx was submitted but no on-chain ${contractAddress} action confirmed via indexer. STOPPING (do not retry blindly).`,
  );
}

/** Summary of a proven+balanced (but UNSUBMITTED) transaction for the preflight gates. */
interface PreflightTxSummary {
  contractAddress: string;
}

/** (Non-secret) attempt lines of the reconstruction step, echoed for visibility. */
function summariseReconstruction(stdout: string): string {
  return stdout
    .split('\n')
    .filter((line) => /^(attempt|snapshot written|VERDICT)/.test(line))
    .join('\n');
}

/**
 * Re-runs the verified dust-state reconstruction at the current Preprod tip and
 * returns the fresh SDK snapshot (a `DustWallet.restore`-consumable JSON). The
 * reconstruction keeps its own lists under `.wallet-dust-sync/` (gitignored).
 */
async function reconstructFreshSnapshot(): Promise<string> {
  if (!existsSync(RECONSTRUCT_SCRIPT)) {
    throw new Error(`Dust-state reconstruction script not found at ${RECONSTRUCT_SCRIPT}.`);
  }
  console.log('  [phase-1] reconstructing verified dust state at current Preprod tip…');
  const started = Date.now();
  try {
    const { stdout } = await execFileAsync(process.execPath, [RECONSTRUCT_SCRIPT], {
      cwd: process.cwd(),
      maxBuffer: 32 * 1024 * 1024,
    });
    const summary = summariseReconstruction(stdout);
    if (summary) console.log(`    ${summary.split('\n').join('\n    ')}`);
    console.log(`    snapshot rebuilt in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout ?? '';
    const extra = stdout ? `\n${stdout.slice(-4000)}` : '';
    throw new Error(
      `Dust-state reconstruction failed: ${error instanceof Error ? error.message : String(error)}${extra}`,
      { cause: error },
    );
  }
  if (!existsSync(DUST_SNAPSHOT_FILE)) {
    throw new Error(`Reconstruction finished without writing ${DUST_SNAPSHOT_FILE}.`);
  }
  return readFile(DUST_SNAPSHOT_FILE, 'utf8');
}

/**
 * Read the current unshielded/shielded/dust balances the wallet reports,
 * polled until the freshly-started (restored) wallet reports balances.
 */
async function readWalletBalances(
  wallet: DeployWallet['provider']['wallet'],
): Promise<{ unshielded: bigint; shielded: bigint; dust: bigint }> {
  const deadline = Date.now() + 180_000;
  const sum = (balances: Record<string, string | number | bigint>): bigint => {
    try {
      return Object.values(balances).reduce<bigint>((acc, v) => acc + BigInt(v), 0n);
    } catch {
      return 0n;
    }
  };
  let lastLog = 0;
  for (;;) {
    const [unshielded, shielded, dustState] = await Promise.all([
      firstValueFrom(wallet.unshielded.state),
      firstValueFrom(wallet.shielded.state),
      firstValueFrom(wallet.dust.state),
    ]);
    const u = sum(unshielded.balances);
    const s = sum(shielded.balances);
    let d = 0n;
    try {
      d = dustState.balance(new Date());
    } catch {
      // balance may throw before materialisation; keep 0 and let the poll retry
    }
    if (u > 0n || s > 0n || Date.now() >= deadline) return { unshielded: u, shielded: s, dust: d };
    if (Date.now() - lastLog >= 10_000) {
      console.log(`    wallet balances after ${((Date.now() - (deadline - 180_000)) / 1000).toFixed(0)}s: u=${u} s=${s} dust=${d}`);
      lastLog = Date.now();
    }
    await sleep(1500);
  }
}

export async function preflightRegistry(options: { network?: string } = {}): Promise<void> {
  const config = getNetworkConfig(options.network ? { MIDNIGHT_NETWORK: options.network } : process.env);
  const expectedAddress = process.env.MIDNIGHT_EXPECTED_WALLET_ADDRESS ?? PREPROD_EXPECTED_ADDRESS;

  const failures: string[] = [];
  const gate = (id: string, ok: boolean, label: string, detail = ''): void => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  [${id}] ${label}${detail ? `  (${detail})` : ''}`);
    if (!ok) failures.push(`${id}: ${label}`);
  };

  if (config.type !== 'preprod') {
    throw new Error(`Preflight only makes sense against real Preprod (got ${config.networkId}). Use the local deploy path instead.`);
  }
  if (!existsSync(join(process.cwd(), CONTRACT_SOURCE))) {
    throw new Error(`Compiled contract artifacts not found at ${CONTRACT_SOURCE} — run \`npm run compile:contracts\` first.`);
  }

  console.log(`VeriShield deploy preflight — ${config.label}`);
  console.log(describeNetwork(config));

  gate('2a', config.networkId === 'preprod', 'network is real Preprod', config.networkId);
  gate(
    '2b',
    config.nodeUrl === PREPROD_NODE_URL && config.indexerUrl === PREPROD_INDEXER_URL,
    'node/indexer are the official Preprod endpoints',
    config.nodeUrl === PREPROD_NODE_URL && config.indexerUrl === PREPROD_INDEXER_URL ? 'ok' : `${config.nodeUrl} / ${config.indexerUrl}`,
  );
  gate(
    '12a',
    config.nodeUrl !== 'http://localhost:9944' && config.indexerUrl !== 'http://localhost:8089/api/v4/graphql',
    'target is not the local devnet',
    'ok',
  );

  await assertNetworkDeployable(config, false);
  const spec = await fetchSpecVersion(config.nodeUrl);
  gate('3', spec !== undefined && spec < LEDGER9_FORK_SPEC_VERSION, 'specVersion below ledger-v9 fork', spec === undefined ? 'node unreachable' : `specVersion ${spec}`);

  // gate 4 — compiled artifact set present and internally consistent
  const artifactSet = [
    'contract/index.js',
    'compiler/contract-info.json',
    'contract/',
    'compiler/',
    'keys/',
    'zkir/',
  ];
  let contractInfoVersions: string;
  try {
    const ci = JSON.parse(await readFile(join(process.cwd(), CONTRACT_ARTIFACTS, 'compiler', 'contract-info.json'), 'utf8'));
    contractInfoVersions = `[compiler ${ci['compiler-version'] ?? ci.compilerVersion ?? '?'} / ledger ${ci.ledger ?? '?'}]`;
  } catch {
    contractInfoVersions = '[contract-info.json unreadable]';
  }
  const artifactOk = artifactSet.every((p) => existsSync(join(process.cwd(), CONTRACT_ARTIFACTS, p)));
  gate('4', artifactOk, 'compiled artifact set complete', `${CONTRACT_ARTIFACTS} ${artifactOk ? contractInfoVersions : '(missing components)'}`);

  const snapshot = await reconstructFreshSnapshot();
  const deployWallet = await connectDeployWalletRestored(config, snapshot, {
    ...process.env,
    MIDNIGHT_EXPECTED_WALLET_ADDRESS: expectedAddress,
  });
  console.log(`  wallet address      ${deployWallet.walletAddress}`);
  console.log(`  established         restore offset (dust appliedIndex) = ${deployWallet.dustSnapshotOffset}`);

  gate('1', deployWallet.walletAddress === expectedAddress, 'address matches the funded Preprod wallet', deployWallet.walletAddress);
  if (deployWallet.walletAddress !== expectedAddress) {
    failures.push('1: address matches the funded Preprod wallet');
  }

  const balances = await readWalletBalances(deployWallet.provider.wallet);
  console.log(`  tNIGHT unshielded   ${balances.unshielded.toString()}`);
  console.log(`  tNIGHT shielded     ${balances.shielded.toString()}`);
  console.log(`  DUST available      ${balances.dust.toString()}`);
  gate('5', balances.dust > 0n, 'DUST > 0 from the restored wallet', `${balances.dust.toString()}`);
  gate('6', balances.unshielded > 0n || balances.shielded > 0n, 'tNIGHT visible', `u=${balances.unshielded} s=${balances.shielded}`);

  // gates 7-11 — construct / prove / balance a deploy tx, then STOP (no submit).
  let deployed: PreflightTxSummary | undefined;
  if (!failures.some((f) => f.startsWith('1:') || f.startsWith('3') || f.startsWith('4'))) {
    const TRANSIENT = /unknown error|disconnect|network|timeout|ETIMEDOUT|ECONN|fetch|socket|temporary/i;
    for (let attempt = 1; attempt <= 3 && !deployed; attempt++) {
      try {
        if (attempt > 1) console.log(`    [no submit] retrying tx gates (attempt ${attempt}/3) after transient error…`);
        const tx = await buildPreflightDeployTx(config, deployWallet);
        deployed = { contractAddress: tx.contractAddress };
        gate('7', true, 'deploy tx constructible', tx.contractAddress);
        gate('9', tx.provenTx !== undefined, 'deploy tx provable', 'proof server accepted the unproven tx');
        gate('8', tx.balanced !== undefined, 'deploy tx balanceable', 'balanced against restored DUST + tNIGHT');
        console.log('  [no submit]         transaction is proven + balanced but NOT broadcast');
        gate('10', true, 'transaction NOT submitted', 'no nodeProvider.submitTx was invoked');
        gate('11', true, 'no tx hash produced', 'no submission / no hash');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (TRANSIENT.test(msg) && attempt < 3) {
          await sleep(20_000);
          continue;
        }
        gate('7', false, 'deploy tx constructible/provable/balanceable', msg);
        if (error instanceof Error && error.stack) {
          console.log('    [gate 7] error stack:');
          console.log(error.stack.split('\n').slice(1, 8).map((l) => '      ' + l.trim()).join('\n'));
        }
        break;
      }
    }
  } else {
    console.log('  skipping tx gates 7-11 — wallet/network/artifact gates failed');
  }

  // gate 12 — the deploy target contract address must not be the local-devnet contract
  if (deployed) {
    gate('12b', deployed.contractAddress !== LOCAL_DEVNET_CONTRACT, 'deploy target is NOT the local-devnet contract', deployed.contractAddress.slice(0, 20));
  } else {
    console.log('  skipping gate 12 (contract target) — no deploy tx was built');
  }

  deployWallet.disconnect();

  console.log('');
  if (failures.length > 0) {
    console.log(`PREFLIGHT FAILED — ${failures.length} gate(s) failing:`);
    for (const f of failures) console.log(`  - ${f}`);
    console.log('STOPPING: no transaction was built or broadcast. Do not deploy until the failing gates are resolved.');
    throw new Error(`Preflight failed (${failures.length} gates): ${failures.join('; ')}`);
  }
  console.log('PREPROD PREFLIGHT PASSED — READY FOR EXPLICIT DEPLOYMENT APPROVAL.');
}

async function main(): Promise<void> {
  const networkFlag = process.argv.find((a) => a.startsWith('--network='))?.slice('--network='.length);
  const preflight = process.argv.includes('--preflight');
  if (preflight) {
    await preflightRegistry({ network: networkFlag });
    process.exit(0);
  }
  const manifest = await deployRegistry({ network: networkFlag });
  console.log(`\nDeploy complete (${manifest.engine}). Next: npm run cli`);
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