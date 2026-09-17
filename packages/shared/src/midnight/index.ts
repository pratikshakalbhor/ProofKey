/**
 * VeriShield — the single frontend-facing interface.
 *
 * Everything a UI needs is here:
 *   - buildCredential(request, issuerSecretKey)
 *   - hashCredential(request, salt?)
 *   - generateProof({ runtime, credential, claim, blockTime? })
 *   - verifyProof(artifact, expected?)
 *
 * No consumer should import `@verishield/contracts` or
 * `@midnight-ntwrk/compact-runtime` directly.
 */

import {
  fromHex,
  hashLabel,
  encodeField,
  toHex,
  asBytes32,
  signingKeyFromSecret,
  pointToHex,
} from './encoding.js';
import { VeriShieldRuntime, type RuntimeOptions } from './runtime.js';
import {
  buildCredential as buildCredentialImpl,
  hashCredential as hashCredentialImpl,
  verifyCredentialSignature,
  issuerVerifyingKeyFromSecret,
} from './credential.js';
import {
  generateProof as generateProofImpl,
  verifyProof as verifyProofImpl,
  CLAIM_KIND_LABELS,
  type GenerateProofRequest,
  type VerifyProofResult,
} from './proof.js';
import type {
  BuiltCredential,
  Claim,
  ClaimKind,
  CredentialIssuanceRequest,
  ProofArtifact,
} from '../types/verishield.js';

export interface VeriShieldOptions extends RuntimeOptions {
  /** Reserved for the Phase 3 proof-server integration. */
  proofServerUrl?: string;
}

export interface RegisterIssuerRequest {
  issuerName: string;
  issuerId?: string;
  secretKey: Uint8Array | string;
  registeredAt?: number;
}

export interface RegisterSchemaRequest {
  schemaName: string;
  schemaId?: string;
  schemaHash?: Uint8Array | string;
  secretKey: Uint8Array | string;
}

export class VeriShield {
  readonly runtime: VeriShieldRuntime;
  readonly proofServerUrl?: string;

  constructor(runtime: VeriShieldRuntime, options: VeriShieldOptions = {}) {
    this.runtime = runtime;
    this.proofServerUrl = options.proofServerUrl;
  }

  // --- reads --------------------------------------------------------------

  get contractAddress(): string {
    return this.runtime.contractAddress;
  }

  publicLedger() {
    const l = this.runtime.readLedger();
    return {
      issuerCount: Number(l.issuerCount),
      verificationCount: Number(l.verificationCount),
      lastProofValid: l.lastProofValid,
      revocationRoot: toHex(l.revocationRoot),
      issuanceRoot: toHex(l.issuanceRoot),
    };
  }

  // --- issuer operations --------------------------------------------------

  async registerIssuer(
    request: RegisterIssuerRequest,
  ): Promise<{ issuerId: string; verifyingKey: { x: string; y: string } }> {
    const issuerId = request.issuerId
      ? asBytes32(fromHex(request.issuerId), 'issuerId')
      : hashLabel(`issuer:${request.issuerName}`);
    const registeredAt = request.registeredAt ?? Math.floor(Date.now() / 1000);
    const secretKey = asSecretKey(request.secretKey);
    const signingKey = signingKeyFromSecret(secretKey);
    await this.runtime.registerIssuer(
      issuerId,
      encodeField(request.issuerName),
      registeredAt,
      signingKey,
    );
    return {
      issuerId: toHex(issuerId),
      verifyingKey: pointToHex(issuerVerifyingKeyFromSecret(secretKey)),
    };
  }

  async registerSchema(request: RegisterSchemaRequest): Promise<{ schemaId: string }> {
    const schemaId = request.schemaId
      ? asBytes32(fromHex(request.schemaId), 'schemaId')
      : hashLabel(`schema:${request.schemaName}`);
    const schemaHash = request.schemaHash
      ? asBytes32(typeof request.schemaHash === 'string' ? fromHex(request.schemaHash) : request.schemaHash, 'schemaHash')
      : hashLabel(`schema-hash:${request.schemaName}`);
    await this.runtime.registerSchema(schemaId, schemaHash, Math.floor(Date.now() / 1000));
    return { schemaId: toHex(schemaId) };
  }

  /** Builds a credential and anchors its commitment on-chain. */
  async issueCredential(
    request: CredentialIssuanceRequest,
    secretKey: Uint8Array | string,
  ): Promise<BuiltCredential> {
    const credential = buildCredentialImpl(request, secretKey);
    const blockTime = Number(credential.payload.issueDate);
    await this.runtime.anchorCredential(
      fromHex(credential.disclosure.issuerId),
      credential.commitment,
      blockTime,
      signingKeyFromSecret(asSecretKey(secretKey)),
    );
    return credential;
  }

  async revokeCredential(credential: BuiltCredential, secretKey: Uint8Array | string): Promise<void> {
    const blockTime = Math.floor(Date.now() / 1000);
    await this.runtime.revokeCredential(
      fromHex(credential.disclosure.issuerId),
      credential.commitment,
      blockTime,
      signingKeyFromSecret(asSecretKey(secretKey)),
    );
  }

  verifyIssuerSignature(credential: BuiltCredential, secretKey: Uint8Array | string): boolean {
    return verifyCredentialSignature(credential, secretKey);
  }

  // --- holder / verifier operations --------------------------------------

  generateProof(credential: BuiltCredential, claim: Claim, blockTime?: number): Promise<ProofArtifact> {
    return generateProofImpl({ runtime: this.runtime, credential, claim, blockTime });
  }

  verifyProof(
    artifact: ProofArtifact,
    expected?: { claim?: ClaimKind; issuerId?: string; schemaId?: string },
  ): VerifyProofResult {
    return verifyProofImpl(artifact, expected);
  }
}

function asSecretKey(secretKey: Uint8Array | string): Uint8Array {
  return asBytes32(typeof secretKey === 'string' ? fromHex(secretKey) : secretKey, 'issuerSecretKey');
}

export async function createVeriShield(options: VeriShieldOptions = {}): Promise<VeriShield> {
  const runtime = await VeriShieldRuntime.create(options);
  return new VeriShield(runtime, options);
}

// Standalone bindings (same semantics as the methods above).
export const buildCredential = buildCredentialImpl;
export const hashCredential = hashCredentialImpl;
export const generateProof = generateProofImpl;
export const verifyProof = verifyProofImpl;

export { CLAIM_KIND_LABELS };
export type { GenerateProofRequest, VerifyProofResult };

export {
  VeriShieldRuntime,
  type RuntimeOptions,
} from './runtime.js';
export {
  encodeField,
  decodeField,
  toHex,
  fromHex,
  hashLabel,
  hashBytes,
  randomBytes,
  toUnixSeconds,
  equalsBytes,
  signingKeyFromSecret,
  commitmentMessageFields,
  pointToHex,
} from './encoding.js';

export {
  verifyCredentialSignature,
  describeCredential,
  issuerVerifyingKeyFromSecret,
} from './credential.js';

export {
  serializeCredential,
  deserializeCredential,
  type SerializedCredential,
  type SerializedCredentialPayload,
  type SerializedJubjubSignature,
} from './serialization.js';
