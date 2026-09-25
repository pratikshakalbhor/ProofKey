/**
 * In-browser VeriShield engine (demo mode).
 *
 * This module is the ONLY place in the web app that owns private credential
 * material. `BuiltCredential` values - payload, salt and issuer signature -
 * live in the module-scoped `registry` map and are never placed in React
 * state, never logged, and never sent to the issuer API.
 *
 * It drives the real compiled `credential-registry` contract through the
 * Midnight circuit simulator bundled in `@verishield/shared/sdk`. Proofs are
 * real circuit transcripts (`engine: 'circuit-simulator'`), not ZK-SNARKs -
 * a proof server is required for the latter (Phase 3 remainder).
 *
 * The runtime ledger is per-page and in-memory, so the browser session is
 * self-contained: the same instance issues, anchors, proves and verifies.
 */

import type {
  Claim,
  ClaimKind,
  CredentialDisclosure,
  CredentialType,
  ProofArtifact,
} from '@verishield/shared';
import type { VeriShield, VerifyProofResult } from '@verishield/shared/sdk';
import { loadVeriShieldSdk } from './sdk';

/**
 * Fixed demo issuer. The secret is intentionally public: this is a local
 * simulator demo, never a production key. 32 bytes (64 hex chars).
 *
 * `DEMO_ISSUER_NAME` is the ONE canonical demo identity used across the web
 * app, the simulator ledger, and (when provisioned) the real on-chain ledger.
 * The deploy tool's record ("University of Midnight") is a separate historical
 * deployment default, not the interactive demo.
 */
export const DEMO_ISSUER_NAME = 'Pune University';
const DEMO_ISSUER_SECRET = '9f2c4a1d7b3e5086ac91d42f6b8e07c5d3a41f928b6c0e7d5a3f1902c8b4e6a1';

export const DEMO_SCHEMA_NAMES: Record<CredentialType, string> = {
  degree: 'Degree',
  license: 'License',
  id: 'Identity',
};

const SCHEMA_NAMES = DEMO_SCHEMA_NAMES;

const SUGGESTED_CLAIM: Record<CredentialType, Claim> = {
  degree: { kind: 'RANGE_PROOF', minCgpa: 7.5 },
  license: { kind: 'HAS_CREDENTIAL' },
  id: { kind: 'AGE_OVER', minAge: 18 },
};

export interface NewCredentialInput {
  holderName: string;
  credentialType: CredentialType;
  degree: string;
  cgpa: number;
  dateOfBirth: string;
  licenseNumber?: string;
}

export interface HolderCredentialView {
  disclosure: CredentialDisclosure;
  holderName: string;
  credentialType: CredentialType;
  headline: string;
  grade: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  suggestedClaim: Claim;
}

export interface PublicLedgerState {
  issuerCount: number;
  verificationCount: number;
  lastProofValid: boolean;
  revocationRoot: string;
  issuanceRoot: string;
  contractAddress: string;
}

export interface DemoIssuerInfo {
  name: string;
  issuerId: string;
  verifyingKey: { x: string; y: string };
}

interface PrivateEntry {
  built: import('@verishield/shared').BuiltCredential;
  view: HolderCredentialView;
}

export interface DemoEngine {
  readonly issuer: DemoIssuerInfo;
  listCredentials(): HolderCredentialView[];
  issue(input: NewCredentialInput): Promise<HolderCredentialView>;
  revoke(credentialId: string): Promise<void>;
  generateProof(credentialId: string, claim: Claim): Promise<ProofArtifact>;
  verifyProof(
    artifact: ProofArtifact,
    expected?: { claim?: ClaimKind; issuerId?: string; schemaId?: string },
  ): VerifyProofResult;
  ledger(): PublicLedgerState;
}

/**
 * The demo issuer's signing scalar (derived from the module-private secret).
 * Used only transiently as the `issuerSigningKey` witness when building
 * registerIssuer / anchorCredential call invocations for the real contract.
 * The secret itself never leaves this module.
 */
export async function demoIssuerSigningKey(): Promise<bigint> {
  const sdk = await loadVeriShieldSdk();
  return sdk.signingKeyFromSecret(sdk.fromHex(DEMO_ISSUER_SECRET));
}

function createEngine(vs: VeriShield, issuer: DemoIssuerInfo): DemoEngine {
  /** Private material. Module-scoped, never exposed. */
  const registry = new Map<string, PrivateEntry>();

  function toView(entry: PrivateEntry): HolderCredentialView {
    return { ...entry.view, revoked: entry.view.revoked };
  }

  async function issue(input: NewCredentialInput): Promise<HolderCredentialView> {
    const schemaName = SCHEMA_NAMES[input.credentialType];
    const built = await vs.issueCredential(
      {
        issuerName: DEMO_ISSUER_NAME,
        schemaName,
        subject: {
          name: input.holderName,
          degree: input.degree,
          dateOfBirth: input.dateOfBirth,
          cgpa: input.cgpa,
        },
      },
      DEMO_ISSUER_SECRET,
    );

    const headline =
      input.credentialType === 'license'
        ? (input.licenseNumber ?? 'Professional license')
        : input.credentialType === 'id'
          ? 'Government-issued identity'
          : input.degree;

    const view: HolderCredentialView = {
      disclosure: built.disclosure,
      holderName: input.holderName,
      credentialType: input.credentialType,
      headline,
      grade: `${input.cgpa.toFixed(2)} CGPA`,
      issuedAt: built.disclosure.issuedAt,
      expiresAt: built.disclosure.expiresAt,
      revoked: false,
      suggestedClaim: SUGGESTED_CLAIM[input.credentialType],
    };

    registry.set(built.disclosure.id, { built, view });
    return toView(registry.get(built.disclosure.id)!);
  }

  async function revoke(credentialId: string): Promise<void> {
    const entry = registry.get(credentialId);
    if (!entry) throw new Error(`Unknown credential: ${credentialId}`);
    await vs.revokeCredential(entry.built, DEMO_ISSUER_SECRET);
    entry.view = { ...entry.view, revoked: true };
  }

  async function generateProof(credentialId: string, claim: Claim): Promise<ProofArtifact> {
    const entry = registry.get(credentialId);
    if (!entry) throw new Error(`Unknown credential: ${credentialId}`);
    return vs.generateProof(entry.built, claim);
  }

  return {
    issuer,
    listCredentials: () => [...registry.values()].map(toView),
    issue,
    revoke,
    generateProof,
    verifyProof: (artifact, expected) => vs.verifyProof(artifact, expected),
    ledger: () => ({ ...vs.publicLedger(), contractAddress: vs.contractAddress }),
  };
}

async function bootstrap(): Promise<DemoEngine> {
  const sdk = await loadVeriShieldSdk();
  const configured = import.meta.env?.VITE_CONTRACT_ADDRESS?.trim();
  const vs = await sdk.createVeriShield(
    configured && configured.length > 0 ? { contractAddress: configured } : {},
  );

  const { issuerId, verifyingKey } = await vs.registerIssuer({
    issuerName: DEMO_ISSUER_NAME,
    secretKey: DEMO_ISSUER_SECRET,
  });

  for (const schemaName of Object.values(SCHEMA_NAMES)) {
    await vs.registerSchema({ schemaName, secretKey: DEMO_ISSUER_SECRET });
  }

  const engine = createEngine(vs, {
    name: DEMO_ISSUER_NAME,
    issuerId,
    verifyingKey,
  });

  await engine.issue({
    holderName: 'Priya Sharma',
    credentialType: 'degree',
    degree: 'Bachelor in Computer Science',
    cgpa: 8.42,
    dateOfBirth: '2003-04-12',
  });
  await engine.issue({
    holderName: 'Priya Sharma',
    credentialType: 'license',
    degree: 'Professional License',
    cgpa: 7.5,
    dateOfBirth: '1998-07-22',
    licenseNumber: 'LIC-2024-045281',
  });
  await engine.issue({
    holderName: 'Priya Sharma',
    credentialType: 'id',
    degree: 'Identity Document',
    cgpa: 7.0,
    dateOfBirth: '1996-01-30',
  });

  return engine;
}

let enginePromise: Promise<DemoEngine> | null = null;

/** Returns the singleton demo engine, booting it on first call. */
export function getDemoEngine(): Promise<DemoEngine> {
  enginePromise ??= bootstrap().catch((error) => {
    enginePromise = null;
    throw error;
  });
  return enginePromise;
}
