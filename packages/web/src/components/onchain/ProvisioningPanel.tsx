import { useEffect } from 'react';
import {
  AlertTriangle,
  Circle,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Settings2,
  Database,
  FileBadge,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { useProvisioningStore, type ProvisionStepState, type ProvisionStepStatus } from '@/stores/provisioningStore';
import { useWallet } from '@/components/wallet/WalletProvider';

/**
 * The shared on-chain credential types, described for a non-blockchain reader:
 *
 *   "Credential types"
 *     ✓ Degree
 *     ✓ License
 *     ✓ Identity
 *   "✓ On-chain schemas ready"
 *
 * The milestones map to the real `registerSchema` circuits on the REAL deployed
 * Preprod contract, executed through the user's 1AM wallet. Transaction hashes
 * appear only after indexer confirmation. Blockchain implementation details
 * are collapsed under "Technical details", and the genuine error is also
 * written to the console — never hidden.
 */

interface Milestone {
  id: string;
  label: string;
  status: ProvisionStepStatus;
}

function milestonesOf(steps: ProvisionStepState[]): Milestone[] {
  return steps.map((step) => ({
    id: step.id,
    label: step.label.startsWith('Register credential schema')
      ? step.detail.split('·')[1]?.trim() ?? step.label
      : step.label,
    status: step.status,
  }));
}

export function ProvisioningPanel() {
  const { session, networkMismatch } = useWallet();
  const {
    plan,
    planError,
    planBusy,
    steps,
    running,
    error,
    build,
    run,
    reset,
    timings,
  } = useProvisioningStore();

  useEffect(() => {
    void build();
  }, [build]);

  // Keep the real technical failure in the console too; never mask it.
  useEffect(() => {
    if (error) console.error('[VeriShield schemas]', error);
  }, [error]);

  const milestones = milestonesOf(steps);
  const confirmedCount = steps.filter((s) => s.status === 'confirmed').length;
  const allConfirmed = steps.length > 0 && confirmedCount === steps.length;
  const anyError = error !== null || steps.some((s) => s.status === 'error');
  const canRun = Boolean(session) && Boolean(plan) && !running && steps.some((s) => s.status !== 'confirmed');

  return (
    <Card variant="glass" className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
            <FileBadge className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Credential types</p>
            <p className="text-xs text-slate-400">The shared on-chain schemas issuers anchor against.</p>
          </div>
        </div>
        {allConfirmed && <span className="text-sm font-semibold text-emerald-400">✓ On-chain schemas ready</span>}
      </div>

      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-300">
          These three credential types are registered on the contract&apos;s shared schema registry before any
          credential can reference them.
        </p>

        {!session && !networkMismatch && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-300">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
            <span className="min-w-0">
              Connect the 1AM wallet on Midnight Preprod to confirm the schemas. Nothing is submitted without your
              live wallet approval.
            </span>
          </div>
        )}

        {session && networkMismatch && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">Wallet is on another network; schema confirmation stays disabled until it matches Preprod.</span>
          </div>
        )}

        {planError ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">Could not prepare the schema plan: {planError}</span>
          </div>
        ) : null}

        {/* Overall outcome */}
        {allConfirmed ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm font-medium text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Every credential type is registered on-chain.
          </div>
        ) : anyError ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              We couldn&apos;t confirm the schemas. Please try again.
            </p>
            <p className="mt-1 text-[11px] text-amber-200/70">
              Already-confirmed steps are not re-submitted. See “Technical details” below for the real error.
            </p>
          </div>
        ) : running || steps.length > 0 ? (
          <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
            {running && (
              <p className="mb-3 flex items-center gap-2 text-sm text-slate-200">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-300" aria-hidden />
                Confirming credential types…
              </p>
            )}
            <ol className="space-y-2">
              {milestones.map((milestone) => (
                <MilestoneRow key={milestone.id} milestone={milestone} />
              ))}
            </ol>
          </div>
        ) : null}

        {/* Technical details (collapsed) — real errors + tx info */}
        {(steps.length > 0 || error) && (
          <details className="group rounded-xl border border-white/6 bg-white/[0.02] p-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-400">
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              Technical details
              <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-4">
              {error && (
                <div className="rounded-lg bg-rose-500/5 p-2 font-mono text-[11px] leading-relaxed text-rose-300">
                  {error}
                </div>
              )}
              {timings && (
                <div className="rounded-lg border border-white/5 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
                  <p className="mb-1 text-slate-500">Schema timings</p>
                  <p>schemas.steps: {(timings.schemasMs / 1000).toFixed(2)}s</p>
                  <p>schemas.classify: {(timings.classifyMs / 1000).toFixed(2)}s</p>
                  <p className="mt-1 text-slate-300">schemas.total: {(timings.totalMs / 1000).toFixed(2)}s</p>
                </div>
              )}
              <ol className="space-y-2">
                {steps.map((step) => (
                  <li key={step.id} className="rounded-lg border border-white/5 p-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-cyan-300">{step.label}</span>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{step.detail}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] uppercase text-slate-500">
                        {step.status}
                      </span>
                    </div>
                    {step.txHash && (
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="uppercase tracking-wider">tx</span>
                        <CopyableHash value={step.txHash} length="short" />
                      </div>
                    )}
                    {step.error && (
                      <p className="mt-1.5 break-words font-mono text-[10px] text-rose-300">{step.error}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </details>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-[11px] text-slate-500">
            {allConfirmed
              ? 'Every schema was confirmed by the Midnight indexer on the real deployed contract.'
              : 'The wallet proves and balances each schema call; nothing is broadcast without your approval.'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                reset();
                void build();
              }}
              loading={planBusy}
              disabled={running}
            >
              <Database className="h-3.5 w-3.5" aria-hidden />
              Rebuild plan
            </Button>
            <Button size="sm" onClick={() => void run(session!)} loading={running} disabled={!canRun}>
              {allConfirmed ? '✓ Registered' : 'Confirm schemas'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const { label, status } = milestone;
  return (
    <li className="flex items-center gap-3">
      <span className={cnMilestone(status)} aria-hidden>
        {status === 'confirmed' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : status === 'running' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status === 'error' ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </span>
      <span className="text-sm text-slate-300">{label}</span>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-slate-600">
        {status === 'confirmed' ? 'done' : status === 'running' ? 'in progress' : status}
      </span>
    </li>
  );
}

function cnMilestone(status: ProvisionStepStatus): string {
  switch (status) {
    case 'confirmed':
      return 'text-emerald-400';
    case 'running':
      return 'text-amber-300';
    case 'error':
      return 'text-rose-400';
    default:
      return 'text-slate-500';
  }
}