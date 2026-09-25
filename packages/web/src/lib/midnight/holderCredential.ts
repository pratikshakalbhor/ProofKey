/**
 * VeriShield holder-side credential library — production holder flow.
 *
 * Credentials reach a holder the way they do in a real credential wallet:
 * the ISSUER exports the full (serialized) built credential off-chain, and the
 * holder imports it into the browser profile of the wallet they connect.
 * Import into the vault is the only wallet association that exists on the
 * chain — the credential payload carries no wallet key, so possession of the
 * credential in this wallet's vault is what binds it, exactly as a paper
 * credential is bound by custody.
 *
 * Honesty rules honoured here:
 *  - the private `BuiltCredential` (payload + salt) is kept in a module-scope
 *    cache and this wallet's localStorage slot ONLY — never in React state,
 *    never logged;
 *  - a credential's status is never guessed: it is classified by EXECUTING the
 *    real `proveHoldsCredential` circuit against the real decoded contract
 *    state from the Preprod indexer (pure observation, no transaction);
 *  - a proof is produced by proving and SUBMITTING the real claim circuit
 *    through the connected 1AM wallet to the deployed contract — no mock
 *    artifacts, no fabricated success. A claim the circuit rejects is
 *    reported honestly (proofValid: false) without paying for a transaction.
 */

import type { BuiltCredential, Claim, CredentialType, ProofArtifact } from '@verishield/shared';
import { deserializeCredential, serializeCredential, type SerializedCredential } from '@verishield/shared';
import { loadVeriShieldSdk } from './sdk';
import {
  buildUnprovenCallTx,
  fetchLedgerContext,
  prepareProvingProvider,
  submitOnChainCall,
  type CallInvocation,
  type LedgerContext,
  type SubmitOptions,
  type SubmittedCall,
} from './onchain';
import type { PreprodSession } from './wallet';
import { SCHEMA_NAMES_BY_TYPE } from './provision';

export type HolderCredentialStatus =
  | 'active'
  | 'revoked'
  | 'not-anchored'
  | 'issuer-inactive'
  | 'schema-unknown'
  | 'unknown';

/** Public, PII-free projection of a vault credential for the UI. */
export interface HolderCredentialView {
  id: string;
  credentialType: CredentialType;
  issuerName: string;
  issuerId: string;
  schemaId: string;
  schemaName: string;
  commitment: string;
  issuedAt: number;
  expiresAt: number;
  status: HolderCredentialStatus;
  importedAt: number;
}

/** One vault record: the full credential (JSON-safe) plus import time. */
export interface StoredHolderCredential {
  serialized: SerializedCredential;
  importedAt: number;
}

const VAULT_PREFIX = 'verishield:holder:vault:';

function vaultKey(walletKey: string): string {
  return `${VAULT_PREFIX}${walletKey}`;
}

function readVault(walletKey: string): StoredHolderCredential[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(vaultKey(walletKey));
    return raw ? (JSON.parse(raw) as StoredHolderCredential[]) : [];
  } catch {
    return [];
  }
}

function writeVault(walletKey: string, records: StoredHolderCredential[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(vaultKey(walletKey), JSON.stringify(records));
  } catch {
    // Best-effort; the in-memory cache stays usable for the session.
  }
}

export function loadStoredCredentials(walletKey: string): StoredHolderCredential[] {
  return readVault(walletKey);
}

export function saveStoredCredentials(walletKey: string, records: StoredHolderCredential[]): void {
  writeVault(walletKey, records);
}

/** Inverse of the shared schema registry: on-chain schema name -> CredentialType. */
export function credentialTypeOf(schemaName: string): CredentialType {
  return (
    (Object.entries(SCHEMA_NAMES_BY_TYPE).find(([, name]) => name === schemaName)?.[0] as CredentialType | undefined) ??
    'id'
  );
}

/** Decodes a stored record back into a usable credential (module-scope only). */
export function decodeStoredCredential(record: StoredHolderCredential): BuiltCredential {
  return deserializeCredential(record.serialized);
}

export function encodeBuiltCredential(built: BuiltCredential): string {
  return JSON.stringify(serializeCredential(built));
}

/** Parses an exported issuer credential string with honest validation. */
export function parseExportedCredential(json: string): BuiltCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('That is not valid JSON. Paste the exact credential exported by the issuer.');
  }
  const record = parsed as Partial<SerializedCredential>;
  if (!record || record.version !== 1 || typeof record.disclosure !== 'object') {
    throw new Error('This file does not look like an exported VeriShield credential.');
  }
  const built = deserializeCredential(record as SerializedCredential);
  if (!built.disclosure.id || !built.disclosure.commitment) {
    throw new Error('The imported credential is missing its identifier.');
  }
  return built;
}

export function toView(built: BuiltCredential, status: HolderCredentialStatus, importedAt: number): HolderCredentialView {
  return {
    id: built.disclosure.id,
    credentialType: credentialTypeOf(built.disclosure.schemaName),
    issuerName: built.disclosure.issuerName,
    issuerId: built.disclosure.issuerId,
    schemaId: built.disclosure.schemaId,
    schemaName: built.disclosure.schemaName,
    commitment: built.disclosure.commitment,
    issuedAt: built.disclosure.issuedAt,
    expiresAt: built.disclosure.expiresAt,
    status,
    importedAt,
  };
}

/**
 * Builds the claim-circuit call invocation. Public arguments are ONLY
 * issuerId/schemaId and the (already public) predicate parameters; the
 * credential payload + salt travel as private witnesses and never appear in
 * the public transaction.
 */
export async function buildClaimInvocation(built: BuiltCredential, claim: Claim): Promise<CallInvocation> {
  const sdk = await loadVeriShieldSdk();
  const issuerId = sdk.fromHex(built.disclosure.issuerId);
  const schemaId = sdk.fromHex(built.disclosure.schemaId);

  let circuitId: CallInvocation['circuitId'];
  let args: unknown[];
  switch (claim.kind) {
    case 'HAS_CREDENTIAL':
      circuitId = 'proveHoldsCredential';
      args = [issuerId, schemaId];
      break;
    case 'NOT_EXPIRED':
      circuitId = 'proveNotExpired';
      args = [issuerId, schemaId];
      break;
    case 'FIELD_EQUALS':
      if (!claim.expectedDegree) throw new Error('FIELD_EQUALS requires an expected degree/field.');
      circuitId = 'proveFieldEquals';
      args = [issuerId, schemaId, sdk.encodeField(claim.expectedDegree)];
      break;
    case 'RANGE_PROOF':
      if (claim.minCgpa === undefined) throw new Error('RANGE_PROOF requires a minimum CGPA.');
      circuitId = 'proveRange';
      args = [issuerId, schemaId, BigInt(Math.round(claim.minCgpa * 100))];
      break;
    case 'AGE_OVER':
      if (claim.minAge === undefined) throw new Error('AGE_OVER requires a minimum age.');
      circuitId = 'proveAgeOver';
      args = [issuerId, schemaId, BigInt(claim.minAge)];
      break;
    default: {
      const never: never = claim.kind;
      throw new Error(`Unsupported claim: ${String(never)}`);
    }
  }

  return { circuitId, args, values: { credentialPayload: built.payload, credentialSalt: built.salt } };
}

function readableCircuitError(error: unknown): string {
  let current: unknown = error;
  const seen = new Set<unknown>();
  let lastMessage = 'unknown circuit error';
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const message = (current as { message?: unknown }).message;
    if (typeof message === 'string' && message) lastMessage = message;
    current = (current as { cause?: unknown }).cause;
  }
  return lastMessage.replace(/^.*?failed assert:\s*/i, '');
}

const REVOKED = /revoked/i;
const NEVER_ISSUED = /never issued by this issuer|does not match anchor/i;
const UNKNOWN_ISSUER = /unknown issuer|issuer inactive/i;
const UNKNOWN_SCHEMA = /unknown schema|schema mismatch/i;

/**
 * Classifies a credential's REAL on-chain status by executing the
 * `proveHoldsCredential` circuit against the current decoded contract state —
 * pure observation, no transaction, no wallet. The circuit's own assertions
 * are the on-chain evidence: whether the commitment is anchored by that
 * issuer and not revoked.
 */
export async function classifyCredentialStatus(
  built: BuiltCredential,
  context: LedgerContext,
): Promise<HolderCredentialStatus> {
  const invocation = await buildClaimInvocation(built, { kind: 'HAS_CREDENTIAL' });
  try {
    await buildUnprovenCallTx(invocation, context);
    return 'active';
  } catch (error) {
    const reason = readableCircuitError(error);
    if (REVOKED.test(reason)) return 'revoked';
    if (NEVER_ISSUED.test(reason)) return 'not-anchored';
    if (UNKNOWN_ISSUER.test(reason)) return 'issuer-inactive';
    if (UNKNOWN_SCHEMA.test(reason)) return 'schema-unknown';
    return 'unknown';
  }
}

async function makeArtifact(
  built: BuiltCredential,
  claim: Claim,
  proofValid: boolean,
  timings: { circuitMs: number; totalMs: number },
  submission: SubmittedCall | null,
  failureReason?: string,
): Promise<ProofArtifact> {
  const sdk = await loadVeriShieldSdk();
  const binding = sdk.computeProofBinding(
    claim.kind,
    sdk.fromHex(built.disclosure.issuerId),
    sdk.fromHex(built.disclosure.schemaId),
    proofValid,
  );
  const artifact: ProofArtifact = {
    version: 1,
    claim: claim.kind,
    proofValid,
    issuerId: built.disclosure.issuerId,
    schemaId: built.disclosure.schemaId,
    binding,
    zkProven: proofValid,
    engine: 'on-chain',
    timings,
    verifiedAt: Math.floor(Date.now() / 1000),
    ...(failureReason !== undefined ? { failureReason } : {}),
    ...(submission
      ? {
          onChain: {
            txHash: submission.txHash,
            blockHeight: submission.action.transaction.block.height,
            entryPoint: submission.entryPoint,
            confirmed: true as const,
          },
        }
      : {}),
  };
  return artifact;
}

export interface ProveClaimOnChainResult {
  artifact: ProofArtifact;
  submission: SubmittedCall | null;
}

/**
 * Produces a REAL proof of `claim` against `built`, verified against the REAL
 * deployed contract. Steps:
 *
 *  1. execute the claim circuit against the real on-chain state (no
 *     transaction, no wallet) — this both classifies the credential and tells
 *     us whether the predicate would hold;
 *  2. if the predicate is rejected, return an honest
 *     `{ proofValid: false, failureReason }` artifact without paying for a
 *     transaction;
 *  3. otherwise prove + balance + broadcast + indexer-confirm the claim
 *     circuit through the connected wallet, and return the confirmed artifact.
 */
export async function proveClaimOnChain(
  session: PreprodSession,
  built: BuiltCredential,
  claim: Claim,
  options: SubmitOptions = {},
): Promise<ProveClaimOnChainResult> {
  const invocation = await buildClaimInvocation(built, claim);
  const context = options.context ?? (await fetchLedgerContext(session));
  const started = performance.now();

  let predicateHolds = true;
  let failureReason: string | undefined;
  try {
    await buildUnprovenCallTx(invocation, context);
  } catch (error) {
    predicateHolds = false;
    failureReason = readableCircuitError(error);
  }

  if (!predicateHolds) {
    const elapsed = performance.now() - started;
    return {
      artifact: await makeArtifact(built, claim, false, { circuitMs: elapsed, totalMs: elapsed }, null, failureReason),
      submission: null,
    };
  }

  const provider = options.provingProvider ?? (await prepareProvingProvider(session.api));
  const submission = await submitOnChainCall(session, invocation, { context, provingProvider: provider });
  const elapsed = performance.now() - started;
  return {
    artifact: await makeArtifact(built, claim, true, { circuitMs: elapsed, totalMs: elapsed }, submission),
    submission,
  };
}