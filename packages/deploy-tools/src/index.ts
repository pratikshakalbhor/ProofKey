/**
 * @verishield/deploy-tools
 *
 * Node-only tooling for the REAL Midnight deploy path (ledger-v8 toolchain,
 * preprod-compatible): connects the wallet SDK backed by the proof server,
 * compiles the deployed contract, creates the unproven deploy tx and submits
 * it via `submitTxAsync` (which does NOT depend on the indexer read path).
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
  WalletFactory,
  WalletSeeds,
  initializeMidnightProviders,
} from '@midnight-ntwrk/testkit-js';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import {
  DustWallet,
  InMemoryTransactionHistoryStorage,
  WalletEntrySchema,
  createKeystore,
  mergeWalletEntries,
} from '@midnight-ntwrk/wallet-sdk';
import type { DefaultConfiguration } from '@midnight-ntwrk/wallet-sdk';
import { CompiledContract, type ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { signingKeyFromBip340 } from '@midnight-ntwrk/compact-runtime';
import { ZswapSecretKeys, DustSecretKey } from '@midnight-ntwrk/ledger-v8';
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
  /** Midnight network id the wallet/txs are built for (`undeployed`|`preview`|`preprod`|`mainnet`). */
  networkId: string;
  nodeUrl: string;
  nodeWsUrl: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proofServerUrl: string;
}

/** The provider environment shape the Midnight wallet SDK expects. */
export function midnightProvidersEnv(target: DeployTarget): EnvironmentConfiguration {
  return {
    walletNetworkId: target.networkId,
    networkId: target.networkId,
    indexer: target.indexerUrl,
    indexerWS: target.indexerWsUrl,
    node: target.nodeUrl,
    nodeWS: target.nodeWsUrl,
    proofServer: target.proofServerUrl,
    faucet: target.nodeUrl,
  };
}

/**
 * The wallet build configuration the SDK derives from an environment (the same
 * object `FluentWalletBuilder` constructs internally via
 * `mapEnvironmentToConfiguration`, which this package does not export).
 * Replicated here so wallets can be assembled manually via `WalletFactory`
 * when a seed-started dust wallet would be wrong (restored dust instead).
 */
export function buildDefaultConfig(envConfig: EnvironmentConfiguration): DefaultConfiguration {
  return {
    indexerClientConnection: {
      indexerHttpUrl: envConfig.indexer,
      indexerWsUrl: envConfig.indexerWS,
    },
    provingServerUrl: new URL(envConfig.proofServer),
    networkId: envConfig.walletNetworkId,
    relayURL: new URL(envConfig.nodeWS),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
    costParameters: { feeBlocksMargin: 5 },
  };
}

/** A started, real (SDK-backed) wallet ready to sign transactions. */
export interface DeployWallet {
  /** Wallet master seed hex (also the issuer signing secret source). */
  readonly seedHex: string;
  /** The bech32 Midnight address the wallet derives to (public; NOT a secret). */
  readonly walletAddress: string;
  /** The started wallet provider (coin key, dust, fee balancing, signing). */
  readonly provider: MidnightWalletProviderType;
  /** Coin public key as hex. */
  readonly coinPublicKey: string;
  disconnect(): void;
}

export type WalletSeed = { kind: 'hex'; value: string } | { kind: 'mnemonic'; value: string };

/**
 * Parse the `MIDNIGHT_DEPLOY_WALLET_SEED` input into the format the wallet SDK
 * accepts. The SDK's `FluentWalletBuilder` supports two inputs, both of which
 * uniquely fix the derived wallet (and therefore the spendable address):
 *
 * - a 64-char **master-seed hex** (with or without a `0x` prefix) → `withSeed`
 * - a **BIP-39 mnemonic** (12/15/18/21/24 words) → `withMnemonic`, which the
 *   SDK converts via `bip39.mnemonicToSeedSync` into the BIP-39 master seed
 *
 * Any other value is rejected so the wallet can never silently derive an
 * address different from the funded one (callers must assert the derived
 * address equals the funded Preprod wallet before broadcasting).
 */
export function resolveWalletSeed(raw: string | undefined | null): WalletSeed {
  const value = (raw ?? '').trim();
  if (!value) {
    throw new Error(
      'MIDNIGHT_DEPLOY_WALLET_SEED is empty. Set it in .env to the funded wallet seed (64-char hex) or a BIP-39 mnemonic.',
    );
  }
  const maybeHex = /^0x[0-9a-f]{64}$/i.test(value) ? value.slice(2) : value;
  if (/^[0-9a-f]{64}$/i.test(maybeHex)) {
    return { kind: 'hex', value: maybeHex.toLowerCase() };
  }
  const words = value.split(/\s+/);
  if (
    words.length >= 12 &&
    words.length <= 24 &&
    words.length % 3 === 0 &&
    words.every((w) => /^[a-z]+$/.test(w))
  ) {
    return { kind: 'mnemonic', value };
  }
  throw new Error(
    `Invalid MIDNIGHT_DEPLOY_WALLET_SEED format (${raw ? raw.length : 0} chars). Expected a 64-char hex master seed or a BIP-39 mnemonic.`,
  );
}

/** Derive the wallet's bech32 Midnight address from an opened provider. */
export async function walletAddressOf(provider: MidnightWalletProviderType): Promise<string> {
  return provider.unshieldedKeystore.getBech32Address().asString();
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
 * Wait until the node and proof-server endpoints answer. The proof server can
 * be slow on a cold start (it downloads the SRS/ZK parameters on first use).
 */
async function waitForDeployServices(target: DeployTarget, env: NodeJS.ProcessEnv): Promise<void> {
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
}

/**
 * Wait for the devnet services, then start the real wallet used to submit
 * on-chain deploys.
 *
 * On this branch the compiled contract targets ledger v8 — the same ledger
 * preprod runs — so the local devnet must be started with the v8 compose
 * (`docker compose -f docker-compose-v8.yml up -d`, or the running local
 * devnet's endpoints) before reaching here.
 */
export async function connectDeployWallet(
  target: DeployTarget,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeployWallet> {
  await waitForDeployServices(target, env);

  const seed = resolveWalletSeed(env.MIDNIGHT_DEPLOY_WALLET_SEED ?? GENESIS_MINT_WALLET_SEED_0);

  const logger = createDefaultTestLogger();
  const envConfig = midnightProvidersEnv(target);
  const builder = FluentWalletBuilder.forEnvironment(envConfig);
  const withKey = seed.kind === 'mnemonic' ? builder.withMnemonic(seed.value) : builder.withSeed(seed.value);
  const built = await withKey.withDustOptions({ ...DEFAULT_DUST_OPTIONS }).buildWithoutStarting();
  const provider = await MidnightWalletProvider.withWallet(
    logger,
    envConfig,
    built.wallet,
    ZswapSecretKeys.fromSeed(built.seeds.shielded),
    DustSecretKey.fromSeed(built.seeds.dust),
    built.keystore,
  );
  await provider.start(false);

  const walletAddress = await walletAddressOf(provider);
  const expectedAddress = env.MIDNIGHT_EXPECTED_WALLET_ADDRESS;
  if (expectedAddress && walletAddress !== expectedAddress) {
    throw new Error(
      `Wallet address mismatch: derived ${walletAddress} does not match MIDNIGHT_EXPECTED_WALLET_ADDRESS=${expectedAddress}. ` +
        'Refusing to build or broadcast any transaction for the wrong wallet.',
    );
  }

  await waitForDust(provider.wallet);

  const rawCoinPublicKey = provider.getCoinPublicKey();
  const coinPublicKey = typeof rawCoinPublicKey === 'string' ? rawCoinPublicKey : Buffer.from(rawCoinPublicKey).toString('hex');
  return {
    seedHex: seed.kind === 'hex' ? seed.value : built.seeds.masterSeed,
    walletAddress,
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
 * A deploy wallet whose DUST side is restored from a chain-consistent snapshot
 * instead of being synced from genesis (the preprod dust ledger is too large
 * to cold-sync; feeds bridging and commitment state are instead reconstructed
 * from the indexer by the verified reconstruction, then restored here through
 * the SDK's own `DustWallet.restore` API).
 *
 * Shielded/unshielded keys still derive from the deploy seed (the same wallet),
 * so the derived bech32 address is unchanged.
 */
export interface RestoredDeployWallet extends DeployWallet {
  /** The snapshot this wallet's dust state was restored from (offset→appliedIndex). */
  readonly dustSnapshotOffset: string;
  readonly addressMatchExpected: string;
}

/**
 * Connect a wallet whose dust side is restored from `serializedState` (an SDK
 * dust-wallet snapshot: `{ publicKey, state, protocolVersion, networkId, offset }`).
 *
 * Uses only the SDK's own public APIs — `DustWallet(config).restore(...)`,
 * `WalletFactory.createShieldedWallet/createUnshieldedWallet/createWalletFacade`,
 * `MidnightWalletProvider.withWallet` — no invented facade-level restore.
 */
export async function connectDeployWalletRestored(
  target: DeployTarget,
  serializedState: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<RestoredDeployWallet> {
  await waitForDeployServices(target, env);

  const seed = resolveWalletSeed(env.MIDNIGHT_DEPLOY_WALLET_SEED);

  const logger = createDefaultTestLogger();
  const envConfig = midnightProvidersEnv(target);
  const config = buildDefaultConfig(envConfig);

  const seeds = seed.kind === 'mnemonic' ? WalletSeeds.fromMnemonic(seed.value) : WalletSeeds.fromMasterSeed(seed.value);

  // Shielded + unshielded derive from the seed as usual; only DUST is restored.
  const keystore = createKeystore(seeds.unshielded, envConfig.networkId as Parameters<typeof createKeystore>[1]);
  const shieldedWallet = WalletFactory.createShieldedWallet(config, seeds.shielded);
  const unshieldedWallet = WalletFactory.createUnshieldedWallet(config, keystore);

  const dustConfig: DefaultConfiguration = {
    ...config,
    costParameters: {
      additionalFeeOverhead: DEFAULT_DUST_OPTIONS.additionalFeeOverhead,
      feeBlocksMargin: DEFAULT_DUST_OPTIONS.feeBlocksMargin,
    },
  };
  const dustWallet = DustWallet(dustConfig).restore(serializedState);

  const wallet = await WalletFactory.createWalletFacade(config, shieldedWallet, unshieldedWallet, dustWallet);
  const provider = await MidnightWalletProvider.withWallet(
    logger,
    envConfig,
    wallet,
    ZswapSecretKeys.fromSeed(seeds.shielded),
    DustSecretKey.fromSeed(seeds.dust),
    keystore,
  );
  await provider.start(false);

  const walletAddress = await walletAddressOf(provider);
  const expectedAddress = env.MIDNIGHT_EXPECTED_WALLET_ADDRESS;
  if (expectedAddress && walletAddress !== expectedAddress) {
    throw new Error(
      `Wallet address mismatch: derived ${walletAddress} does not match MIDNIGHT_EXPECTED_WALLET_ADDRESS=${expectedAddress}. ` +
        'Refusing to build or broadcast any transaction for the wrong wallet.',
    );
  }

  await waitForDust(provider.wallet);

  const rawCoinPublicKey = provider.getCoinPublicKey();
  const coinPublicKey = typeof rawCoinPublicKey === 'string' ? rawCoinPublicKey : Buffer.from(rawCoinPublicKey).toString('hex');

  let dustSnapshotOffset = '(unknown)';
  try {
    const parsed = JSON.parse(serializedState) as { offset?: string };
    dustSnapshotOffset = parsed.offset ?? '0';
  } catch {
    // fall through with the placeholder
  }

  return {
    seedHex: seed.kind === 'hex' ? seed.value : seeds.masterSeed,
    walletAddress,
    provider,
    coinPublicKey,
    dustSnapshotOffset,
    addressMatchExpected: expectedAddress ?? '(MIDNIGHT_EXPECTED_WALLET_ADDRESS not set)',
    disconnect: () => {},
  };
}

/** Shared contract compilation + wire-up of deploy-tx providers (no submission). */
async function assembleDeployTx<TContract extends Contract<any, any>>(
  target: DeployTarget,
  deployWallet: DeployWallet,
): Promise<{
  providers: ReturnType<typeof initializeMidnightProviders<ProvableCircuitId<TContract>, unknown>>;
  unproven: Awaited<ReturnType<typeof createUnprovenDeployTx>>;
}> {
  setNetworkId(target.networkId);

  const envConfig = midnightProvidersEnv(target);
  const providers = initializeMidnightProviders<ProvableCircuitId<TContract>, unknown>(
    deployWallet.provider,
    envConfig,
    {
      privateStateStoreName: 'verishield-deploy',
      zkConfigPath: contractArtifactsDir(),
    },
  );

  // The issuer identity embedded in the deploy matches the CLI's simulator
  // issuer key, so post-fork registration calls stay coherent.
  // `seedHex` is 64 hex chars for a hex master seed but 128 hex chars
  // (HMAC-SHA512 -> 64 bytes) for a BIP-39 mnemonic; `signingKeyFromBip340`
  // requires a 32-byte scalar, so derive deterministically from the first 32.
  const seedBytes = new Uint8Array(deployWallet.seedHex.match(/../g)!.map((b) => Number.parseInt(b, 16))).slice(0, 32);
  const issuerSecret = signingKeyFromSecret(seedBytes);
  const witnessClosures = {
    issuerSigningKey: () => [{}, issuerSecret],
    credentialPayload: () => [{}, null],
    credentialSalt: () => [{}, new Uint8Array(32).fill(1)],
  };
  // Deploy maintenance authority for the tx (derived from the same deploy seed
  // so the issuer key remains the single source of authority across deploy +
  // registration).
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

  return { providers, unproven };
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
  const { providers, unproven } = await assembleDeployTx(target, deployWallet);
  const contractAddress = unproven.public.contractAddress;
  const deployTxId = await submitTxAsync(providers, { unprovenTx: unproven.private.unprovenTx });

  return {
    contractAddress,
    deployTxId,
    coinPublicKey: deployWallet.coinPublicKey,
  };
}

/**
 * The confirmed-broadcast path for a real public Preprod deploy. Assembles the
 * unproven deploy tx first (computing the deterministic contract address),
 * runs `preSubmitCheck(contractAddress)` while nothing has been broadcast, and
 * only then proves + balances + broadcasts THAT SAME transaction.
 *
 * If the check fails, no tx is ever handed to the node.
 */
export async function submitRealDeployChecked(
  target: DeployTarget,
  deployWallet: DeployWallet,
  preSubmitCheck: (contractAddress: string) => boolean,
): Promise<RealDeployResult> {
  const { providers, unproven } = await assembleDeployTx(target, deployWallet);
  const contractAddress = unproven.public.contractAddress;
  if (!preSubmitCheck(contractAddress)) {
    throw new Error('STOPPED before any broadcast: pre-submit target/network check failed.');
  }
  const deployTxId = await submitTxAsync(providers, { unprovenTx: unproven.private.unprovenTx });

  return {
    contractAddress,
    deployTxId,
    coinPublicKey: deployWallet.coinPublicKey,
  };
}

/**
 * Everything a deploy would do EXCEPT broadcasting: create the unproven deploy
 * tx, prove it and balance it, then STOP before `nodeProvider.submitTx`. Used
 * by the Preprod preflight to prove the full submit path is ready without
 * spending real funds.
 */
export async function buildPreflightDeployTx(
  target: DeployTarget,
  deployWallet: DeployWallet,
): Promise<{
  contractAddress: string;
  unprovenTx: Awaited<ReturnType<typeof createUnprovenDeployTx>>['private']['unprovenTx'];
  provenTx: unknown;
  balanced: unknown;
}> {
  const { providers, unproven } = await assembleDeployTx(target, deployWallet);

  // Mirror `submitTxCore`: prove, then balance. Stop before submit.
  const provenTx = await providers.proofProvider.proveTx(unproven.private.unprovenTx);
  const balanced = await providers.walletProvider.balanceTx(provenTx);

  return {
    contractAddress: unproven.public.contractAddress,
    unprovenTx: unproven.private.unprovenTx,
    provenTx,
    balanced,
  };
}