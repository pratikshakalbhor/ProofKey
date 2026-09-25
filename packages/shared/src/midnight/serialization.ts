/**
 * JSON-safe credential codec.
 *
 * `BuiltCredential` contains `bigint` and `Uint8Array` values that do not
 * survive `JSON.stringify` / a QR-code claim link. This module converts a
 * credential to a wire format (all bytes hex, all numbers decimal strings) and
 * back, losslessly.
 *
 * Deliberately dependency-free (no WASM runtime import) so it is safe to use
 * from the browser-safe `@verishield/shared` entry point.
 */

import type {
  BuiltCredential,
  CredentialDisclosure,
  CredentialPayloadValue,
} from '../types/verishield.js';

export interface SerializedCredentialPayload {
  schemaId: string;
  holderBinding: string;
  nameHash: string;
  degree: string;
  dob: string;
  cgpaTimes100: string;
  issueDate: string;
  expiryDate: string;
}

export interface SerializedCredential {
  version: 1;
  payload: SerializedCredentialPayload;
  salt: string;
  commitment: string;
  leaf: string;
  /** The issuer's Ed25519 signature over the commitment (hex). */
  signature: string;
  disclosure: CredentialDisclosure;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '');
  if (clean.length % 2 !== 0) throw new Error('Hex string must have an even length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function serializeCredential(credential: BuiltCredential): SerializedCredential {
  const { payload, salt, commitment, leaf, signature, disclosure } = credential;
  return {
    version: 1,
    payload: {
      schemaId: bytesToHex(payload.schemaId),
      holderBinding: bytesToHex(payload.holderBinding),
      nameHash: bytesToHex(payload.nameHash),
      degree: bytesToHex(payload.degree),
      dob: payload.dob.toString(),
      cgpaTimes100: payload.cgpaTimes100.toString(),
      issueDate: payload.issueDate.toString(),
      expiryDate: payload.expiryDate.toString(),
    },
    salt: bytesToHex(salt),
    commitment: bytesToHex(commitment),
    leaf: bytesToHex(leaf),
    signature: signature,
    disclosure,
  };
}

export function deserializeCredential(serialized: SerializedCredential): BuiltCredential {
  if (serialized.version !== 1) {
    throw new Error(`Unsupported serialized credential version ${serialized.version}`);
  }
  const p = serialized.payload;
  const payload: CredentialPayloadValue = {
    schemaId: hexToBytes(p.schemaId),
    holderBinding: hexToBytes(p.holderBinding),
    nameHash: hexToBytes(p.nameHash),
    degree: hexToBytes(p.degree),
    dob: BigInt(p.dob),
    cgpaTimes100: BigInt(p.cgpaTimes100),
    issueDate: BigInt(p.issueDate),
    expiryDate: BigInt(p.expiryDate),
  };
  return {
    payload,
    salt: hexToBytes(serialized.salt),
    commitment: hexToBytes(serialized.commitment),
    leaf: hexToBytes(serialized.leaf),
    signature: serialized.signature,
    disclosure: serialized.disclosure,
  };
}
