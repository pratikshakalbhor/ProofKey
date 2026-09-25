import { create } from 'zustand';
import type { Claim, ClaimKind, ProofArtifact } from '@verishield/shared';
import type { VerifyProofResult } from '@verishield/shared/sdk';
import { submitOnChainCall, type CallInvocation, type SubmittedCall } from '@/lib/midnight/onchain';
import type { PreprodSession } from '@/lib/midnight/wallet';
import {
  getDemoEngine,
  type DemoIssuerInfo,
  type HolderCredentialView,
  type NewCredentialInput,
  type PublicLedgerState,
} from '@/lib/midnight/demo';

type EngineStatus = 'idle' | 'booting' | 'ready' | 'error';

interface ProofState {
  status: EngineStatus;
  error: string | null;
  issuer: DemoIssuerInfo | null;
  credentials: HolderCredentialView[];
  /** Public proof artifacts only - never private witness material. */
  artifacts: ProofArtifact[];
  ledger: PublicLedgerState | null;

  /** Most recent indexer-confirmed on-chain submission via the wallet. */
  submission: SubmittedCall | null;
  submissionError: string | null;
  submissionBusy: boolean;

  boot: () => Promise<void>;
  issue: (input: NewCredentialInput) => Promise<HolderCredentialView>;
  revoke: (credentialId: string) => Promise<void>;
  generateProof: (credentialId: string, claim: Claim) => Promise<ProofArtifact>;
  verifyProof: (
    artifact: ProofArtifact,
    expected?: { claim?: ClaimKind; issuerId?: string; schemaId?: string },
  ) => Promise<VerifyProofResult>;
  clearArtifacts: () => void;
  /** Real wallet submission: prove + balance + broadcast + indexer-confirm. */
  submitOnChain: (session: PreprodSession, invocation: CallInvocation) => Promise<SubmittedCall>;
}

export const useProofStore = create<ProofState>((set, get) => ({
  status: 'idle',
  error: null,
  issuer: null,
  credentials: [],
  artifacts: [],
  ledger: null,

  submission: null,
  submissionError: null,
  submissionBusy: false,

  boot: async () => {
    const { status } = get();
    if (status === 'booting' || status === 'ready') return;
    set({ status: 'booting', error: null });
    try {
      const engine = await getDemoEngine();
      set({
        status: 'ready',
        issuer: engine.issuer,
        credentials: engine.listCredentials(),
        ledger: engine.ledger(),
      });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  issue: async (input) => {
    const engine = await getDemoEngine();
    const created = await engine.issue(input);
    set({ credentials: engine.listCredentials(), ledger: engine.ledger() });
    return created;
  },

  revoke: async (credentialId) => {
    const engine = await getDemoEngine();
    await engine.revoke(credentialId);
    set({ credentials: engine.listCredentials(), ledger: engine.ledger() });
  },

  generateProof: async (credentialId, claim) => {
    const engine = await getDemoEngine();
    const artifact = await engine.generateProof(credentialId, claim);
    set((state) => ({
      artifacts: [artifact, ...state.artifacts],
      ledger: engine.ledger(),
    }));
    return artifact;
  },

  verifyProof: async (artifact, expected) => {
    const engine = await getDemoEngine();
    return engine.verifyProof(artifact, expected);
  },

  clearArtifacts: () => set({ artifacts: [] }),
  submitOnChain: async (session, invocation) => {
    set({ submissionBusy: true, submissionError: null });
    try {
      const submitted = await submitOnChainCall(session, invocation);
      set({ submission: submitted, submissionBusy: false });
      return submitted;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ submissionError: message, submissionBusy: false });
      throw error;
    }
  },
}));
