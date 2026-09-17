import type { BuiltCredential, CredentialIssuanceRequest } from '@verishield/shared';
import type { VeriShield } from '@verishield/shared/sdk';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { loadSdk } from '../lib/sdk.js';

/**
 * MidnightService — the only place the API talks to the chain.
 *
 * It wraps the shared VeriShield SDK (registerIssuer / anchorCredential /
 * revokeCredential / updateRevocationRoot) with retry-on-failure.
 *
 * STATUS: with `CONTRACT_ADDRESS` unset the SDK runs its in-memory circuit
 * simulator. Once the local devnet is up (docker compose) and the contract is
 * deployed, set `CONTRACT_ADDRESS` + the indexer/proof-server URLs and these
 * calls target the real network. See the Phase 3 report for what is real vs
 * simulated.
 */

let clientPromise: Promise<VeriShield> | null = null;

async function getClient(): Promise<VeriShield> {
  clientPromise ??= (async () => {
    const sdk = await loadSdk();
    return sdk.createVeriShield(
      config.contractAddress ? { contractAddress: config.contractAddress } : {},
    );
  })();
  return clientPromise;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff around a single chain operation. */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(200 * 2 ** (attempt - 1));
    }
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw AppError.upstream(`${label} failed after ${attempts} attempts`, { reason });
}

export interface IssuerAnchor {
  issuerId: string;
  verifyingKey: { x: string; y: string };
}

/**
 * Issuers registered in this process's runtime. The circuit simulator keeps
 * ledger state in memory per process, so a fresh API process must re-anchor the
 * institution before any issuer-signed circuit. With a real deployed contract
 * `institutions.midnightTxId` replaces this in-process memo.
 */
const anchoredIssuers = new Set<string>();

/** Anchors the institution's JubJub verifying key on-chain (idempotent per process). */
export async function registerIssuer(
  issuerName: string,
  secret: Uint8Array,
): Promise<IssuerAnchor> {
  const client = await getClient();
  const anchor = await withRetry('registerIssuer', () =>
    client.registerIssuer({ issuerName, secretKey: secret }),
  );
  anchoredIssuers.add(issuerName);
  return anchor;
}

/** Ensures the issuer is registered before an issuer-signed circuit runs. */
async function ensureIssuerRegistered(issuerName: string, secret: Uint8Array): Promise<void> {
  if (anchoredIssuers.has(issuerName)) return;
  await registerIssuer(issuerName, secret);
}

/** Builds a credential and anchors its commitment. Returns the signed credential. */
export async function anchorCredential(
  request: CredentialIssuanceRequest,
  secret: Uint8Array,
): Promise<BuiltCredential> {
  await ensureIssuerRegistered(request.issuerName, secret);
  const client = await getClient();
  return withRetry('anchorCredential', () => client.issueCredential(request, secret));
}

function issuerIdBytes(sdk: Awaited<ReturnType<typeof loadSdk>>, issuerName: string): Uint8Array {
  return sdk.hashLabel(`issuer:${issuerName}`);
}

export async function revokeOnChain(
  issuerName: string,
  payloadHashHex: string,
  secret: Uint8Array,
): Promise<void> {
  await ensureIssuerRegistered(issuerName, secret);
  const sdk = await loadSdk();
  const client = await getClient();
  const blockTime = Math.floor(Date.now() / 1000);
  await withRetry('revokeCredential', () =>
    client.runtime.revokeCredential(
      issuerIdBytes(sdk, issuerName),
      sdk.fromHex(payloadHashHex),
      blockTime,
      sdk.signingKeyFromSecret(secret),
    ),
  );
}

export async function publishRevocationRoot(
  issuerName: string,
  rootHex: string,
  secret: Uint8Array,
): Promise<void> {
  await ensureIssuerRegistered(issuerName, secret);
  const sdk = await loadSdk();
  const client = await getClient();
  const blockTime = Math.floor(Date.now() / 1000);
  await withRetry('updateRevocationRoot', () =>
    client.runtime.publishRevocationRoot(
      issuerIdBytes(sdk, issuerName),
      sdk.fromHex(rootHex),
      blockTime,
      sdk.signingKeyFromSecret(secret),
    ),
  );
}

/** Public, PII-free ledger projection. */
export async function readLedger() {
  const client = await getClient();
  return { contractAddress: client.contractAddress, ...client.publicLedger() };
}
