/**
 * @verishield/deploy-tools
 *
 * Node-only tooling for the REAL Midnight deploy path (ledger-9 devnet):
 * connects the wallet SDK backed by the proof server, compiles the deployed
 * contract, creates the unproven deploy tx and submits it via `submitTxAsync`
 * (which does NOT depend on the indexer read path).
 *
 * Kept in its own workspace package so the deploy toolchain stays decoupled
 * from the React web app's dependency scope and from tsx path-mapped sources
 * in the root `src/` tree. Note: the deploy's SDK imports are heavy and were
 * once misread as an ESM "deadlock" — in this dev environment the repo sits on
 * a drvfs (Windows-mount) filesystem where loading the ~2000-module SDK graph
 * takes minutes; reading the module tree from a native ext4 mount drops a full
 * deploy+submit to well under a minute.
 */

import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import {
  createDefaultTestLogger,
  FluentWalletBuilder,
  DEFAULT_DUST_OPTIONS,
  MidnightWalletProvider,
  initializeMidnightProviders,
} from '@midnight-ntwrk/testkit-js';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { CompiledContract, type ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { signingKeyFromBip340 } from '@midnight-ntwrk/compact-runtime';
import { createUnprovenDeployTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Contract } from '@verishield/contracts';
import { signingKeyFromSecret } from '@verishield/shared/sdk';
import type { MidnightWalletProvider as MidnightWalletProviderType } from '@midnight-ntwrk/testkit-js';

/**
 * Well-known genesis-mint wallet seed for local devnets (publicly documented;
 * `undeployed` network only — NOT a secret).
 */
export const GENESIS_MINT_WALLET_SEED_0 =
  '0000000000000000000000000000000000000000000000000000000000000002';

/** Runtime endpoints of the network the deploy is submitted to. */
export interface DeployTarget {
  label: string;
  nodeUrl: string;
  nodeWsUrl: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proofServerUrl: string;
}

/** The provider environment shape the Midnight wallet SDK expects. */
export function midnightProvidersEnv(target: DeployTarget): EnvironmentConfiguration {
  return {
    walletNetworkId: 'undeployed',
    networkId: 'undeployed',
    indexer: target.indexerUrl,
    indexerWS: target.indexerWsUrl,
    node: target.nodeUrl,
    nodeWS: target.nodeWsUrl,
    proofServer: target.proofServerUrl,
    faucet: target.nodeUrl,
  };
}

/** A started, real (SDK-backed) wallet ready to sign transactions. */
export interface DeployWallet {
  /** Wallet master seed hex (also the issuer signing secret source). */
  readonly seedHex: string;
  /** The started wallet provider (coin key, dust, fee balancing, signing). */
  readonly provider: MidnightWalletProviderType;
  /** Coin public key as hex. */
  readonly coinPublicKey: string;
  disconnect(): void;
}

const require = createRequire(import.meta.url);

/** Absolute path of the compiled contract artifact directory (zk + keys). */
function contractArtifactsDir(): string {
  // Resolve the @verishield/contracts package root, then its managed output.
  return resolve(join(require.resolve('@verishield/contracts/package.json'), '..', 'managed', 'credential-registry'));
}

/**
 * Poll an endpoint until it answers `2xx` or the deadline passes. `docker
 * compose up -d` returns before the node has produced block #1 and before the
 * proof server has finished loading, so a one-shot probe races startup and
 * fails spuriously. The proof server can be slow on a cold start (it downloads
 * the SRS/ZK parameters on first use), hence the generous default window.
 */
async function waitForEndpoint(
  label: string,
  url: string,
  request: RequestInit = {},
  timeoutMs = 300_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: string;
  for (;;) {
    try {
      const res = await fetch(url, { ...request, signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (Date.now() >= deadline) {
      throw new Error(`${label} not ready after ${Math.round(timeoutMs / 1000)}s (${url}): ${lastError}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/**
 * Wait until the wallet reports a spendable dust balance. `start(false)` returns
 * as soon as the wallet process is up, so a deploy fired right after a fresh
 * `docker compose up -d` can race genesis/indexer sync and fail with
 * "Insufficient Funds: could not balance dust". testkit's own `start(true)`
 * helper is not usable here: its `waitForFunds` requires the *unshielded*
 * wallet to complete sync, and the current indexer image never reports that —
 * dust does sync, so wait on the dust balance directly.
 */
async function waitForDust(
  wallet: MidnightWalletProviderType['wallet'],
  timeoutMs = 180_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let dust = 0n;
  const subscription = wallet.state().subscribe((state) => {
    try {
      dust = state.dust.balance(new Date());
    } catch {
      // wallet state not fully materialised yet; keep the last value
    }
  });
  try {
    while (dust <= 0n) {
      if (Date.now() >= deadline) {
        throw new Error(`wallet dust not available after ${Math.round(timeoutMs / 1000)}s`);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  } finally {
    subscription.unsubscribe();
  }
}

/**
 * Resolve a positive-integer timeout override from env (ms), falling back to
 * `fallback`. Invalid or unset values silently fall back — a bad override must
 * not hard-fail the readiness probe.
 */
function timeoutFromEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Wait for the devnet services, then start the real wallet used to submit
 * on-chain deploys.
 *
 * Only meaningful for the local `undeployed` devnet today (the compiled
 * contract targets ledger v9; preprod is still pre-fork — the caller guards
 * that before reaching here).
 */
export async function connectDeployWallet(
  target: DeployTarget,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeployWallet> {
  const readinessTimeoutMs = timeoutFromEnv(env.MIDNIGHT_DEPLOY_READINESS_TIMEOUT_MS, 300_000);
  const wait = Promise.all([
    waitForEndpoint(
      'devnet node',
      target.nodeUrl,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'system_chain', params: [] }),
      },
      readinessTimeoutMs,
    ),
    waitForEndpoint('proof server', `${target.proofServerUrl}/version`, {}, readinessTimeoutMs),
  ]);
  try {
    await wait;
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n  Start the current-era devnet first: docker compose up -d`,
      { cause: error },
    );
  }

  const seed = (env.MIDNIGHT_DEPLOY_WALLET_SEED ?? GENESIS_MINT_WALLET_SEED_0).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(seed)) {
    throw new Error(`Invalid MIDNIGHT_DEPLOY_WALLET_SEED "${seed}" (expected 64 hex chars).`);
  }

  const logger = createDefaultTestLogger();
  const envConfig = midnightProvidersEnv(target);
  const spec = await FluentWalletBuilder.forEnvironment(envConfig).withSeed(seed);
  const built = await spec.withDustOptions({ ...DEFAULT_DUST_OPTIONS }).buildWithoutStarting();
  const provider = await MidnightWalletProvider.withWallet(logger, envConfig, built.wallet, built.seeds, built.keystore);
  await provider.start(false);
  await waitForDust(provider.wallet);

  const rawCoinPublicKey = provider.getCoinPublicKey();
  const coinPublicKey = typeof rawCoinPublicKey === 'string' ? rawCoinPublicKey : Buffer.from(rawCoinPublicKey).toString('hex');
  return {
    seedHex: seed,
    provider,
    coinPublicKey,
    disconnect: () => {},
  };
}

/** Result of a successfully submitted real deploy tx. */
export interface RealDeployResult {
  contractAddress: string;
  deployTxId: string;
  coinPublicKey: string;
}

/**
 * Compiles the registry contract, creates the unproven deploy tx and submits
 * it to the local devnet node through the real proof server.
 *
 * Uses `submitTxAsync`, which returns the tx id as soon as the tx is handed to
 * the node — it never blocks on indexer reads (the public indexer image
 * `4.4.0-rc.2` cannot re-apply this deploy's dust spend).
 */
export async function submitRealDeploy(
  target: DeployTarget,
  deployWallet: DeployWallet,
): Promise<RealDeployResult> {
  setNetworkId('undeployed');

  const envConfig = midnightProvidersEnv(target);
  const providers = initializeMidnightProviders<ProvableCircuitId<Contract<any, any>>, unknown>(
    deployWallet.provider,
    envConfig,
    {
      privateStateStoreName: 'verishield-deploy',
      zkConfigPath: contractArtifactsDir(),
    },
  );

  // The issuer identity embedded in the deploy matches the CLI's simulator
  // issuer key, so post-fork registration calls stay coherent.
  const seedBytes = new Uint8Array(deployWallet.seedHex.match(/../g)!.map((b) => Number.parseInt(b, 16)));
  const issuerSecret = signingKeyFromSecret(seedBytes);
  const witnessClosures = {
    issuerSigningKey: () => [{}, issuerSecret],
    credentialSignature: () => [{}, { announcement: undefined, response: undefined }],
    credentialPayload: () => [{}, null],
    credentialSalt: () => [{}, new Uint8Array(32).fill(1)],
  };
  // Deploy maintenance authority for the tx (v9 requires an explicit maintenance
  // signing key); derived from the same deploy seed so the issuer key remains
  // the single source of authority across deploy + registration.
  const signingKey = signingKeyFromBip340(seedBytes);

  let cc = CompiledContract.make('verishield-credential-registry', Contract);
  cc = CompiledContract.withWitnesses(cc, witnessClosures);
  cc = CompiledContract.withCompiledFileAssets(cc, contractArtifactsDir());

  const unproven = await createUnprovenDeployTx(providers, {
    // `withCompiledFileAssets` attaches the SDK-adjacent asset path at runtime
    // (the proof runtime resolves vkey/zkir configs through it), but its
    // combinator types can't express the multi-arg form for a generic
    // `Contract<any, any>` iface; the container is runtime-identical either way.
    compiledContract: (cc as unknown) as Parameters<typeof createUnprovenDeployTx>[1]['compiledContract'],
    args: [],
    signingKey,
  });
  const contractAddress = unproven.public.contractAddress;
  const deployTxId = await submitTxAsync(providers, { unprovenTx: unproven.private.unprovenTx });

  return {
    contractAddress,
    deployTxId,
    coinPublicKey: deployWallet.coinPublicKey,
  };
}