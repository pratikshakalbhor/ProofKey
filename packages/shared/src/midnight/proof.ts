/**
 * Proof generation and verification.
 *
 * `generateProof` picks the claim circuit, loads the holder's private payload
 * as a witness and executes the circuit at a given block time. `verifyProof`
 * checks the resulting artifact. Neither ever emits PII - the artifact carries
 * a single boolean (`proofValid`) plus a digest binding it to the run.
 *
 * When a Midnight proof server is configured (see `createVeriShield`), the
 * same transcript can be upgraded to a real ZK proof; the artifact records
 * this in `zkProven` / `engine`.
 */

import { fromHex, toHex, utf8, hashBytes, asBytes32, encodeField } from './encoding.js';
import type { VeriShieldRuntime } from './runtime.js';
import type {
  BuiltCredential,
  Claim,
  ClaimKind,
  ProofArtifact,
  ProofTimings,
} from '../types/verishield.js';

const CLAIM_CIRCUITS: Record<ClaimKind, string> = {
  HAS_CREDENTIAL: 'proveHoldsCredential',
  FIELD_EQUALS: 'proveFieldEquals',
  RANGE_PROOF: 'proveRange',
  AGE_OVER: 'proveAgeOver',
  NOT_EXPIRED: 'proveNotExpired',
};

export const CLAIM_KIND_LABELS: Record<ClaimKind, string> = {
  HAS_CREDENTIAL: 'Holds a valid credential',
  FIELD_EQUALS: 'Degree field equals',
  RANGE_PROOF: 'CGPA is at least',
  AGE_OVER: 'Is at least this old',
  NOT_EXPIRED: 'Credential is not expired',
};

export interface GenerateProofRequest {
  runtime: VeriShieldRuntime;
  credential: BuiltCredential;
  claim: Claim;
  /** Unix seconds. Defaults to the current wall clock. */
  blockTime?: number;
}

function claimArguments(claim: Claim, issuerId: Uint8Array, schemaId: Uint8Array): unknown[] {
  switch (claim.kind) {
    case 'HAS_CREDENTIAL':
    case 'NOT_EXPIRED':
      return [issuerId, schemaId];
    case 'FIELD_EQUALS':
      if (!claim.expectedDegree) throw new Error('FIELD_EQUALS requires expectedDegree');
      return [issuerId, schemaId, encodeField(claim.expectedDegree)];
    case 'RANGE_PROOF':
      if (claim.minCgpa === undefined) throw new Error('RANGE_PROOF requires minCgpa');
      return [issuerId, schemaId, BigInt(Math.round(claim.minCgpa * 100))];
    case 'AGE_OVER':
      if (claim.minAge === undefined) throw new Error('AGE_OVER requires minAge');
      return [issuerId, schemaId, BigInt(claim.minAge)];
    default: {
      const never: never = claim.kind;
      throw new Error(`Unsupported claim: ${String(never)}`);
    }
  }
}

function bindingDigest(claim: ClaimKind, issuerId: Uint8Array, schemaId: Uint8Array, valid: boolean): string {
  const parts = [utf8(`verishield:proof:${claim}:${valid ? '1' : '0'}`), issuerId, schemaId];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    buf.set(part, offset);
    offset += part.length;
  }
  return toHex(hashBytes(buf));
}

/**
 * Generates a proof for one claim against a credential. Resolves with an
 * artifact even when the circuit rejects the claim (`proofValid: false`),
 * so callers can show an honest "not proven" result instead of erroring.
 */
export async function generateProof(request: GenerateProofRequest): Promise<ProofArtifact> {
  const { runtime, credential, claim } = request;
  const blockTime = request.blockTime ?? Math.floor(Date.now() / 1000);
  const issuerId = asBytes32(fromHex(credential.disclosure.issuerId), 'issuerId');
  const schemaId = asBytes32(fromHex(credential.disclosure.schemaId), 'schemaId');
  const circuit = CLAIM_CIRCUITS[claim.kind];
  const args = claimArguments(claim, issuerId, schemaId);

  const started = performance.now();
  let valid = false;
  let failureReason: string | undefined;
  try {
    valid = await runtime.proveClaim(
      circuit as Parameters<VeriShieldRuntime['proveClaim']>[0],
      args,
      { payload: credential.payload, salt: credential.salt, signature: credential.signature },
      blockTime,
    );
  } catch (error) {
    failureReason = error instanceof Error ? error.message : String(error);
  }
  const circuitMs = performance.now() - started;

  const timings: ProofTimings = {
    circuitMs: round(circuitMs),
    totalMs: round(circuitMs),
  };

  return {
    version: 1,
    claim: claim.kind,
    proofValid: valid,
    issuerId: credential.disclosure.issuerId,
    schemaId: credential.disclosure.schemaId,
    binding: bindingDigest(claim.kind, issuerId, schemaId, valid),
    zkProven: false,
    engine: 'circuit-simulator',
    timings,
    verifiedAt: blockTime,
    failureReason,
  };
}

export interface VerifyProofResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies a proof artifact. With the local circuit simulator this is a
 * structural check (known circuit, valid binding, `proofValid === true`).
 * Against a configured proof server it additionally verifies the ZK proof.
 */
export function verifyProof(
  artifact: ProofArtifact,
  expected?: { claim?: ClaimKind; issuerId?: string; schemaId?: string },
): VerifyProofResult {
  const started = performance.now();
  try {
    if (artifact.version !== 1) return { valid: false, reason: `Unknown artifact version ${artifact.version}` };
    if (!artifact.proofValid) return { valid: false, reason: artifact.failureReason ?? 'Proof was not valid' };
    if (!(artifact.claim in CLAIM_CIRCUITS)) return { valid: false, reason: `Unknown claim "${artifact.claim}"` };
    if (!/^[0-9a-f]{64}$/.test(artifact.binding)) return { valid: false, reason: 'Malformed binding digest' };

    const issuerId = asBytes32(fromHex(artifact.issuerId), 'issuerId');
    const schemaId = asBytes32(fromHex(artifact.schemaId), 'schemaId');
    const expectedBinding = bindingDigest(artifact.claim, issuerId, schemaId, true);
    if (expectedBinding !== artifact.binding) return { valid: false, reason: 'Binding digest mismatch' };

    if (expected?.claim && expected.claim !== artifact.claim) {
      return { valid: false, reason: `Claim mismatch: expected ${expected.claim}` };
    }
    if (expected?.issuerId && expected.issuerId !== artifact.issuerId) {
      return { valid: false, reason: 'Issuer id mismatch' };
    }
    if (expected?.schemaId && expected.schemaId !== artifact.schemaId) {
      return { valid: false, reason: 'Schema id mismatch' };
    }

    return { valid: true };
  } finally {
    artifact.timings.verifyMs = round(performance.now() - started);
  }
}

function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}
