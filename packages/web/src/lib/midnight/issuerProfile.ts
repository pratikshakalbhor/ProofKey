/**
 * VeriShield issuer identity — a real, per-wallet issuer profile.
 *
 * The ledger binds issuer authority to the scalar behind the registered
 * verifying key (`ecMulGenerator(sk)`, checked by `requireIssuerAuthority`),
 * NOT to the connected wallet: the DApp Connector exposes only PUBLIC Zswap
 * keys, so the issuer signing secret must be generated client-side at profile
 * creation and held by this wallet's browser profile.
 *
 * Design rules honoured here:
 *  - every issuerId is bound to the wallet it was created with
 *    (`hashLabel('issuer:<name>:<walletKey>')`), so two wallets can represent
 *    two different issuers even under the same institution name;
 *  - the 32-byte issuer secret NEVER leaves the browser, is never logged and
 *    never enters React state — it lives in localStorage + a module-scope
 *    cache;
 *  - a profile is only treated as registered when the indexer-confirmed
 *    contract state says so (`classifyInvocation === 'already-on-chain'`);
 *  - issuance and revocation go through the REAL deployed contract
 *    (`anchorCredential` / `revokeCredential`) via the user's 1AM wallet; an
 *    already-on-chain registration is reported as such, never faked as new.
 */

import type { CredentialDisclosure, CredentialType } from '@verishield/shared';
import {
  serializeCredential,
  type BuiltCredential,
  type SerializedCredential,
} from '@verishield/shared';
import { loadVeriShieldSdk } from './sdk';
import {
  classifyInvocation,
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

export interface IssuerProfileInput {
  name: string;
  institutionType: string;
  country: string;
  website?: string;
}

/** Public issuer facts — safe to render and store in reactive state. */
export interface IssuerProfilePublic {
  walletKey: string;
  issuerId: string;
  name: string;
  institutionType: string;
  country: string;
  website?: string;
  verifyingKey: { x: string; y: string };
  registeredAt: number;
}

/** Full profile including the secret. Never placed in reactive state. */
export interface IssuerProfile extends IssuerProfilePublic {
  /** 32-byte issuer signing secret (64 hex chars). SENSITIVE. */
  secretHex: string;
}

/** Public, PII-free record of an anchored credential for the Issued list. */
export interface IssuedCredentialView {
  id: string;
  disclosure: CredentialDisclosure;
  holderName: string;
  credentialType: CredentialType;
  headline: string;
  issuedAt: number;
  revoked: boolean;
  /** Indexer-confirmed anchor transaction hash; null until actually issued. */
  txHash: string | null;
}

export type RealtimeIssueInput = {
  holderName: string;
  credentialType: CredentialType;
  degree: string;
  cgpa: number;
  dateOfBirth: string;
  licenseNumber?: string;
  issuedAt?: number | string | Date;
};

const PROFILES_STORAGE_KEY = 'verishield:issuer:profiles';

/**
 * Built credentials retained for OFF-CHAIN delivery to the holder. When the
 * issuer exports a credential, the holder needs the full private material
 * (payload + salt) to prove from it — that transfer is exactly what a real
 * credential wallet does. Kept in this wallet's browser slot only.
 */
function builtStorageKey(walletKey: string): string {
  return `verishield:issuer:built:${walletKey}`;
}

const builtCache = new Map<string, BuiltCredential>();

function readBuiltRecords(walletKey: string): SerializedCredential[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(builtStorageKey(walletKey));
    return raw ? (JSON.parse(raw) as SerializedCredential[]) : [];
  } catch {
    return [];
  }
}

function writeBuiltRecords(walletKey: string, records: SerializedCredential[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(builtStorageKey(walletKey), JSON.stringify(records));
  } catch {
    // Best-effort; the module cache stays usable for the session.
  }
}

function retainBuiltCredential(walletKey: string, built: BuiltCredential): void {
  builtCache.set(built.disclosure.id, built);
  const records = readBuiltRecords(walletKey).filter((r) => r.disclosure.id !== built.disclosure.id);
  records.push(serializeCredential(built));
  writeBuiltRecords(walletKey, records);
}

export function listExportableCredentialIds(walletKey: string): string[] {
  return readBuiltRecords(walletKey).map((r) => r.disclosure.id);
}

function readStoredProfiles(): Record<string, IssuerProfile> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, IssuerProfile>) : {};
  } catch {
    return {};
  }
}

function writeStoredProfiles(profiles: Record<string, IssuerProfile>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // Storage can be unavailable (private mode / quota). The in-memory profile
    // stays usable for the session; registration is still on-chain regardless.
  }
}

/** Storage key holding this wallet's issued-credential list. */
export function issuedStorageKey(walletKey: string): string {
  return `verishield:issuer:issued:${walletKey}`;
}

export function loadIssuedCredentials(walletKey: string): IssuedCredentialView[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(issuedStorageKey(walletKey));
    return raw ? (JSON.parse(raw) as IssuedCredentialView[]) : [];
  } catch {
    return [];
  }
}

export function saveIssuedCredentials(walletKey: string, views: IssuedCredentialView[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(issuedStorageKey(walletKey), JSON.stringify(views));
  } catch {
    // Best-effort; the list remains in store state for this session.
  }
}

/** Loads a stored profile (including its secret) for this wallet's slot. */
export function loadStoredProfile(walletKey: string): IssuerProfile | null {
  return readStoredProfiles()[walletKey] ?? null;
}

/** Persists a profile to this wallet's localStorage slot. */
export function saveIssuerProfile(profile: IssuerProfile): void {
  const profiles = readStoredProfiles();
  profiles[profile.walletKey] = profile;
  writeStoredProfiles(profiles);
}

/** Stable wallet identity: the wallet's shielded Zswap coin public key. */
export async function walletKeyOf(session: PreprodSession): Promise<string> {
  const addresses = await session.api.getShieldedAddresses?.();
  const key = addresses?.shieldedCoinPublicKey;
  if (!key) {
    throw new Error(
      'Connected wallet is missing a shielded coin public key; cannot associate an issuer profile.',
    );
  }
  return key;
}

/** The wallet-bound issuer identifier: same wallet+name always maps to itself. */
export async function deriveIssuerId(name: string, walletKey: string): Promise<string> {
  const sdk = await loadVeriShieldSdk();
  return sdk.toHex(sdk.hashLabel(`issuer:${name}:${walletKey}`));
}

export async function issuerSigningScalar(profile: Pick<IssuerProfile, 'secretHex'>): Promise<bigint> {
  const sdk = await loadVeriShieldSdk();
  return sdk.signingKeyFromSecret(sdk.fromHex(profile.secretHex));
}

/** Builds a NEW wallet-bound issuer profile with a fresh random secret. */
export async function createIssuerProfile(input: IssuerProfileInput, walletKey: string): Promise<IssuerProfile> {
  const sdk = await loadVeriShieldSdk();
  const secretHex = sdk.toHex(sdk.randomBytes(32));
  const issuerId = sdk.toHex(sdk.hashLabel(`issuer:${input.name}:${walletKey}`));
  const verifyingKey = sdk.pointToHex(sdk.issuerVerifyingKeyFromSecret(secretHex));
  // Mirrors the contract's Bytes<32> rejection before any real work happens.
  sdk.encodeField(input.name);
  return {
    walletKey,
    issuerId,
    name: input.name,
    institutionType: input.institutionType,
    country: input.country,
    website: input.website,
    verifyingKey,
    registeredAt: Math.floor(Date.now() / 1000),
    secretHex,
  };
}

/** Drops the secret so a profile is safe to place in reactive state. */
export function publicOf(profile: IssuerProfile): IssuerProfilePublic {
  return {
    walletKey: profile.walletKey,
    issuerId: profile.issuerId,
    name: profile.name,
    institutionType: profile.institutionType,
    country: profile.country,
    website: profile.website,
    verifyingKey: profile.verifyingKey,
    registeredAt: profile.registeredAt,
  };
}

export async function buildRegisterIssuerInvocation(profile: IssuerProfile): Promise<CallInvocation> {
  const sdk = await loadVeriShieldSdk();
  return {
    circuitId: 'registerIssuer',
    args: [sdk.fromHex(profile.issuerId), sdk.encodeField(profile.name), BigInt(profile.registeredAt)],
    values: { issuerSigningKey: await issuerSigningScalar(profile) },
  };
}

export async function buildAnchorCredentialInvocation(
  profile: IssuerProfile,
  commitmentHex: string,
): Promise<CallInvocation> {
  const sdk = await loadVeriShieldSdk();
  return {
    circuitId: 'anchorCredential',
    args: [sdk.fromHex(profile.issuerId), sdk.fromHex(commitmentHex)],
    values: { issuerSigningKey: await issuerSigningScalar(profile) },
  };
}

export async function buildRevokeCredentialInvocation(
  profile: IssuerProfile,
  commitmentHex: string,
): Promise<CallInvocation> {
  const sdk = await loadVeriShieldSdk();
  return {
    circuitId: 'revokeCredential',
    args: [sdk.fromHex(profile.issuerId), sdk.fromHex(commitmentHex)],
    values: { issuerSigningKey: await issuerSigningScalar(profile) },
  };
}

/** Pure on-chain observation: never treats a profile as registered without evidence. */
export async function isIssuerRegisteredOnChain(profile: IssuerProfile, context: LedgerContext): Promise<boolean> {
  return (await classifyInvocation(await buildRegisterIssuerInvocation(profile), context)) === 'already-on-chain';
}

export type RegistrationResult =
  | { kind: 'confirmed'; submission: SubmittedCall }
  | { kind: 'already-on-chain' };

/**
 * Registration via the real contract. Only indexer-confirmed hashes advance a
 * brand-new registration; a registration that is already genuinely on-chain is
 * classified and reported honestly instead of being faked as a fresh success.
 */
export async function registerIssuerRealtime(
  session: PreprodSession,
  profile: IssuerProfile,
  options: SubmitOptions = {},
): Promise<RegistrationResult> {
  const context = options.context ?? (await fetchLedgerContext(session));
  if ((await classifyInvocation(await buildRegisterIssuerInvocation(profile), context)) === 'already-on-chain') {
    return { kind: 'already-on-chain' };
  }
  return {
    kind: 'confirmed',
    submission: await submitOnChainCall(session, await buildRegisterIssuerInvocation(profile), options),
  };
}

/** Builds the credential, anchors it on-chain, and returns its public view. */
export async function issueCredentialRealtime(
  session: PreprodSession,
  profile: IssuerProfile,
  input: RealtimeIssueInput,
  options: SubmitOptions = {},
): Promise<IssuedCredentialView> {
  const context = options.context ?? (await fetchLedgerContext(session));
  const provider = options.provingProvider ?? (await prepareProvingProvider(session.api));
  const sdk = await loadVeriShieldSdk();
  const schemaName = SCHEMA_NAMES_BY_TYPE[input.credentialType];

  const built = sdk.buildCredential(
    {
      issuerName: profile.name,
      issuerId: profile.issuerId,
      schemaName,
      subject: {
        name: input.holderName,
        degree: input.degree,
        dateOfBirth: input.dateOfBirth,
        cgpa: input.cgpa,
      },
      ...(input.issuedAt !== undefined ? { issuedAt: input.issuedAt } : {}),
    },
    profile.secretHex,
  );

  const submission = await submitOnChainCall(
    session,
    await buildAnchorCredentialInvocation(profile, sdk.toHex(built.commitment)),
    { context, provingProvider: provider },
  );

  // Retain the full built credential so the issuer can deliver it to the
  // intended holder off-chain (export in the Issuer console).
  retainBuiltCredential(profile.walletKey, built);

  const headline =
    input.credentialType === 'license'
      ? (input.licenseNumber ?? 'Professional license')
      : input.credentialType === 'id'
        ? 'Government-issued identity'
        : input.degree;

  return {
    id: built.disclosure.id,
    disclosure: built.disclosure,
    holderName: input.holderName,
    credentialType: input.credentialType,
    headline,
    issuedAt: built.disclosure.issuedAt,
    revoked: false,
    txHash: submission.txHash,
  };
}

/** Revokes on-chain. Only the issuer proving the registered scalar may do this. */
export async function revokeCredentialRealtime(
  session: PreprodSession,
  profile: IssuerProfile,
  commitmentHex: string,
  options: SubmitOptions = {},
): Promise<SubmittedCall> {
  const context = options.context ?? (await fetchLedgerContext(session));
  const provider = options.provingProvider ?? (await prepareProvingProvider(session.api));
  return submitOnChainCall(session, await buildRevokeCredentialInvocation(profile, commitmentHex), {
    context,
    provingProvider: provider,
  });
}

/**
 * Exports a previously issued credential as the off-chain delivery artifact:
 * the full serialized `BuiltCredential` (private payload + salt) that the
 * holder must import to prove from it. Throws when the retained record is no
 * longer available (e.g. this wallet slot was cleared).
 */
export function exportIssuedCredential(id: string): string {
  const cached = builtCache.get(id);
  if (cached) return JSON.stringify(serializeCredential(cached));
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('verishield:issuer:built:')) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const records = JSON.parse(raw) as SerializedCredential[];
        const match = records.find((r) => r.disclosure.id === id);
        if (match) return JSON.stringify(match);
      } catch {
        // Skip unreadable slots; keep scanning.
      }
    }
  }
  throw new Error('This credential was issued before export support existed, or its record is no longer available.');
}