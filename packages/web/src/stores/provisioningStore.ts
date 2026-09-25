import { create } from 'zustand';
import {
  classifyInvocation,
  fetchLedgerContext,
  prepareProvingProvider,
  submitOnChainCall,
  type LedgerContext,
  type LedgerWalletKeys,
} from '@/lib/midnight/onchain';
import {
  buildProvisioningPlan,
  type ProvisionInvocations,
  type ProvisionPlan,
} from '@/lib/midnight/provision';
import type { PreprodSession, WalletProvingProvider } from '@/lib/midnight/wallet';

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

/** Elapsed wall-clock per setup phase. Kept PUBLIC so the UI can render it. */
export interface ProvisioningTimings {
  contextMs: number;
  classifyMs: number;
  schemasMs: number;
  totalMs: number;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Private invocation map (module scope). Never stored in reactive state. */
let invocations: ProvisionInvocations | null = null;

function buildSteps(plan: ProvisionPlan | null): ProvisionStepState[] {
  if (!plan) return [];
  return plan.schemas.map((schema) => ({
    id: `register-schema:${schema.name}`,
    label: 'Register credential schema',
    detail: `registerSchema · ${schema.name} · ${schema.schemaId.slice(0, 16)}…`,
    status: 'pending' as const,
    txHash: null as string | null,
    error: null as string | null,
  }));
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
  steps: ProvisionStepState[];
  running: boolean;
  error: string | null;
  timings: ProvisioningTimings | null;

  build: () => Promise<void>;
  run: (session: PreprodSession) => Promise<void>;
  reset: () => void;
}

export const useProvisioningStore = create<ProvisioningState>((set, get) => ({
  plan: null,
  planError: null,
  planBusy: false,
  steps: [],
  running: false,
  error: null,
  timings: null,

  build: async () => {
    const { planBusy } = get();
    if (planBusy) return;
    set({ planBusy: true, planError: null });
    try {
      const { plan, invocations: built } = await buildProvisioningPlan();
      invocations = built;
      set({
        plan,
        steps: buildSteps(plan),
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

  run: async (session) => {
    const { plan, steps, running } = get();
    if (running) return;
    if (!plan) {
      set({ error: 'The schema plan has not been built yet.' });
      return;
    }
    if (!invocations) {
      set({ error: 'The schema plan carries no invocations; rebuild it.' });
      return;
    }

    set({ running: true, error: null });

    // Walk the current step order; already-confirmed steps are skipped so a
    // partial failure can be resumed without double-spending the same call.
    const order = steps.map((step) => step.id);
    const runStarted = performance.now();
    const timings: ProvisioningTimings = {
      contextMs: 0,
      classifyMs: 0,
      schemasMs: 0,
      totalMs: 0,
    };

    try {
      // 1. ONE ledger context for the whole session (latest action + block
      //    ledger parameters + wallet keys), instead of refetching before every
      //    call. Each confirmed step feeds its own fresh action back in.
      const contextStarted = performance.now();
      let context: LedgerContext = await fetchLedgerContext(session);
      const walletKeys: LedgerWalletKeys = {
        coinPublicKey: context.coinPublicKey,
        walletEncryptionPublicKey: context.walletEncryptionPublicKey,
      };
      timings.contextMs = performance.now() - contextStarted;
      console.info(`schemas.context: ${formatSeconds(timings.contextMs)}`);

      // 2. Classify every pending step against the REAL current on-chain state
      //    by executing the circuit (no proof, no submit). A contract reject
      //    of "Schema already registered" is real on-chain evidence the step
      //    is done — mark it confirmed, never fake it. That makes re-runs
      //    resumable instead of dying at step 1.
      const classifyStarted = performance.now();
      const pendingIds = order.filter(
        (id) => get().steps.find((step) => step.id === id)?.status !== 'confirmed',
      );
      const classifications = await Promise.all(
        pendingIds.map(async (id): Promise<{ id: string; outcome: 'pending' | 'already-on-chain' }> => {
          const invocation = invocations![id as keyof ProvisionInvocations];
          if (!invocation) return { id, outcome: 'pending' };
          return { id, outcome: await classifyInvocation(invocation, context) };
        }),
      );
      let alreadyOnChain = 0;
      for (const { id, outcome } of classifications) {
        if (outcome !== 'already-on-chain') continue;
        alreadyOnChain += 1;
        const current = get().steps.find((step) => step.id === id);
        set({
          steps: mapSteps(get().steps, id, {
            status: 'confirmed',
            txHash: context.actionHash,
            detail: `${current?.detail ?? id} · already on-chain`,
          }),
        });
      }
      timings.classifyMs = performance.now() - classifyStarted;
      console.info(
        `schemas.classify: ${formatSeconds(timings.classifyMs)} (${
          alreadyOnChain > 0 ? `${alreadyOnChain} step(s) already on-chain ` : ''
        })`,
      );

      // 3. Submit the genuinely-pending steps in order. The wallet proving
      //    provider is bound ONCE for the session (it is stateless per proof
      //    request), and each step's confirmed action becomes the next step's
      //    context so nothing is refetched between calls.
      let provingProvider: WalletProvingProvider | null = null;
      for (const id of order) {
        const current = get().steps.find((step) => step.id === id);
        if (!current || current.status === 'confirmed') continue;
        const invocation = invocations[id as keyof ProvisionInvocations];
        if (!invocation) continue;

        const stepStarted = performance.now();
        set({ steps: mapSteps(get().steps, id, { status: 'running', error: null }) });
        let submitted;
        try {
          provingProvider ??= await prepareProvingProvider(session.api);
          submitted = await submitOnChainCall(session, invocation, { context, provingProvider });
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

        // Advance the session context from the JUST-confirmed action (state +
        // zswap + block) instead of a fresh latest-action fetch; ledger
        // parameters are still re-read for the confirmed block so a context
        // assembled across a block boundary stays valid.
        context = await fetchLedgerContext(session, { fromAction: submitted.action, walletKeys });

        const stepMs = performance.now() - stepStarted;
        if (id.startsWith('register-schema:')) timings.schemasMs += stepMs;
      }

      timings.totalMs = performance.now() - runStarted;
      console.info(`schemas.steps: ${formatSeconds(timings.schemasMs)}`);
      console.info(`schemas.total: ${formatSeconds(timings.totalMs)}`);
      set({ running: false, timings });
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
      steps: [],
      running: false,
      error: null,
      timings: null,
    });
  },
}));