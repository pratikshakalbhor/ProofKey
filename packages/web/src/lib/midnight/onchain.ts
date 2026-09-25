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
import {
  ContractState,
  LedgerParameters,
  ZswapChainState,
} from '@midnight-ntwrk/ledger-v8';
import {
  MidnightBech32m,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';
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
} from './indexer';
import { veriShieldZKConfigProvider, walletKeyMaterialProvider, type ProvableCircuitOfContract } from './zk-key-provider';
import type { MidnightConnectedApi, PreprodSession } from './wallet';

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

interface LedgerContext {
  contractState: ContractState;
  zswapChainState: ZswapChainState;
  ledgerParameters: LedgerParameters;
  coinPublicKey: Uint8Array;
  walletEncryptionPublicKey: Uint8Array;
}

/** Reads the real ledger context for the deployed contract from the indexer. */
export async function fetchLedgerContext(session?: PreprodSession): Promise<LedgerContext> {
  assertPreprod(configuredContractAddress());
  const endpoint = PREPROD_ENDPOINTS.indexerUrl;
  const address = configuredContractAddress();

  const latest = await fetchLatestContractAction(endpoint, address);
  if (!latest) {
    throw new Error('The deployed contract has no indexed actions yet; nothing to call against.');
  }
  const stateHex = latest.state;
  if (!stateHex) {
    throw new Error('The latest contract action carries no state; cannot construct a call.');
  }
  const zswapHex = latest.zswapState;

  let contractState: ContractState;
  try {
    contractState = ContractState.deserialize(hexToBytes(stateHex));
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

  let coinPublicKey = new Uint8Array(32);
  let walletEncryptionPublicKey = new Uint8Array(32);
  if (session) {
    const addresses = await session.api.getShieldedAddresses?.();
    if (!addresses) {
      throw new Error('Connected wallet is missing getShieldedAddresses(); cannot fund a call.');
    }
    const networkId = session.configuration.networkId as never;
    coinPublicKey = Uint8Array.from(
      ShieldedCoinPublicKey.codec.decode(networkId, MidnightBech32m.parse(addresses.shieldedCoinPublicKey)).data,
    );
    walletEncryptionPublicKey = Uint8Array.from(
      ShieldedEncryptionPublicKey.codec.decode(networkId, MidnightBech32m.parse(addresses.shieldedEncryptionPublicKey)).data,
    );
  }

  return { contractState, zswapChainState, ledgerParameters, coinPublicKey, walletEncryptionPublicKey };
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
    coinPublicKey: context.coinPublicKey,
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

async function requireProvingProvider(api: MidnightConnectedApi) {
  const getProvingProvider = api.getProvingProvider;
  if (typeof getProvingProvider !== 'function') {
    throw new Error(
      'This wallet build does not expose getProvingProvider(); no on-chain proof can be produced.',
    );
  }
  return getProvingProvider.call(api, walletKeyMaterialProvider());
}

export interface SubmittedCall {
  txHash: string;
  entryPoint: string;
  confirmedOnChain: boolean;
}

/**
 * Real submit: prove with the wallet, balance, broadcast, then confirm the
 * resulting hash on the indexer. Returns only indexer-confirmed hashes.
 */
export async function submitOnChainCall(
  session: PreprodSession,
  invocation: CallInvocation,
): Promise<SubmittedCall> {
  assertPreprod(configuredContractAddress());
  for (const method of ['balanceUnsealedTransaction', 'submitTransaction'] as const) {
    if (typeof session.api[method] !== 'function') {
      throw new Error(
        `Connected wallet does not expose ${method}(); cannot submit a real transaction.`,
      );
    }
  }

  const context = await fetchLedgerContext(session);
  const unproven = await buildUnprovenCallTx(invocation, context);

  const provingProvider = await requireProvingProvider(session.api);
  const proofProvider = createProofProvider(provingProvider as never);
  const proven = (await proofProvider.proveTx(
    unproven.unprovenTx as never,
  )) as unknown as { serialize: () => Uint8Array };

  const balanced = await session.api.balanceUnsealedTransaction?.(bytesToHex(proven.serialize()));
  if (!balanced?.tx) {
    throw new Error('Wallet did not return a balanced transaction to submit.');
  }
  await session.api.submitTransaction?.(balanced.tx);

  const confirmed = await confirmCallOnChain(invocation.circuitId);
  return { txHash: confirmed.txHash, entryPoint: confirmed.entryPoint, confirmedOnChain: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ConfirmedCall {
  txHash: string;
  entryPoint: string;
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
      return { txHash: latest.transaction.hash, entryPoint: latest.entryPoint };
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