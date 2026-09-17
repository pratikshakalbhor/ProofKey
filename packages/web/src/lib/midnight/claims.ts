/**
 * Browser-safe claim helpers.
 *
 * Duplicated here (rather than imported from `@verishield/shared/sdk`) so the
 * claim labels never drag the WASM runtime into the main bundle.
 */

import type { Claim, ClaimKind, CredentialType } from '@verishield/shared';

export const CLAIM_LABELS: Record<ClaimKind, string> = {
  HAS_CREDENTIAL: 'Holds a valid credential',
  FIELD_EQUALS: 'Degree field equals',
  RANGE_PROOF: 'CGPA is at least',
  AGE_OVER: 'Is at least this old',
  NOT_EXPIRED: 'Credential is not expired',
};

export const CLAIM_DESCRIPTIONS: Record<ClaimKind, string> = {
  HAS_CREDENTIAL: 'Proves a credential exists and was signed by the issuer.',
  FIELD_EQUALS: 'Proves the private degree field matches a value without revealing it.',
  RANGE_PROOF: 'Proves CGPA is above a threshold without revealing the exact score.',
  AGE_OVER: 'Proves the holder is at least N years old without revealing the date of birth.',
  NOT_EXPIRED: 'Proves the credential has not expired.',
};

const DEGREE_CLAIMS: Claim[] = [
  { kind: 'RANGE_PROOF', minCgpa: 7.5 },
  { kind: 'FIELD_EQUALS' },
  { kind: 'HAS_CREDENTIAL' },
  { kind: 'NOT_EXPIRED' },
];

const LICENSE_CLAIMS: Claim[] = [
  { kind: 'HAS_CREDENTIAL' },
  { kind: 'NOT_EXPIRED' },
];

const ID_CLAIMS: Claim[] = [
  { kind: 'AGE_OVER', minAge: 18 },
  { kind: 'HAS_CREDENTIAL' },
];

export function claimOptionsFor(type: CredentialType): Claim[] {
  const options = type === 'degree' ? DEGREE_CLAIMS : type === 'license' ? LICENSE_CLAIMS : ID_CLAIMS;
  return options.map((claim) => ({ ...claim }));
}

export function describeClaim(claim: Claim): string {
  switch (claim.kind) {
    case 'RANGE_PROOF':
      return `CGPA ≥ ${(claim.minCgpa ?? 0).toFixed(1)}`;
    case 'FIELD_EQUALS':
      return claim.expectedDegree
        ? `Degree equals "${claim.expectedDegree}"`
        : 'Degree field equals';
    case 'AGE_OVER':
      return `Age ≥ ${claim.minAge ?? 18}`;
    case 'NOT_EXPIRED':
      return 'Credential is not expired';
    case 'HAS_CREDENTIAL':
    default:
      return 'Holds a valid credential';
  }
}

/** Fills in the parameters a claim needs before it can run in-circuit. */
export function withClaimDefaults(claim: Claim, headline: string): Claim {
  if (claim.kind === 'FIELD_EQUALS' && claim.expectedDegree === undefined) {
    return { ...claim, expectedDegree: headline };
  }
  return claim;
}
