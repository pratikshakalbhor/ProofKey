/**
 * VeriShield on-chain flow — real transactions against the REAL deployed
 * Preprod contract.
 *
 * Pipeline (all in the browser, mirrors how `@verishield/deploy-tools`
 * assembles contracts, adapted to the DApp Connector v4 wallet model):
 *
 *   1. decode the REAL current public state / zswap state / ledger parameters
 *      from the Preprod indexer (see indexer.ts),
 *   2. assemble an unproven CALL transaction in the browser with compact-js
 *      (private credential inputs never leave this process),
 *   3. hand it to the user's wallet: `getProvingProvider(...)` proves the
 *      circuits with the bundled artifacts, `balanceUnsealedTransaction` pays
 *      fees and balances, `submitTransaction` broadcasts,
 *   4. confirm the returned transaction hash against the indexer.
 *
 * Nothing here fabricates a transaction or a result. Every unverifiable
 * runtime step throws a precise error about the missing prerequisite instead.
 */

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import {
  createUnprovenCallTxFromInitialStates,
  createCallTxOptions,
} from '@midnight-ntwrk/midnight-js-contracts';
import { createProofProvider } from '@midnight-ntwrk/midnight-js-types';
import { parseCoinPublicKeyToHex } from '@midnight-ntwrk/midnight-js-utils';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  ContractState as OnChainContractState,
} from '@midnight-ntwrk/onchain-runtime-v3';
import {
  LedgerParameters,
  ZswapChainState,
} from '@midnight-ntwrk/ledger-v8';
import { Contract, type Witnesses } from '@verishield/contracts';
import {
  configuredContractAddress,
  configuredNetwork,
  PREPROD_ENDPOINTS,
  checkContractTarget,
} from './config';
import {
  fetchContractSummary,
  fetchLedgerParameters,
  fetchLatestContractAction,
  type ContractAction,
  type ContractCallAction,
} from './indexer';
import { veriShieldZKConfigProvider, walletKeyMaterialProvider, type ProvableCircuitOfContract } from './zk-key-provider';
import { isAlreadyProvisionedError, readableReason } from './alreadyOnChain';
import type { MidnightConnectedApi, PreprodSession, WalletProvingProvider } from './wallet';

type PrivateState = Record<string, never>;

/** Payload shape the contract witnesses expect (mirrors the generated bindings). */
export interface CredentialPayloadWitness {
  schemaId: Uint8Array;
  holderBinding: Uint8Array;
  nameHash: Uint8Array;
  degree: Uint8Array;
  dob: bigint;
  cgpaTimes100: bigint;
  issueDate: bigint;
  expiryDate: bigint;
}

interface WitnessValues {
  issuerSigningKey: bigint | null;
  credentialPayload: CredentialPayloadWitness | null;
  credentialSalt: Uint8Array | null;
}

const EMPTY_PRIVATE_STATE: PrivateState = {};

function requireWitness<T>(value: T | null, name: string): T {
  if (value === null) {
    throw new Error(
      `Witness "${name}" was not loaded for this call. Load the matching credential or issuer secret first.`,
    );
  }
  return value;
}

/** Current on-chain facts straight from the indexer. Pure observation. */
export interface OnChainSnapshot {
  networkId: string;
  contractAddress: string;
  found: boolean;
  deployTxHash: string | null;
  latestActionKind: string | null;
  latestEntryPoint: string | null;
  latestBlockHeight: number | null;
  hasCallsYet: boolean;
}

export async function inspectOnChain(): Promise<OnChainSnapshot> {
  const networkId = configuredNetwork();
  const contractAddress = configuredContractAddress();
  assertPreprod(contractAddress);
  const summary = await fetchContractSummary(PREPROD_ENDPOINTS.indexerUrl, contractAddress);
  return {
    networkId,
    contractAddress,
    found: summary.found,
    deployTxHash: summary.deployedIn?.txHash ?? null,
    latestActionKind: summary.latest?.kind ?? null,
    latestEntryPoint:
      summary.latest?.kind === 'ContractCall' ? summary.latest.entryPoint : null,
    latestBlockHeight: summary.latest?.transaction.block.height ?? null,
    hasCallsYet: summary.latestIsVerificationCall || summary.latest?.kind === 'ContractUpdate',
  };
}

function assertPreprod(contractAddress: string): void {
  const check = checkContractTarget(configuredNetwork(), contractAddress);
  if (!check.ok) {
    throw new Error(
      `Refusing an on-chain operation outside Preprod/${contractAddress}: ${check.reasons.join('; ')}`,
    );
  }
}

/** Decodes the indexer hex for ledger-v8 deserializers (header is part of the form). */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export interface LedgerContext {
  contractState: OnChainContractState;
  zswapChainState: ZswapChainState;
  ledgerParameters: LedgerParameters;
  /** Bech32m Zswap coin public key from the connected wallet (SDK expects a string). */
  coinPublicKey: string;
  /** Bech32m encryption public key from the connected wallet (SDK expects a string). */
  walletEncryptionPublicKey: string;
  /** Indexer-confirmed hash of the action this context was built from. */
  actionHash: string;
  /** Block height the context's contract state / zswap state were read at. */
  blockHeight: number;
}

export type LedgerWalletKeys = Pick<LedgerContext, 'coinPublicKey' | 'walletEncryptionPublicKey'>;

export interface LedgerContextOptions {
  /**
   * Reuse an already-indexed action (e.g. the one a just-confirmed submit
   * returned) instead of fetching the latest action again. The block's ledger
   * parameters are still fetched for that action's block height, so a stale
   * context is never reused across a block boundary.
   */
  fromAction?: ContractAction;
  /** Reuse the wallet keys already pulled this session instead of calling the wallet. */
  walletKeys?: LedgerWalletKeys;
}

/**
 * Pulls the wallet's Zswap keys straight from the DApp Connector, untouched.
 *
 * This is the boundary that previously broke the on-chain flow: the wallet
 * returns the keys as Bech32m string addresses, but the code decoded them to
 * raw bytes here and then fed a `Uint8Array` to the Midnight SDK whose
 * contract runtime requires a Hex/Bech32m string (`coinPublic`). Pass the
 * strings through byte-identically and let the tx-building boundary convert
 * the coin public key to hex (`parseCoinPublicKeyToHex`) when needed.
 */
export function walletShieldedKeys(addresses: {
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
}): Pick<LedgerContext, 'coinPublicKey' | 'walletEncryptionPublicKey'> {
  return {
    coinPublicKey: addresses.shieldedCoinPublicKey,
    walletEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
  };
}

/** Reads the real ledger context for the deployed contract from the indexer. */
export async function fetchLedgerContext(
  session?: PreprodSession,
  options: LedgerContextOptions = {},
): Promise<LedgerContext> {
  assertPreprod(configuredContractAddress());
  const endpoint = PREPROD_ENDPOINTS.indexerUrl;
  const address = configuredContractAddress();

  const latest = options.fromAction ?? (await fetchLatestContractAction(endpoint, address));
  if (!latest) {
    throw new Error('The deployed contract has no indexed actions yet; nothing to call against.');
  }
  const stateHex = latest.state;
  if (!stateHex) {
    throw new Error('The latest contract action carries no state; cannot construct a call.');
  }
  const zswapHex = latest.zswapState;

  let contractState: OnChainContractState;
  try {
    contractState = OnChainContractState.deserialize(hexToBytes(stateHex));
  } catch (error) {
    throw new Error(
      `Failed to decode on-chain contract state: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  let zswapChainState: ZswapChainState;
  try {
    zswapChainState = zswapHex
      ? ZswapChainState.deserialize(hexToBytes(zswapHex))
      : new ZswapChainState();
  } catch (error) {
    throw new Error(
      `Failed to decode on-chain zswap state: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const block = await fetchLedgerParameters(endpoint, latest.transaction.block.height);
  let ledgerParameters: LedgerParameters;
  try {
    ledgerParameters = LedgerParameters.deserialize(hexToBytes(block.ledgerParameters));
  } catch (error) {
    throw new Error(
      `Failed to decode ledger parameters: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  let coinPublicKey = '';
  let walletEncryptionPublicKey = '';
  if (options.walletKeys) {
    ({ coinPublicKey, walletEncryptionPublicKey } = options.walletKeys);
  } else if (session) {
    const addresses = await session.api.getShieldedAddresses?.();
    if (!addresses) {
      throw new Error('Connected wallet is missing getShieldedAddresses(); cannot fund a call.');
    }
    // The DApp Connector returns the Zswap keys as Bech32m address STRINGS, and
    // the Midnight SDK's contract runtime/config layer validates them as such
    // (`coinPublic` must be a Hex or Bech32m string). Pass them through without
    // re-encoding — decoding them to raw bytes here was what made
    // `buildUnprovenCallTx` feed a Uint8Array where a string was required.
    ({ coinPublicKey, walletEncryptionPublicKey } = walletShieldedKeys(addresses));
  }

  return {
    contractState,
    zswapChainState,
    ledgerParameters,
    coinPublicKey,
    walletEncryptionPublicKey,
    actionHash: latest.transaction.hash,
    blockHeight: latest.transaction.block.height,
  };
}

function buildCompiledContract(values: WitnessValues) {
  const witnesses: Witnesses<PrivateState> = {
    issuerSigningKey: () => [
      EMPTY_PRIVATE_STATE,
      requireWitness(values.issuerSigningKey, 'issuerSigningKey'),
    ],
    credentialPayload: () => [
      EMPTY_PRIVATE_STATE,
      requireWitness(values.credentialPayload, 'credentialPayload'),
    ],
    credentialSalt: () => [
      EMPTY_PRIVATE_STATE,
      requireWitness(values.credentialSalt, 'credentialSalt'),
    ],
  };
  let cc = CompiledContract.make('verishield-credential-registry', Contract);
  cc = CompiledContract.withWitnesses(cc, witnesses);
  // Used by the compact runtime's compiled-file-assets resolution; in the
  // browser every key material access goes through the zk config provider.
  cc = CompiledContract.withCompiledFileAssets(cc, window.location.origin);
  return cc;
}

export interface CallInvocation {
  circuitId: ProvableCircuitOfContract;
  args: unknown[];
  values: Partial<WitnessValues>;
}

/** Assembles the unproven call transaction for the given invocation. */
export async function buildUnprovenCallTx(
  invocation: CallInvocation,
  context: LedgerContext,
): Promise<{ unprovenTx: unknown; serializedUnprovenTx: string; circuitId: string }> {
  const { circuitId, args, values } = invocation;

  // The contract runtime requires a configured network id before it will build
  // an unproven call tx (it resolves key encodings via `getNetworkId`).
  setNetworkId(configuredNetwork());

  const cc = buildCompiledContract({
    issuerSigningKey: values.issuerSigningKey ?? null,
    credentialPayload: values.credentialPayload ?? null,
    credentialSalt: values.credentialSalt ?? null,
  });

  const baseOptions = createCallTxOptions(
    cc as never,
    circuitId as never,
    configuredContractAddress(),
    undefined,
    undefined,
    args as never,
  ) as never;
  const options = {
    ...(baseOptions as Record<string, unknown> | object | null),
    // `createUnprovenCallTxFromInitialStates` executes the circuit with the
    // coin public key as a plain hex source (`CoinPublicKey.asHex` is only a
    // brand, not a Bech32m→hex conversion), so a Bech32m key from the wallet
    // dies with "Invalid hex-digit 'm' …". Convert to hex at this boundary.
    coinPublicKey: parseCoinPublicKeyToHex(context.coinPublicKey, getNetworkId()),
    initialContractState: context.contractState,
    initialZswapChainState: context.zswapChainState,
    ledgerParameters: context.ledgerParameters,
    initialPrivateState: EMPTY_PRIVATE_STATE,
  } as never;

  const data = await createUnprovenCallTxFromInitialStates(
    veriShieldZKConfigProvider as never,
    options,
    context.walletEncryptionPublicKey as never,
  );
  const unprovenTx =
    (data as { unprovenTx?: unknown }).unprovenTx ??
    (data as { private?: { unprovenTx?: unknown } }).private?.unprovenTx;
  if (!unprovenTx) {
    throw new Error('Unproven call tx did not carry an unprovenTx; cannot continue.');
  }
  const serialized = (unprovenTx as { serialize?: () => Uint8Array }).serialize?.();
  if (!serialized) {
    throw new Error('Unproven call tx cannot be serialized; wallet cannot balance it.');
  }
  return { unprovenTx, serializedUnprovenTx: bytesToHex(serialized), circuitId };
}

export type ProvisionOutcome = 'pending' | 'already-on-chain';

/**
 * Determines whether `invocation`'s on-chain effect already exists by EXECUTING
 * the circuit against the current real state (no proof, no balance, no
 * submit). This is pure observation: the contract itself rejecting a duplicate
 * ("Issuer already registered" / "Credential already anchored") is real
 * on-chain evidence the step is already done. Any other circuit error is a
 * genuine failure and is rethrown unchanged.
 */
export async function classifyInvocation(
  invocation: CallInvocation,
  context: LedgerContext,
): Promise<ProvisionOutcome> {
  try {
    await buildUnprovenCallTx(invocation, context);
    return 'pending';
  } catch (error) {
    if (isAlreadyProvisionedError(error)) return 'already-on-chain';
    throw error;
  }
}

async function requireProvingProvider(api: MidnightConnectedApi) {
  const getProvingProvider = api.getProvingProvider;
  if (typeof getProvingProvider !== 'function') {
    throw new Error(
      'This wallet build does not expose getProvingProvider(); no on-chain proof can be produced.',
    );
  }
  return getProvingProvider.call(api, walletKeyMaterialProvider());
}

/**
 * Creates the wallet proving provider once per session. The provider binds ZK
 * artifacts and key access but is stateless per `proveTx` request, so a run that
 * submits several calls (5 for provisioning) reuses the SAME provider instead of
 * re-loading artifacts before every proof.
 */
export function prepareProvingProvider(api: MidnightConnectedApi): Promise<WalletProvingProvider> {
  return requireProvingProvider(api);
}

export interface SubmitOptions {
  /** Reuse a previously fetched ledger context (state/zswap/params/wallet keys). */
  context?: LedgerContext;
  /** Reuse the session's wallet proving provider instead of re-binding it. */
  provingProvider?: WalletProvingProvider;
}

export interface SubmittedCall {
  txHash: string;
  entryPoint: string;
  confirmedOnChain: boolean;
  /** The indexer-confirmed action that finalised this call (fresh state source). */
  action: ContractCallAction;
}

type SubmitStage =
  | 'fetchLedgerContext'
  | 'buildUnprovenCallTx'
  | 'proveTx'
  | 'balanceUnsealedTransaction'
  | 'submitTransaction'
  | 'confirmOnChain';

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

/**
 * Runs one submit stage with structured logging and rethrows a readable,
 * prefixed error so the UI can show `Stage:` / `Reason:` without guessing.
 * Logs only stage names, durations and error messages — never private witnesses.
 */
async function runSubmitStage<T>(stage: SubmitStage, work: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await work();
    console.info(`[VeriShield submit] stage ok: ${stage} (${formatDuration(performance.now() - startedAt)})`);
    return result;
  } catch (error) {
    const reason = readableReason(error);
    console.error(
      `[VeriShield submit] stage FAILED: ${stage} (${formatDuration(performance.now() - startedAt)}) — reason: ${reason}`,
    );
    throw new Error(`Stage: ${stage} — ${reason}`, { cause: error });
  }
}

/**
 * Real submit: prove with the wallet, balance, broadcast, then confirm the
 * resulting hash on the indexer. Returns only indexer-confirmed hashes.
 *
 * `options.context` / `options.provingProvider` let a provisioning run reuse
 * one ledger context (state fetched once) and one wallet proving provider
 * across all of its sequential calls — the dominant per-call overhead —
 * instead of re-fetching and re-loading before every single call.
 */
export async function submitOnChainCall(
  session: PreprodSession,
  invocation: CallInvocation,
  options: SubmitOptions = {},
): Promise<SubmittedCall> {
  assertPreprod(configuredContractAddress());
  for (const method of ['balanceUnsealedTransaction', 'submitTransaction'] as const) {
    if (typeof session.api[method] !== 'function') {
      throw new Error(
        `Connected wallet does not expose ${method}(); cannot submit a real transaction.`,
      );
    }
  }

  const context = options.context
    ? options.context
    : await runSubmitStage('fetchLedgerContext', () => fetchLedgerContext(session));
  const unproven = await runSubmitStage('buildUnprovenCallTx', () => buildUnprovenCallTx(invocation, context));

  const proven = await runSubmitStage(
    'proveTx',
    async () => {
      const provider =
        options.provingProvider ?? (await requireProvingProvider(session.api));
      const proofProvider = createProofProvider(provider as never);
      return proofProvider.proveTx(unproven.unprovenTx as never) as unknown as {
        serialize: () => Uint8Array;
      };
    },
  );

  const balanced = await runSubmitStage('balanceUnsealedTransaction', async () => {
    const result = await session.api.balanceUnsealedTransaction?.(bytesToHex(proven.serialize()));
    if (!result?.tx) {
      throw new Error('Wallet did not return a balanced transaction to submit.');
    }
    return result;
  });
  await runSubmitStage('submitTransaction', async () => {
    await session.api.submitTransaction?.(balanced.tx);
  });

  const confirmed = await runSubmitStage('confirmOnChain', () => confirmCallOnChain(invocation.circuitId));
  return {
    txHash: confirmed.txHash,
    entryPoint: confirmed.entryPoint,
    confirmedOnChain: true,
    action: confirmed.action,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ConfirmedCall {
  txHash: string;
  entryPoint: string;
  /** The indexer-confirmed action itself — its state/zswap feed the NEXT call. */
  action: ContractCallAction;
}

/**
 * Confirms the submitted call on the indexer. The wallet's `submitTransaction`
 * returns no hash, and there is no reliable way to recompute the on-chain
 * transaction hash from the balanced tx hex, so confirmation is purely
 * observational: snapshot the latest indexed action, then poll for a NEW
 * `ContractCall` whose `entryPoint` matches the circuit we just submitted.
 * Returns only an indexer-confirmed hash. When a DIFFERENT call finalizes
 * first, that is reported honestly instead of guessing.
 */
async function confirmCallOnChain(circuitId: ProvableCircuitOfContract): Promise<ConfirmedCall> {
  const address = configuredContractAddress();
  const before = await fetchLatestContractAction(PREPROD_ENDPOINTS.indexerUrl, address);
  const beforeHash = before?.transaction.hash ?? null;

  const deadline = Date.now() + 90_000;
  let lastSeen = before;
  while (Date.now() < deadline) {
    await sleep(3000);
    const latest = await fetchLatestContractAction(PREPROD_ENDPOINTS.indexerUrl, address);
    if (!latest) continue;
    lastSeen = latest;
    // Not advanced past our snapshot yet; keep waiting.
    if (latest.transaction.hash === beforeHash) continue;
    if (latest.kind === 'ContractCall' && latest.entryPoint === circuitId) {
      return {
        txHash: latest.transaction.hash,
        entryPoint: latest.entryPoint,
        action: latest as ContractCallAction,
      };
    }
    throw new Error(
      `A different on-chain action appeared (${latest.kind}${
        latest.kind === 'ContractCall' ? ` ${latest.entryPoint}` : ''
      }) before the submitted ${circuitId} call confirmed. ` +
        'The submitted transaction may still finalize; refresh on-chain status shortly.',
    );
  }
  throw new Error(
    `Submitted ${circuitId} call was not indexed within 90s (last seen ${
      lastSeen ? `${lastSeen.kind}@${lastSeen.transaction.block.height}` : 'none'
    }). ` + 'The wallet may still be finalizing; re-check on-chain status shortly.',
  );
}