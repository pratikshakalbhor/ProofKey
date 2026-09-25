import { create } from 'zustand';
import { submitOnChainCall } from '@/lib/midnight/onchain';
import {
  buildProvisioningPlan,
  type ProvisionInvocations,
  type ProvisionPlan,
} from '@/lib/midnight/provision';
import type { PreprodSession } from '@/lib/midnight/wallet';

export type ProvisionStepStatus = 'pending' | 'running' | 'confirmed' | 'error';

export interface ProvisionStepState {
  id: string;
  label: string;
  detail: string;
  status: ProvisionStepStatus;
  /** Only ever an indexer-confirmed on-chain hash. Never fabricated. */
  txHash: string | null;
  error: string | null;
}

export type ProvisionStepId = string;

/** Private witness map (module scope). Never stored in reactive state. */
let invocations: ProvisionInvocations | null = null;

function defaultAnchorId(plan: ProvisionPlan | null): string | null {
  if (!plan) return null;
  const degree = plan.credentials.find((c) => c.credentialType === 'degree');
  return (degree ?? plan.credentials[0] ?? null)?.id ?? null;
}

function buildSteps(plan: ProvisionPlan | null, anchorId: string | null): ProvisionStepState[] {
  if (!plan || !anchorId) return [];
  const anchor = plan.credentials.find((c) => c.id === anchorId);
  const steps: ProvisionStepState[] = [
    {
      id: 'register-issuer',
      label: 'registerIssuer',
      detail: `${plan.issuer.name} · ${plan.issuer.issuerId.slice(0, 16)}…`,
      status: 'pending',
      txHash: null,
      error: null,
    },
    ...plan.schemas.map((schema) => ({
      id: `register-schema:${schema.name}`,
      label: 'registerSchema',
      detail: `${schema.name} · ${schema.schemaId.slice(0, 16)}…`,
      status: 'pending' as const,
      txHash: null as string | null,
      error: null as string | null,
    })),
    {
      id: `anchor-credential:${anchorId}`,
      label: 'anchorCredential',
      detail: anchor ? `${anchor.holderName} · ${anchor.headline} (${anchor.schemaName})` : anchorId,
      status: 'pending',
      txHash: null,
      error: null,
    },
  ];
  return steps;
}

function mapSteps(
  steps: ProvisionStepState[],
  id: ProvisionStepId,
  patch: Partial<ProvisionStepState>,
): ProvisionStepState[] {
  return steps.map((step) => (step.id === id ? { ...step, ...patch } : step));
}

interface ProvisioningState {
  plan: ProvisionPlan | null;
  planError: string | null;
  planBusy: boolean;
  anchorCredentialId: string | null;
  steps: ProvisionStepState[];
  running: boolean;
  error: string | null;

  build: () => Promise<void>;
  selectAnchor: (credentialId: string) => void;
  run: (session: PreprodSession) => Promise<void>;
  reset: () => void;
}

export const useProvisioningStore = create<ProvisioningState>((set, get) => ({
  plan: null,
  planError: null,
  planBusy: false,
  anchorCredentialId: null,
  steps: [],
  running: false,
  error: null,

  build: async () => {
    const { planBusy } = get();
    if (planBusy) return;
    set({ planBusy: true, planError: null });
    try {
      const { plan, invocations: built } = await buildProvisioningPlan();
      invocations = built;
      const anchorId = defaultAnchorId(plan);
      set({
        plan,
        anchorCredentialId: anchorId,
        steps: buildSteps(plan, anchorId),
        planBusy: false,
      });
    } catch (error) {
      invocations = null;
      set({
        planError: error instanceof Error ? error.message : String(error),
        planBusy: false,
      });
    }
  },

  selectAnchor: (credentialId) => {
    const { plan, steps } = get();
    if (!plan || !plan.credentials.some((c) => c.id === credentialId)) return;
    // Drop the existing anchor step, keep everything else intact.
    const kept = steps.filter((step) => !step.id.startsWith('anchor-credential:'));
    set({
      anchorCredentialId: credentialId,
      steps: [...kept, ...buildSteps(plan, credentialId).filter((s) => s.id.startsWith('anchor-credential:'))],
    });
  },

  run: async (session) => {
    const { plan, steps, running } = get();
    if (running) return;
    if (!plan) {
      set({ error: 'The provisioning plan has not been built yet.' });
      return;
    }
    if (!invocations) {
      set({ error: 'The provisioning plan carries no invocations; rebuild it.' });
      return;
    }

    set({ running: true, error: null });

    // Walk the current step order; already-confirmed steps are skipped so a
    // partial failure can be resumed without double-spending the same call.
    const order = steps.map((step) => step.id);

    try {
      for (const id of order) {
        const current = get().steps.find((step) => step.id === id);
        if (!current || current.status === 'confirmed') continue;
        const invocation = invocations[id as keyof ProvisionInvocations];
        if (!invocation) continue;

        set({ steps: mapSteps(get().steps, id, { status: 'running', error: null }) });
        let submitted;
        try {
          submitted = await submitOnChainCall(session, invocation);
        } catch (submitError) {
          const message = submitError instanceof Error ? submitError.message : String(submitError);
          set({
            steps: mapSteps(get().steps, id, { status: 'error', error: message }),
            error: `${current.label} failed: ${message}`,
            running: false,
          });
          return;
        }
        set({
          steps: mapSteps(get().steps, id, {
            status: 'confirmed',
            txHash: submitted.txHash,
          }),
        });
      }
      set({ running: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        running: false,
      });
    }
  },

  reset: () => {
    invocations = null;
    set({
      plan: null,
      planError: null,
      planBusy: false,
      anchorCredentialId: null,
      steps: [],
      running: false,
      error: null,
    });
  },
}));