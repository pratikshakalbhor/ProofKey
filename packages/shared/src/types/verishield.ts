import { z } from 'zod';

/**
 * The five claim families the credential registry can prove.
 * Mirrors `ClaimType` in credential-registry.compact.
 */
export const ClaimKindSchema = z.enum([
  'HAS_CREDENTIAL',
  'FIELD_EQUALS',
  'RANGE_PROOF',
  'AGE_OVER',
  'NOT_EXPIRED',
]);
export type ClaimKind = z.infer<typeof ClaimKindSchema>;

export const ClaimSchema = z
  .object({
    kind: ClaimKindSchema,
    minAge: z.number().int().positive().max(150).optional(),
    minCgpa: z.number().nonnegative().max(10).optional(),
    expectedDegree: z.string().optional(),
  })
  .superRefine((claim, ctx) => {
    if (claim.kind === 'AGE_OVER' && claim.minAge === undefined) {
      ctx.addIssue({ code: 'custom', message: 'AGE_OVER requires minAge' });
    }
    if (claim.kind === 'RANGE_PROOF' && claim.minCgpa === undefined) {
      ctx.addIssue({ code: 'custom', message: 'RANGE_PROOF requires minCgpa' });
    }
    if (claim.kind === 'FIELD_EQUALS' && claim.expectedDegree === undefined) {
      ctx.addIssue({ code: 'custom', message: 'FIELD_EQUALS requires expectedDegree' });
    }
  });
export type Claim = z.infer<typeof ClaimSchema>;

/** What an issuer must supply to mint a credential. */
export interface CredentialIssuanceRequest {
  /** Human label, hashed into a 32-byte issuer id. Ignored if `issuerId` is set. */
  issuerName: string;
  /** Explicit 32-byte issuer id (hex). Derived from `issuerName` when omitted. */
  issuerId?: string;
  /** Human label, hashed into a 32-byte schema id. Ignored if `schemaId` is set. */
  schemaName: string;
  /** Explicit 32-byte schema id (hex). Derived from `schemaName` when omitted. */
  schemaId?: string;
  subject: {
    name: string;
    degree: string;
    /** ISO date string, unix seconds, or Date. */
    dateOfBirth: number | string | Date;
    /** GPA on a 0-10 scale, e.g. 8.21. */
    cgpa: number;
    /** Optional stable holder binding label. Derived from the name when omitted. */
    holderBinding?: string;
  };
  issuedAt?: number | string | Date;
  expiresAt?: number | string | Date;
  /** Explicit commitment salt (hex or bytes). Random when omitted. */
  salt?: Uint8Array | string;
}

export interface CredentialPayloadValue {
  schemaId: Uint8Array;
  holderBinding: Uint8Array;
  nameHash: Uint8Array;
  degree: Uint8Array;
  dob: bigint;
  cgpaTimes100: bigint;
  issueDate: bigint;
  expiryDate: bigint;
}

/** Structural mirror of the runtime's `JubjubPoint`. Declared structurally so
 * the browser-safe entrypoint never imports the Midnight WASM runtime.
 *
 * This is the issuer's verifying key stored ON-CHAIN (`ecMulGenerator(sk)`),
 * the basis for the ledger-level authority check that anchors credentials. */
export interface JubjubPointValue {
  x: bigint;
  y: bigint;
}

/**
 * The issuer's Ed25519 signature over the credential commitment, produced and
 * verified with the ledger runtime's own `signData` / `verifySignature`
 * primitives. Hex-encoded (128 chars).
 *
 * Unlike the v9 in-circuit variant, the claim circuits do NOT verify a
 * signature inside the ZK proof: issuer endorsement is enforced at the LEDGER
 * level when the commitment is anchored (the caller proves control of the
 * scalar behind the registered verifying key). The Ed25519 signature is the
 * portable, offline-checkable endorsement artifact the holder carries.
 */
export type Ed25519SignatureHex = string;

/** Hex-encoded JubJub point, safe for JSON / UI display. */
export interface JubjubPointHex {
  x: string;
  y: string;
}

/** The non-sensitive view of a credential that may be shared freely. */
export interface CredentialDisclosure {
  id: string;
  issuerId: string;
  issuerName: string;
  schemaId: string;
  schemaName: string;
  commitment: string;
  leaf: string;
  /** The issuer's registered JubJub verifying key (as stored on-chain). */
  issuerVerifyingKey: JubjubPointHex;
  issuedAt: number;
  expiresAt: number;
}

export interface BuiltCredential {
  /** Full private payload. Never leaves the holder. */
  payload: CredentialPayloadValue;
  salt: Uint8Array;
  commitment: Uint8Array;
  leaf: Uint8Array;
  /**
   * The issuer's Ed25519 signature over the credential commitment, created
   * with the ledger runtime's `signData`. Verified off-chain with
   * `verifyCredentialSignature`; issuer authority over the issued commitment
   * is enforced on-chain by the ledger-level anchoring (knowledge of the
   * scalar behind the registered `ecMulGenerator` key), not inside the ZK
   * claim circuits.
   */
  signature: Ed25519SignatureHex;
  /** Public, PII-free projection. Safe to show in the UI. */
  disclosure: CredentialDisclosure;
}

export interface ProofTimings {
  /** Milliseconds spent executing the circuit. */
  circuitMs: number;
  /** Milliseconds spent building the proof artifact. */
  totalMs: number;
  /** Milliseconds spent verifying. Populated by `verifyProof`. */
  verifyMs?: number;
}

export interface ProofArtifact {
  version: 1;
  claim: ClaimKind;
  /** The single public output. All a verifier is allowed to see. */
  proofValid: boolean;
  issuerId: string;
  schemaId: string;
  /** Digest binding the artifact to the proof transcript output. */
  binding: string;
  /** Whether a real ZK proof was produced (proof server or on-chain proving). */
  zkProven: boolean;
  engine: ProofEngineKind;
  timings: ProofTimings;
  verifiedAt: number;
  /** Present only when the circuit rejected the claim. */
  failureReason?: string;
  /**
   * Indexer-confirmed on-chain evidence for `engine: 'on-chain'` proofs —
   * the claim circuit transaction the connected wallet proved and broadcast
   * to the REAL deployed Preprod contract. The verifier may re-check it.
   */
  onChain?: {
    txHash: string;
    blockHeight: number;
    entryPoint: string;
    confirmed: true;
  };
}

export type ProofEngineKind = 'circuit-simulator' | 'proof-server' | 'on-chain';

export type ProofOutcome =
  | { ok: true; artifact: ProofArtifact }
  | { ok: false; artifact: ProofArtifact };
