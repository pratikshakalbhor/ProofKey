/**
 * Credential construction, hashing and issuer signatures.
 *
 * `buildCredential` and `hashCredential` call the contract's exported *pure*
 * circuits for every digest, so the commitment/leaf are byte-identical to the
 * values the on-chain circuits recompute.
 *
 * Issuer authenticity is anchored at the LEDGER level: the on-chain registry
 * stores the verifying key `ecMulGenerator(sk)` and every issuance mutation
 * proves knowledge of `sk`. For the holder, the issuer ALSO produces a
 * portable Ed25519 signature over the commitment using the ledger runtime's
 * own `signData` / `verifySignature` primitives — verifiable off-chain by any
 * party holding the issuer key, without a ZK circuit.
 *
 * (This v8 ledger-anchoring variant deliberately does NOT use the in-circuit
 * `jubjubSchnorr*` primitives, which only exist from compact-runtime 0.19.0 /
 * language 0.26 — unavailable on ledger-v8 toolchains.)
 */

import { pureCircuits } from '@verishield/contracts';
import {
  ecMulGenerator,
  signData,
  signingKeyFromBip340,
  signatureVerifyingKey,
  verifySignature,
} from '@midnight-ntwrk/compact-runtime';

import type {
  BuiltCredential,
  CredentialDisclosure,
  CredentialIssuanceRequest,
  CredentialPayloadValue,
  Ed25519SignatureHex,
  JubjubPointValue,
} from '../types/verishield.js';
import {
  BYTES_32,
  asBytes32,
  decodeField,
  encodeField,
  fromHex,
  hashBytes,
  hashLabel,
  pointToHex,
  randomBytes,
  signingKeyFromSecret,
  toHex,
  toUnixSeconds,
  utf8,
} from './encoding.js';
import { deserializeCredential, type SerializedCredential } from './serialization.js';

const FOUR_YEARS_SECONDS = 4 * 365.25 * 24 * 60 * 60;

function resolveSecretKey(secretKey: Uint8Array | string): Uint8Array {
  const bytes = typeof secretKey === 'string' ? fromHex(secretKey) : secretKey;
  return asBytes32(bytes, 'issuerSecretKey');
}

function resolveId(explicit: string | undefined, label: string): Uint8Array {
  if (explicit) return asBytes32(fromHex(explicit), 'explicit id');
  return hashLabel(label);
}

function resolveSalt(salt: Uint8Array | string | undefined): Uint8Array {
  if (salt === undefined) return randomBytes(BYTES_32);
  return asBytes32(typeof salt === 'string' ? fromHex(salt) : salt, 'salt');
}

function buildPayload(
  request: CredentialIssuanceRequest,
  salt: Uint8Array,
): {
  payload: CredentialPayloadValue;
  issuerId: Uint8Array;
  schemaId: Uint8Array;
  issuedAt: number;
  expiresAt: number;
} {
  const issuerId = resolveId(request.issuerId, `issuer:${request.issuerName}`);
  const schemaId = resolveId(request.schemaId, `schema:${request.schemaName}`);
  const issuedAt = request.issuedAt !== undefined ? toUnixSeconds(request.issuedAt) : toUnixSeconds(new Date());
  const expiresAt =
    request.expiresAt !== undefined ? toUnixSeconds(request.expiresAt) : Math.floor(issuedAt + FOUR_YEARS_SECONDS);

  const { name, degree, dateOfBirth, cgpa, holderBinding } = request.subject;
  if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) {
    throw new Error(`buildCredential: cgpa must be between 0 and 10, received ${cgpa}`);
  }

  const payload: CredentialPayloadValue = {
    schemaId,
    holderBinding: holderBinding
      ? hashLabel(`holder:${holderBinding}`)
      : hashLabel(`holder:${name}:${toHex(issuerId)}`),
    nameHash: hashBytes(utf8(`verishield:name:${name}`)),
    degree: encodeField(degree),
    dob: BigInt(toUnixSeconds(dateOfBirth)),
    cgpaTimes100: BigInt(Math.round(cgpa * 100)),
    issueDate: BigInt(issuedAt),
    expiryDate: BigInt(expiresAt),
  };

  void salt;
  return { payload, issuerId, schemaId, issuedAt, expiresAt };
}

function commitmentOf(payload: CredentialPayloadValue, salt: Uint8Array): Uint8Array {
  return asBytes32(
    pureCircuits.commitmentFromPayload(
      payload.schemaId,
      payload.holderBinding,
      payload.nameHash,
      payload.degree,
      payload.dob,
      payload.cgpaTimes100,
      payload.issueDate,
      payload.expiryDate,
      salt,
    ),
    'commitment',
  );
}

/** Computes the on-chain credential commitment and issuance leaf. */
export function hashCredential(
  request: CredentialIssuanceRequest,
  salt?: Uint8Array | string,
): { commitment: Uint8Array; commitmentHex: string; leaf: Uint8Array; leafHex: string } {
  const resolvedSalt = resolveSalt(salt);
  const { payload, issuerId } = buildPayload(request, resolvedSalt);
  const commitment = commitmentOf(payload, resolvedSalt);
  const leaf = asBytes32(pureCircuits.leafFromCommitment(issuerId, commitment), 'leaf');
  return {
    commitment,
    commitmentHex: toHex(commitment),
    leaf,
    leafHex: toHex(leaf),
  };
}

/**
 * Derives the issuer's on-chain verifying key from its 32-byte secret.
 * `ecMulGenerator(sk)` is exactly what `registerIssuer` stores, so the
 * returned point must match the point the chain holds (that equality is the
 * ledger-level authority check).
 */
export function issuerVerifyingKeyFromSecret(secretKey: Uint8Array | string): JubjubPointValue {
  return ecMulGenerator(signingKeyFromSecret(resolveSecretKey(secretKey)));
}

/**
 * Builds a complete credential: computes the commitment, derives the issuance
 * leaf, and produces the issuer's portable Ed25519 signature over the
 * commitment (ledger runtime `signData`). The on-chain anchoring (which
 * requires the ledger-level authority witness) is a separate step —
 * `anchorCredential` / `issueCredential`.
 */
export function buildCredential(
  request: CredentialIssuanceRequest,
  issuerSecretKey: Uint8Array | string,
): BuiltCredential {
  const secretKey = resolveSecretKey(issuerSecretKey);
  const salt = resolveSalt(request.salt);
  const { payload, issuerId, schemaId, issuedAt, expiresAt } = buildPayload(request, salt);
  const commitment = commitmentOf(payload, salt);
  const leaf = asBytes32(pureCircuits.leafFromCommitment(issuerId, commitment), 'leaf');

  const verifyingKey = ecMulGenerator(signingKeyFromSecret(secretKey));
  const signature: Ed25519SignatureHex = signData(signingKeyFromBip340(secretKey), commitment);

  const disclosure: CredentialDisclosure = {
    id: `cred_${toHex(commitment).slice(0, 16)}`,
    issuerId: toHex(issuerId),
    issuerName: request.issuerName,
    schemaId: toHex(schemaId),
    schemaName: request.schemaName,
    commitment: toHex(commitment),
    leaf: toHex(leaf),
    issuerVerifyingKey: pointToHex(verifyingKey),
    issuedAt,
    expiresAt,
  };

  return { payload, salt, commitment, leaf, signature, disclosure };
}

/**
 * Checks the issuer's Ed25519 signature over the credential commitment using
 * the ledger runtime's `verifySignature` primitive against the key derived
 * from the issuer secret.
 */
export function verifyCredentialSignature(
  credential: Pick<BuiltCredential, 'commitment' | 'signature'>,
  issuerSecretKey: Uint8Array | string,
): boolean {
  return verifySignature(
    signatureVerifyingKey(signingKeyFromBip340(resolveSecretKey(issuerSecretKey))),
    credential.commitment,
    credential.signature,
  );
}

export interface CredentialIntegrityCheck {
  ok: boolean;
  commitmentOk: boolean;
  leafOk: boolean;
  idOk: boolean;
  error?: string;
}

/**
 * Honest integrity gate for a delivered credential package, before it is
 * accepted into a holder vault. Recomputes the ON-CHAIN commitment and
 * issuance leaf from the package's own payload + salt using the SAME
 * pure-circuit construction `buildCredential` used at issuance, then checks
 * they match the digests the package ships. A package whose recomputed
 * commitment does not match is corrupted or tampered with and must be
 * rejected. (The recomputed commitment is deterministic, so a re-exported
 * package always re-checks to the same result.)
 */
export function verifyCredentialIntegrity(
  credential: BuiltCredential | SerializedCredential,
): CredentialIntegrityCheck {
  const serialized = 'version' in credential ? (credential as SerializedCredential) : null;
  const built = serialized ? deserializeCredential(serialized) : (credential as BuiltCredential);

  const commitment = commitmentOf(built.payload, built.salt);
  const leaf = asBytes32(pureCircuits.leafFromCommitment(fromHex(built.disclosure.issuerId), commitment), 'leaf');
  const commitmentHex = toHex(commitment);
  const leafHex = toHex(leaf);

  // Disclosure digests are authoritative; the package's own top-level digests
  // must agree with them too (they are redundant in the wire format).
  let commitmentOk = commitmentHex === built.disclosure.commitment;
  let leafOk = leafHex === built.disclosure.leaf;
  if (serialized) {
    commitmentOk = commitmentOk && serialized.commitment === built.disclosure.commitment;
    leafOk = leafOk && serialized.leaf === built.disclosure.leaf;
  }
  const idOk = built.disclosure.id === `cred_${commitmentHex.slice(0, 16)}`;

  if (commitmentOk && leafOk && idOk) {
    return { ok: true, commitmentOk, leafOk, idOk };
  }
  const failures: string[] = [];
  if (!commitmentOk) failures.push('commitment');
  if (!leafOk) failures.push('leaf');
  if (!idOk) failures.push('credential id');
  return {
    ok: false,
    commitmentOk,
    leafOk,
    idOk,
    error: `Recomputed ${failures.join(', ')} does not match the package disclosure.`,
  };
}

/** Human-readable projection of a built credential (no PII beyond the label). */
export function describeCredential(credential: BuiltCredential): CredentialDisclosure {
  return credential.disclosure;
}

/** Convenience re-exports so callers can inspect encoded fields. */
export { encodeField, decodeField, toHex, fromHex };
