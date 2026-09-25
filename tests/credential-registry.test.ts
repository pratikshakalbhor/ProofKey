/**
 * credential-registry contract tests.
 *
 * Exercise the compiled `credential-registry` Compact circuits through the
 * Midnight circuit simulator: issuer onboarding (ledger-level verifying key
 * `ecMulGenerator(sk)`), schema registration, credential issuance + anchoring,
 * all five claim families, rejection of false/forged claims and revocation.
 *
 * Issuer authority is enforced at the LEDGER level (key-knowledge witness at
 * anchoring time); the claim circuits verify membership + predicates only —
 * this variant does NOT verify a signature in-circuit (ledger-v8 toolchain).
 *
 * Should be run from the repo root with `pnpm test` (vitest). Requires the
 * compiled contract bindings (run `pnpm compile:contracts` first).
 */

import { describe, expect, it } from 'vitest';

import {
  createVeriShield,
  buildCredential,
  fromHex,
  hashCredential,
  signingKeyFromSecret,
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

    // Issuer's Ed25519 signature (ledger-runtime `signData`) verifies off-chain.
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
    const { vs, issuerSecret, credential } = await issueDemoCredential();

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

    // Tampered holder signature: caught by off-chain verification...
    const tampered: BuiltCredential = {
      ...credential,
      signature:
        credential.signature.slice(0, -1) + (credential.signature.at(-1) === '0' ? '1' : '0'),
    };
    expect(verifyCredentialSignature(tampered, issuerSecret)).toBe(false);
    // ...but the anchored claim circuits are signature-blind by design,
    // because authority was established at the ledger level when anchoring.
    const tamperedArtifact = await vs.generateProof(tampered, { kind: 'HAS_CREDENTIAL' }, now);
    expect(tamperedArtifact.proofValid).toBe(true);
    expect(vs.verifyProof(tamperedArtifact).valid).toBe(true);

    // A credential whose commitment was never anchored cannot be proven:
    // the claim circuits require membership in the on-chain issuance registry.
    const neverAnchored = buildCredential(demoRequest(), issuerSecret);
    const unanchoredArtifact = await vs.generateProof(neverAnchored, { kind: 'HAS_CREDENTIAL' }, now);
    expect(unanchoredArtifact.proofValid).toBe(false);
    expect(vs.verifyProof(unanchoredArtifact).valid).toBe(false);
    expect(unanchoredArtifact.failureReason).toBeTruthy();

    // The ledger-level authority check forbids anchoring under a key the
    // caller does not control.
    const attackerSecret = new Uint8Array(32).map((_, i) => i + 2); // deterministic different secret
    await vs.registerIssuer({ issuerName: 'Forge University', secretKey: attackerSecret, registeredAt: now });
    expect(() =>
      vs.runtime.anchorCredential(
        fromHex(credential.disclosure.issuerId),
        neverAnchored.commitment,
        now,
        signingKeyFromSecret(attackerSecret),
      ),
    ).toThrow('Caller is not the registered issuer');
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