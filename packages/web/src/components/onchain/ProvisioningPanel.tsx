import { useEffect } from 'react';
import { AlertTriangle, Database, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeStatus } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { Select } from '@/components/ui/Input';
import { useNetworkStore } from '@/stores/networkStore';
import { useProvisioningStore, type ProvisionStepStatus } from '@/stores/provisioningStore';
import { useMidnight } from '@/hooks/useMidnight';

/**
 * Real on-chain provisioning against the deployed Preprod contract.
 *
 * Runs the three ledger-writing circuits — `registerIssuer`, `registerSchema`
 * (one call per demo schema) and `anchorCredential` — sequentially through the
 * user's 1AM wallet. Nothing is submitted unless the wallet is connected on
 * Preprod and approves each prove/balance/submit; when the wallet prerequisite
 * is missing the flow simply stops and says so.
 *
 * Transaction hashes appear only when the indexer confirms a matching entry
 * point. Witness material never reaches this component or any store state.
 */
export function ProvisioningPanel() {
  const { network, snapshot, connect } = useNetworkStore();
  const { phase, session, networkMismatch } = useMidnight();
  const {
    plan,
    planError,
    planBusy,
    anchorCredentialId,
    steps,
    running,
    error,
    build,
    selectAnchor,
    run,
    reset,
  } = useProvisioningStore();

  useEffect(() => {
    void build();
  }, [build]);

  useEffect(() => {
    if (!snapshot && network.status !== 'connecting') {
      void connect();
    }
  }, [snapshot, network.status, connect]);

  const canRun =
    Boolean(session) && Boolean(plan) && !running && steps.some((step) => step.status !== 'confirmed');
  const confirmedCount = steps.filter((step) => step.status === 'confirmed').length;
  const allConfirmed = steps.length > 0 && confirmedCount === steps.length;

  const walletBadge = session ? (
    <Badge status="verified">Wallet ready</Badge>
  ) : networkMismatch ? (
    <Badge status="pending">Wrong network</Badge>
  ) : (
    <Badge status="neutral">
      {phase === 'connecting' ? 'Connecting…' : 'Wallet not connected'}
    </Badge>
  );

  const networkBadge =
    network.status === 'connected' ? (
      <Badge status="verified">Preprod indexed</Badge>
    ) : network.status === 'connecting' ? (
      <Badge status="pending" pulse>
        Probing…
      </Badge>
    ) : (
      <Badge status="neutral">Indexer unreachable</Badge>
    );

  return (
    <Card variant="glass" className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
            <Database className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">On-chain provisioning</p>
            <p className="text-xs text-slate-400">
              registerIssuer → registerSchema → anchorCredential · real Preprod contract
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {networkBadge}
          {walletBadge}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <FactRow label="Provisioning identity">
            {plan ? (
              <span className="min-w-0">
                <span className="block truncate text-slate-200">{plan.issuer.name}</span>
                <span className="mt-1 block">
                  <CopyableHash value={plan.issuer.issuerId} length="short" />
                </span>
              </span>
            ) : planBusy ? (
              <span className="text-slate-500">Building plan…</span>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </FactRow>
          <FactRow label="Target contract">
            <span className="min-w-0">
              <span className="block">
                <CopyableHash value={network.contractAddress ?? ''} length="short" />
              </span>
              <span className="mt-1 block text-slate-500">
                {network.label} · {network.name}
              </span>
            </span>
          </FactRow>
        </div>

        {planError && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">Could not build the provisioning plan: {planError}</span>
          </div>
        )}

        {!session && !networkMismatch && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-300">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">
              Connect the 1AM wallet on Preprod to provision the real contract. No transaction is
              submitted without your live wallet approval, and nothing is simulated in the meantime.
            </span>
          </div>
        )}

        {session && networkMismatch && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">Wallet is on another network; provisioning stays disabled until it matches Preprod.</span>
          </div>
        )}

        {plan && plan.credentials.length > 0 && (
          <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
            <Select
              label="Demo credential to anchor"
              value={anchorCredentialId ?? ''}
              onChange={(e) => selectAnchor(e.target.value)}
              disabled={running}
            >
              {plan.credentials.map((credential) => (
                <option key={credential.id} value={credential.id}>
                  {credential.holderName} · {credential.headline} ({credential.schemaName})
                </option>
              ))}
            </Select>
            <p className="mt-2 text-[11px] text-slate-500">
              Only the public commitment is anchored; payload, salt and DOB stay in the demo engine.
            </p>
          </div>
        )}

        {steps.length > 0 && (
          <ol className="space-y-2">
            {steps.map((step) => (
              <li key={step.id} className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="hash-block text-xs font-semibold text-cyan-300">{step.label}</span>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{step.detail}</p>
                  </div>
                  <Badge status={stepBadgeStatus(step.status)} pulse={step.status === 'running'}>
                    {stepStatusLabel(step.status)}
                  </Badge>
                </div>
                {step.txHash && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="uppercase tracking-wider">tx</span>
                    <CopyableHash value={step.txHash} length="short" />
                  </div>
                )}
                {step.error && (
                  <p className="mt-2 break-words text-[11px] text-rose-300">{step.error}</p>
                )}
              </li>
            ))}
          </ol>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">{error}</span>
          </div>
        )}

        {allConfirmed && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">
              All {steps.length} provisioning transactions were confirmed by the indexer on the
              deployed contract.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-[11px] text-slate-500">
            {session
              ? 'The wallet proves and balances each call; every hash below appears only after indexer confirmation.'
              : 'Stops at the wallet prerequisite — no transaction is broadcast without a live Preprod wallet.'}
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
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Rebuild plan
            </Button>
            <Button size="sm" onClick={() => void run(session!)} loading={running} disabled={!canRun}>
              Provision on-chain
              {confirmedCount > 0 ? ` (${confirmedCount}/${steps.length})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <div className="mt-1.5 text-xs text-slate-200">{children}</div>
    </div>
  );
}

function stepBadgeStatus(status: ProvisionStepStatus): BadgeStatus {
  switch (status) {
    case 'confirmed':
      return 'verified';
    case 'error':
      return 'revoked';
    case 'running':
      return 'pending';
    default:
      return 'neutral';
  }
}

function stepStatusLabel(status: ProvisionStepStatus): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'error':
      return 'Failed';
    case 'running':
      return 'Submitting…';
    default:
      return 'Pending';
  }
}