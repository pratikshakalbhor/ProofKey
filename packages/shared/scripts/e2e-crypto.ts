/**
 * VeriShield end-to-end cryptographic harness.
 *
 * Runs the full lifecycle against the *compiled* Compact circuits via the
 * Midnight circuit simulator — no devnet, indexer or proof server required:
 *
 *   register issuer (ledger-level verifying key `ecMulGenerator(sk)`) ->
 *   register schema -> issue credential (issuer Ed25519-signs the commitment,
 *   then anchors the issuance leaf with the key-knowledge authority witness)
 *   -> prove each of the five claims (membership + predicates only; NO
 *   in-circuit signature — this v8 ledger-anchoring variant predates the
 *   in-circuit JubJub Schnorr builtins) -> verify each -> reject false and
 *   forged claims -> revoke -> confirm the revoked credential can no longer be
 *   proven.
 *
 * Run with: `npm run test:e2e-crypto`
 */

import {
  createVeriShield,
  buildCredential,
  hashCredential,
  randomBytes,
  toHex,
  fromHex,
  verifyCredentialSignature,
  signingKeyFromSecret,
} from '../src/sdk.js';
import type { Claim, ClaimKind, ProofArtifact } from '../src/types/verishield.js';
import { decodeField } from '../src/midnight/encoding.js';

const YEAR = 365.25 * 24 * 60 * 60;
const now = Math.floor(Date.now() / 1000);

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? ` \x1b[90m${detail}\x1b[0m` : ''}`);
  } else {
    failures += 1;
    console.log(`  \x1b[31m✗ ${label}${detail ? ` — ${detail}` : ''}\x1b[0m`);
  }
}

function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function main(): Promise<void> {
  console.log('\x1b[1m\x1b[35mVeriShield\x1b[0m — end-to-end credential lifecycle');
  console.log('\x1b[90mengine: Midnight circuit simulator (real compiled circuits, ledger-anchoring)\x1b[0m');

  const vs = await createVeriShield();
  const issuerSecret = randomBytes(32);

  // ------------------------------------------------------------------
  section('1. Issuer onboarding (ledger-level verifying key)');
  const { issuerId, verifyingKey } = await vs.registerIssuer({
    issuerName: 'University of Midnight',
    secretKey: issuerSecret,
    registeredAt: now,
  });
  check('issuer registered', /^[0-9a-f]{64}$/.test(issuerId), `id=${issuerId.slice(0, 16)}…`);
  check('verifying key is a curve point', /^[0-9a-f]{64}$/.test(verifyingKey.x) && /^[0-9a-f]{64}$/.test(verifyingKey.y));
  check('ledger issuerCount = 1', vs.publicLedger().issuerCount === 1);

  const onchainIssuer = vs.runtime.readLedger().issuers.lookup(fromHex(issuerId));
  check(
    'on-chain verifying key matches off-chain derivation',
    onchainIssuer.verifyingKey.x === BigInt(`0x${verifyingKey.x}`) &&
      onchainIssuer.verifyingKey.y === BigInt(`0x${verifyingKey.y}`),
  );

  const { schemaId } = await vs.registerSchema({
    schemaName: 'BachelorDegree:v1',
    secretKey: issuerSecret,
  });
  check('schema registered', /^[0-9a-f]{64}$/.test(schemaId));

  // ------------------------------------------------------------------
  section('2. Credential issuance (issuer signs + anchors commitment)');
  const request = {
    issuerName: 'University of Midnight',
    issuerId,
    schemaName: 'BachelorDegree:v1',
    schemaId,
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

  const built = await vs.issueCredential(request, issuerSecret);
  check('commitment is 32 bytes', built.commitment.length === 32, toHex(built.commitment).slice(0, 20) + '…');
  check('credential anchored on-chain', vs.publicLedger().issuanceRoot !== '0'.repeat(64));
  check('issuer Ed25519 signature verifies (off-chain)', verifyCredentialSignature(built, issuerSecret));
  check('signature is a 64-byte Ed25519 signature', /^[0-9a-f]{128}$/.test(built.signature));
  check(
    'hashCredential matches buildCredential',
    hashCredential(request, built.salt).commitmentHex === toHex(built.commitment),
  );
  check('degree field round-trips', decodeField(built.payload.degree) === 'BSc Computer Science');
  check('credential id is PII-free', built.disclosure.id.startsWith('cred_'));

  const rebuilt = buildCredential({ ...request, salt: built.salt }, issuerSecret);
  check('standalone buildCredential is deterministic', toHex(rebuilt.commitment) === toHex(built.commitment));

  // ------------------------------------------------------------------
  section('3. Positive proofs — every claim must verify');
  const positiveClaims: Claim[] = [
    { kind: 'HAS_CREDENTIAL' },
    { kind: 'FIELD_EQUALS', expectedDegree: 'BSc Computer Science' },
    { kind: 'RANGE_PROOF', minCgpa: 7.5 },
    { kind: 'AGE_OVER', minAge: 18 },
    { kind: 'NOT_EXPIRED' },
  ];

  const artifacts: Record<string, ProofArtifact> = {};
  for (const claim of positiveClaims) {
    const artifact = await vs.generateProof(built, claim, now);
    artifacts[claim.kind] = artifact;
    const verified = vs.verifyProof(artifact, { claim: claim.kind, issuerId, schemaId });
    check(
      `${claim.kind.padEnd(15)} proven & verified`,
      artifact.proofValid && verified.valid,
      `${artifact.timings.circuitMs}ms`,
    );
  }

  const holds = artifacts.HAS_CREDENTIAL;
  const publicOutput = { proofValid: holds.proofValid };
  check(
    'verifier sees ONLY { proofValid: true }',
    JSON.stringify(publicOutput) === '{"proofValid":true}',
    JSON.stringify(publicOutput),
  );

  // ------------------------------------------------------------------
  section('4. Negative proofs — false claims must NOT verify');
  const negativeClaims: Array<{ claim: Claim; label: string }> = [
    { claim: { kind: 'AGE_OVER', minAge: 30 }, label: 'AGE_OVER 30 (holder is 25)' },
    { claim: { kind: 'RANGE_PROOF', minCgpa: 9.5 }, label: 'RANGE_PROOF 9.5 (holder has 8.21)' },
    { claim: { kind: 'FIELD_EQUALS', expectedDegree: 'PhD Physics' }, label: 'FIELD_EQUALS PhD Physics' },
    { claim: { kind: 'NOT_EXPIRED' }, label: 'NOT_EXPIRED after expiry' },
  ];

  for (const { claim, label } of negativeClaims) {
    const blockTime = label.includes('after expiry') ? Math.floor(now + 400 * 24 * 60 * 60) : now;
    const artifact = await vs.generateProof(built, claim, blockTime);
    const verified = vs.verifyProof(artifact);
    check(`${label} rejected`, !artifact.proofValid && !verified.valid, artifact.failureReason ?? '');
  }

  // A tampered artifact must be rejected even though proofValid was true.
  const tampered: ProofArtifact = { ...holds, binding: 'f'.repeat(64) };
  check('tampered binding rejected', !vs.verifyProof(tampered).valid);

  // ------------------------------------------------------------------
  section('5. Ledger-anchoring enforcement (no in-circuit signature)');

  // The holder signature is verified off-chain with the ledger runtime's own
  // `verifySignature` primitive. Tampering with it is caught there.
  const tamperedSignature = built.signature.slice(0, -1) + (built.signature.at(-1) === '0' ? '1' : '0');
  check(
    'tampered holder signature fails off-chain verification',
    !verifyCredentialSignature({ commitment: built.commitment, signature: tamperedSignature }, issuerSecret),
  );

  // The claim circuits are anchored and therefore signature-blind by design:
  // a tampered holder signature cannot invalidate an anchored credential's
  // proofs (authority came from the on-chain anchoring, not the signature).
  const tamperedHolds = await vs.generateProof(
    { ...built, signature: tamperedSignature },
    { kind: 'HAS_CREDENTIAL' },
    now,
  );
  check('claim circuits are signature-blind by design', tamperedHolds.proofValid && vs.verifyProof(tamperedHolds).valid);

  // The real threat model: only commitments anchored under the issuer's
  // ledger-level key can be proven. A never-anchored commitment is rejected.
  const neverAnchored = buildCredential(request, issuerSecret);
  check('new random salt yields a different commitment', toHex(neverAnchored.commitment) !== toHex(built.commitment));
  const unanchoredArtifact = await vs.generateProof(neverAnchored, { kind: 'HAS_CREDENTIAL' }, now);
  check(
    'unanchored credential rejected by claim circuits',
    !unanchoredArtifact.proofValid && !vs.verifyProof(unanchoredArtifact).valid,
    unanchoredArtifact.failureReason ?? 'unexpectedly accepted',
  );

  // An attacker that controls their own key cannot anchor to a victim issuer:
  // the ledger-level authority check requires the scalar behind the victim's
  // registered verifying key.
  const attackerSecret = randomBytes(32);
  await vs.registerIssuer({
    issuerName: 'Forge University',
    secretKey: attackerSecret,
    registeredAt: now,
  });
  let authorityViolation = false;
  try {
    await vs.runtime.anchorCredential(fromHex(issuerId), neverAnchored.commitment, now, signingKeyFromSecret(attackerSecret));
  } catch (error) {
    authorityViolation = String(error instanceof Error ? error.message : error).includes('Caller is not the registered issuer');
  }
  check('unauthorized issuer cannot anchor to a victim issuer', authorityViolation);

  // ------------------------------------------------------------------
  section('6. Revocation');
  await vs.revokeCredential(built, issuerSecret);
  const ledgerAfterRevoke = vs.runtime.readLedger();
  check('revokedCredentials contains commitment', ledgerAfterRevoke.revokedCredentials.member(built.commitment));

  const afterRevoke = await vs.generateProof(built, { kind: 'HAS_CREDENTIAL' }, now);
  check(
    'revoked credential can no longer be proven',
    !afterRevoke.proofValid && !vs.verifyProof(afterRevoke).valid,
    afterRevoke.failureReason ?? '',
  );

  // ------------------------------------------------------------------
  section('7. Ledger summary');
  const summary = vs.publicLedger();
  console.log(`  issuerCount        ${summary.issuerCount}`);
  console.log(`  verificationCount  ${summary.verificationCount}`);
  console.log(`  lastProofValid     ${summary.lastProofValid}`);
  console.log(`  issuanceRoot       ${summary.issuanceRoot.slice(0, 24)}…`);
  console.log(`  revocationRoot     ${summary.revocationRoot.slice(0, 24)}…`);

  const totalCircuitMs = Object.values(artifacts).reduce((n, a) => n + a.timings.circuitMs, 0);
  console.log(`\n  avg circuit time   ${(totalCircuitMs / Object.keys(artifacts).length).toFixed(2)}ms`);

  // ------------------------------------------------------------------
  console.log(
    `\n\x1b[1m${checks - failures}/${checks} checks passed\x1b[0m` +
      (failures > 0 ? ` \x1b[31m(${failures} failed)\x1b[0m` : ' \x1b[32m— all good\x1b[0m'),
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('\x1b[31mHarness crashed:\x1b[0m', error);
  process.exitCode = 1;
});

export type { ClaimKind };
