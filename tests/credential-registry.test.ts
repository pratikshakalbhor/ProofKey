/**
 * credential-registry contract tests.
 *
 * Exercise the compiled `credential-registry` Compact circuits through the
 * Midnight circuit simulator: issuer onboarding (JubJub Schnorr key), schema
 * registration, credential issuance + anchoring, all five claim families,
 * rejection of false/forged claims and revocation.
 *
 * Should be run from the repo root with `pnpm test` (vitest). Requires the
 * compiled contract bindings (run `pnpm compile:contracts` first).
 */

import { describe, expect, it } from 'vitest';

import {
  createVeriShield,
  fromHex,
  hashCredential,
  toHex,
  verifyCredentialSignature,
} from '@verishield/shared/sdk';
import type { BuiltCredential, Claim, ProofArtifact } from '@verishield/shared';

const YEAR = 365.25 * 24 * 60 * 60;
const now = Math.floor(Date.now() / 1000);

interface DemoHarness {
  vs: Awaited<ReturnType<typeof createVeriShield>>;
  issuerSecret: Uint8Array;
  issuerName: string;
  issuerId: string;
  schemaName: string;
  schemaId: string;
  credential: BuiltCredential;
  request: ReturnType<typeof demoRequest>;
}

function demoRequest() {
  return {
    issuerName: 'University of Midnight',
    schemaName: 'BachelorDegree:v1',
    subject: {
      name: 'Priya Sharma',
      degree: 'BSc Computer Science',
      dateOfBirth: now - 25 * YEAR,
      cgpa: 8.21,
      holderBinding: 'priya-sharma',
    },
    issuedAt: now - 10 * 24 * 60 * 60,
    expiresAt: now + 300 * 24 * 60 * 60,
  } as const;
}

async function issueDemoCredential(): Promise<DemoHarness> {
  const vs = await createVeriShield();
  const issuerSecret = new Uint8Array(32).map((_, i) => i + 1); // deterministic test secret

  const { issuerId } = await vs.registerIssuer({
    issuerName: demoRequest().issuerName,
    secretKey: issuerSecret,
    registeredAt: now,
  });
  const { schemaId } = await vs.registerSchema({
    schemaName: demoRequest().schemaName,
    secretKey: issuerSecret,
  });
  const credential = await vs.issueCredential(demoRequest(), issuerSecret);

  return { vs, issuerSecret, issuerName: demoRequest().issuerName, issuerId, schemaName: demoRequest().schemaName, schemaId, credential, request: demoRequest() };
}

const ALL_CLAIMS: Claim[] = [
  { kind: 'HAS_CREDENTIAL' },
  { kind: 'FIELD_EQUALS', expectedDegree: 'BSc Computer Science' },
  { kind: 'RANGE_PROOF', minCgpa: 7.5 },
  { kind: 'AGE_OVER', minAge: 18 },
  { kind: 'NOT_EXPIRED' },
];

describe('credential-registry', () => {
  it('registers an issuer and schema, then issues + anchors a credential', async () => {
    const { vs, issuerSecret, issuerId, credential, request } = await issueDemoCredential();

    expect(issuerId).toMatch(/^[0-9a-f]{64}$/);
    expect(vs.publicLedger().issuerCount).toBe(1);
    expect(vs.publicLedger().issuanceRoot).not.toBe('0'.repeat(64));

    // On-chain verifying key matches the off-chain derivation.
    const onchain = vs.runtime.readLedger().issuers.lookup(fromHex(issuerId));
    expect(onchain.verifyingKey.x).toBe(BigInt(`0x${credential.disclosure.issuerVerifyingKey.x}`));
    expect(onchain.verifyingKey.y).toBe(BigInt(`0x${credential.disclosure.issuerVerifyingKey.y}`));

    // Deterministic commitment: rebuilding with the same salt matches.
    expect(credential.commitment).toHaveLength(32);
    expect(hashCredential(request, credential.salt).commitmentHex).toBe(toHex(credential.commitment));

    // Issuer's JubJub Schnorr signature verifies off-chain.
    expect(verifyCredentialSignature(credential, issuerSecret)).toBe(true);
  });

  it('proves every claim family and each artifact verifies', async () => {
    const { vs, issuerId, schemaId, credential } = await issueDemoCredential();

    for (const claim of ALL_CLAIMS) {
      const artifact: ProofArtifact = await vs.generateProof(credential, claim, now);
      expect(artifact.proofValid, claim.kind).toBe(true);
      expect(vs.verifyProof(artifact, { claim: claim.kind, issuerId, schemaId }).valid, claim.kind).toBe(true);
      expect(artifact.engine).toBe('circuit-simulator');
      expect(artifact.binding).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('rejects false, tampered and forged claims', async () => {
    const { vs, credential } = await issueDemoCredential();

    const falseClaims: Array<{ claim: Claim; blockTime?: number; label: string }> = [
      { claim: { kind: 'AGE_OVER', minAge: 30 }, label: 'AGE_OVER 30 (holder is 25)' },
      { claim: { kind: 'RANGE_PROOF', minCgpa: 9.5 }, label: 'RANGE_PROOF 9.5 (holder has 8.21)' },
      { claim: { kind: 'FIELD_EQUALS', expectedDegree: 'PhD Physics' }, label: 'FIELD_EQUALS PhD Physics' },
      { claim: { kind: 'NOT_EXPIRED' }, blockTime: now + 400 * 24 * 60 * 60, label: 'NOT_EXPIRED after expiry' },
    ];

    for (const { claim, blockTime, label } of falseClaims) {
      const artifact = await vs.generateProof(credential, claim, blockTime);
      expect(artifact.proofValid, label).toBe(false);
      expect(vs.verifyProof(artifact).valid, label).toBe(false);
      expect(artifact.failureReason, label).toBeTruthy();
    }

    // Tampered artifact: proofValid was true but the binding no longer matches.
    const holds = await vs.generateProof(credential, { kind: 'HAS_CREDENTIAL' }, now);
    expect(holds.proofValid).toBe(true);
    expect(vs.verifyProof({ ...holds, binding: 'f'.repeat(64) }).valid).toBe(false);

    // Forged signature: the response is not the issuer's, rejected in-circuit.
    const forged: BuiltCredential = {
      ...credential,
      signature: { ...credential.signature, response: credential.signature.response + 1n },
    };
    const forgedArtifact = await vs.generateProof(forged, { kind: 'HAS_CREDENTIAL' }, now);
    expect(forgedArtifact.proofValid).toBe(false);
    expect(vs.verifyProof(forgedArtifact).valid).toBe(false);
  });

  it('revokes a credential so it can no longer be proven', async () => {
    const { vs, issuerSecret, credential } = await issueDemoCredential();

    await vs.revokeCredential(credential, issuerSecret);
    expect(vs.runtime.readLedger().revokedCredentials.member(credential.commitment)).toBe(true);

    const artifact = await vs.generateProof(credential, { kind: 'HAS_CREDENTIAL' }, now);
    expect(artifact.proofValid).toBe(false);
    expect(vs.verifyProof(artifact).valid).toBe(false);
  });

  it('exposes the exact verifier-visible output: a single boolean', async () => {
    const { vs, credential } = await issueDemoCredential();
    const artifact = await vs.generateProof(credential, { kind: 'HAS_CREDENTIAL' }, now);
    expect(artifact.proofValid).toBe(true);
    expect({ proofValid: artifact.proofValid }).toEqual({ proofValid: true });
    expect(Object.keys({ proofValid: artifact.proofValid })).toEqual(['proofValid']);
  });
});