/**
 * Holder import integrity gate: `verifyCredentialIntegrity`.
 *
 * A delivered credential package must recompute to the SAME on-chain
 * commitment and issuance leaf before a holder vault accepts it. This suite
 * proves that the gate accepts a genuine export and rejects every class of
 * tamper (payload, salt, commitment, leaf, id) — mirroring the real import
 * path, which refuses to add anything that fails recomputation.
 */

import { describe, expect, it } from 'vitest';

import {
  buildCredential,
  deserializeCredential,
  serializeCredential,
  verifyCredentialIntegrity,
} from '@verishield/shared/sdk';
import type { SerializedCredential } from '@verishield/shared';

const YEAR = 365.25 * 24 * 60 * 60;
const now = Math.floor(Date.now() / 1000);
const ROOT_SECRET = new Uint8Array(32).map((_, i) => i + 1);

const REQUEST = {
  issuerName: 'Integrity University',
  schemaName: 'IntegrityCheck:v1',
  subject: {
    name: 'Test Holder',
    degree: 'MSc Data Science',
    dateOfBirth: now - 26 * YEAR,
    cgpa: 8.7,
  },
  issuedAt: now - 5 * 24 * 60 * 60,
};

function freshExport(): SerializedCredential {
  const built = buildCredential(REQUEST, ROOT_SECRET);
  return serializeCredential(built);
}

function clone(serialized: SerializedCredential): SerializedCredential {
  return JSON.parse(JSON.stringify(serialized)) as SerializedCredential;
}

describe('credential-integity-gate', () => {
  it('accepts a genuine exported package', () => {
    const serialized = freshExport();
    const check = verifyCredentialIntegrity(serialized);
    expect(check.ok).toBe(true);
    expect(check.commitmentOk).toBe(true);
    expect(check.leafOk).toBe(true);
    expect(check.idOk).toBe(true);
    expect(check.error).toBeUndefined();

    // The deserialized built form re-checks identically.
    expect(verifyCredentialIntegrity(deserializeCredential(serialized)).ok).toBe(true);
  });

  it('rejects a tampered salt (private witness)', () => {
    const tampered = clone(freshExport());
    tampered.salt = `${tampered.salt.slice(0, -1)}${tampered.salt.endsWith('0') ? '1' : '0'}`;
    const check = verifyCredentialIntegrity(tampered);
    expect(check.commitmentOk).toBe(false);
    expect(check.ok).toBe(false);
    expect(check.error).toMatch(/commitment/i);
  });

  it('rejects a tampered private payload field', () => {
    const tampered = clone(freshExport());
    tampered.payload.dob = (BigInt(tampered.payload.dob) + 1n).toString();
    const check = verifyCredentialIntegrity(tampered);
    expect(check.commitmentOk).toBe(false);
    expect(check.ok).toBe(false);
  });

  it('rejects a swapped public commitment', () => {
    const tampered = clone(freshExport());
    tampered.payload.cgpaTimes100 = '800';
    tampered.commitment = 'ab'.repeat(32); // valid hex, wrong digest
    tampered.leaf = 'aa'.repeat(32);
    const check = verifyCredentialIntegrity(tampered);
    expect(check.commitmentOk).toBe(false);
    expect(check.leafOk).toBe(false);
    expect(check.ok).toBe(false);
  });

  it('rejects a mismatched issuance leaf', () => {
    const tampered = clone(freshExport());
    tampered.leaf = 'ff'.repeat(32);
    const check = verifyCredentialIntegrity(tampered);
    expect(check.commitmentOk).toBe(true);
    expect(check.leafOk).toBe(false);
    expect(check.ok).toBe(false);
    expect(check.error).toMatch(/leaf/i);
  });

  it('rejects a mismatched credential id', () => {
    const tampered = clone(freshExport());
    tampered.disclosure.id = 'cred_ffffffffffffffff';
    const check = verifyCredentialIntegrity(tampered);
    expect(check.commitmentOk).toBe(true);
    expect(check.idOk).toBe(false);
    expect(check.ok).toBe(false);
    expect(check.error).toMatch(/credential id/i);
  });

  it('rejects malformed payload hex', () => {
    const tampered = clone(freshExport());
    tampered.payload.degree = 'abc'; // odd length -> non-decodable hex
    expect(() => verifyCredentialIntegrity(tampered)).toThrow(/even length/i);
  });

  it('rejects a non-hex payload byte (undecodable), never imports it', () => {
    const tampered = clone(freshExport());
    tampered.payload.degree = 'zz'; // decodes to a 1-byte field -> type check fails
    expect(() => verifyCredentialIntegrity(tampered)).toThrow();
  });
});