/**
 * Shared proof-artifact ledger + stateless verification.
 *
 * The holder publishes every proof artifact it produces here; the verifier
 * lists and re-verifies them (this is the SPA-wide hand-off for a proof).
 * The ledger holds PUBLIC artifacts only — never private witness material —
 * and verification is a pure structural check of the artifact's binding
 * digest, issuer and schema (see `@verishield/shared/sdk` `verifyProof`).
 *
 * No demo engine is required: artifact verification is stateless, and on-chain
 * proofs carry their own indexer-confirmed transaction evidence.
 */

import { create } from 'zustand';
import type { ClaimKind, ProofArtifact } from '@verishield/shared';
import type { VerifyProofResult } from '@verishield/shared/sdk';
import { loadVeriShieldSdk } from '@/lib/midnight/sdk';

interface SharedProofState {
  artifacts: ProofArtifact[];
  publishArtifact: (artifact: ProofArtifact) => void;
  clearArtifacts: () => void;
  verifyProof: (
    artifact: ProofArtifact,
    expected?: { claim?: ClaimKind; issuerId?: string; schemaId?: string },
  ) => Promise<VerifyProofResult>;
}

const artifactKey = (artifact: ProofArtifact): string =>
  `${artifact.verifiedAt}:${artifact.onChain?.txHash ?? artifact.binding}`;

export const useProofStore = create<SharedProofState>((set) => ({
  artifacts: [],

  publishArtifact: (artifact) =>
    set((state) => ({
      artifacts: [artifact, ...state.artifacts.filter((a) => artifactKey(a) !== artifactKey(artifact))],
    })),

  clearArtifacts: () => set({ artifacts: [] }),

  verifyProof: async (artifact, expected) => {
    const sdk = await loadVeriShieldSdk();
    return sdk.verifyProof(artifact, expected);
  },
}));

/** Convenience for stores/actions publishing a proof artifact. */
export function publishArtifact(artifact: ProofArtifact): void {
  useProofStore.getState().publishArtifact(artifact);
}