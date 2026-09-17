/**
 * Credential construction, hashing and issuer signatures.
 *
 * `buildCredential` and `hashCredential` call the contract's exported *pure*
 * circuits for every digest, so the commitment/leaf are byte-identical to the
 * values the on-chain circuits recompute.
 *
 * Issuer authenticity is a real JubJub Schnorr signature over the credential
 * commitment. It is produced here with `jubjubSchnorrSign` and verified
 * *inside* every claim circuit with `jubjubSchnorrVerify` against the issuer's
 * registered verifying key - so the holder can prove issuer endorsement
 * without revealing the payload and without trusting an off-chain check.
 */

import { pureCircuits } from '@verishield/contracts';
import {
  jubjubSchnorrSign,
  jubjubSchnorrVerify,
  jubjubSchnorrVerifyingKey,
  CompactTypeField,
  CompactTypeVector,
} from '@midnight-ntwrk/compact-runtime';

import type {
  BuiltCredential,
  CredentialDisclosure,
  CredentialIssuanceRequest,
  CredentialPayloadValue,
  JubjubSchnorrSignatureValue,
} from '../types/verishield.js';
import {
  BYTES_32,
  asBytes32,
  commitmentMessageFields,
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

const FOUR_YEARS_SECONDS = 4 * 365.25 * 24 * 60 * 60;

/** Message type: the 32-byte commitment as a `Vector<32, Field>`. */
const COMMITMENT_MESSAGE_TYPE = new CompactTypeVector(32, CompactTypeField);

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

/** Derives the issuer's JubJub verifying key from its 32-byte secret. */
export function issuerVerifyingKeyFromSecret(secretKey: Uint8Array | string): { x: bigint; y: bigint } {
  return jubjubSchnorrVerifyingKey(signingKeyFromSecret(resolveSecretKey(secretKey)));
}

/**
 * Builds a complete credential: computes the commitment, anchors the leaf in
 * the payload, and signs the commitment with the issuer's JubJub Schnorr key.
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

  const signingKey = signingKeyFromSecret(secretKey);
  const verifyingKey = jubjubSchnorrVerifyingKey(signingKey);
  const signature: JubjubSchnorrSignatureValue = jubjubSchnorrSign(
    COMMITMENT_MESSAGE_TYPE,
    commitmentMessageFields(commitment),
    signingKey,
  );

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

/** Verifies the issuer's JubJub Schnorr signature over a credential commitment. */
export function verifyCredentialSignature(
  credential: Pick<BuiltCredential, 'commitment' | 'signature'>,
  issuerSecretKey: Uint8Array | string,
): boolean {
  const verifyingKey = issuerVerifyingKeyFromSecret(issuerSecretKey);
  return jubjubSchnorrVerify(
    COMMITMENT_MESSAGE_TYPE,
    commitmentMessageFields(credential.commitment),
    verifyingKey,
    credential.signature,
  );
}

/** Human-readable projection of a built credential (no PII beyond the label). */
export function describeCredential(credential: BuiltCredential): CredentialDisclosure {
  return credential.disclosure;
}

/** Convenience re-exports so callers can inspect encoded fields. */
export { encodeField, decodeField, toHex, fromHex };
