import { useEffect } from 'react';
import { Activity, AlertTriangle, Database, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { useNetworkStore } from '@/stores/networkStore';
import { useWallet } from '@/components/wallet/WalletProvider';
import {
  DEPLOY_BLOCK,
  DEPLOYED_CONTRACT_ADDRESS,
  DEPLOY_TX_HASH,
} from '@/lib/midnight/config';

/**
 * Live view of the REAL deployed Preprod contract: deploy evidence plus the
 * latest indexed action, read straight from the public indexer. Nothing here is
 * fabricated; when the probe fails the card shows the real error.
 */
export function OnChainPanel() {
  const { network, snapshot, error, connect } = useNetworkStore();
  const { session, networkMismatch, status: walletStatus } = useWallet();

  useEffect(() => {
    if (!snapshot && network.status !== 'connecting') {
      void connect();
    }
  }, [snapshot, network.status, connect]);

  const status =
    network.status === 'connecting'
      ? 'pending'
      : network.status === 'connected'
        ? 'verified'
        : 'neutral';

  const statusLabel =
    network.status === 'connecting'
      ? 'Probing indexer…'
      : network.status === 'connected'
        ? 'Contract found on-chain'
        : 'Not reachable';

  return (
    <Card variant="glass" className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
            <Database className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Live on-chain contract</p>
            <p className="text-xs text-slate-400">
              Real Preprod deployment · public indexer reads only
            </p>
          </div>
        </div>
        <Badge status={status} pulse={network.status === 'connecting'}>
          {statusLabel}
        </Badge>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <FactRow label="Contract address">
            <CopyableHash value={network.contractAddress ?? DEPLOYED_CONTRACT_ADDRESS} length="short" />
          </FactRow>
          <FactRow label="Network">
            <span className="hash-block text-cyan-300">{network.name}</span>
          </FactRow>
          <FactRow label="Deploy transaction">
            <CopyableHash value={DEPLOY_TX_HASH} length="short" />
          </FactRow>
          <FactRow label="Deploy block">
            <span className="hash-block text-slate-300">#{DEPLOY_BLOCK.height.toLocaleString()}</span>
          </FactRow>
        </div>

        {snapshot && snapshot.found ? (
          <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <Activity className="h-3 w-3" aria-hidden />
              Latest indexed action
            </p>
            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">kind</span>
                <span className="hash-block text-slate-200">{snapshot.latestActionKind ?? '—'}</span>
              </div>
              {snapshot.latestEntryPoint && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">entry point</span>
                  <span className="hash-block text-cyan-300">{snapshot.latestEntryPoint}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">block height</span>
                <span className="hash-block text-slate-300">
                  {snapshot.latestBlockHeight === null ? '—' : `#${snapshot.latestBlockHeight.toLocaleString()}`}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-slate-500">
            {walletStatus === 'connected' && session ? (
              <span className="flex items-center gap-1.5 text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Wallet ready — real call submissions can be constructed for this contract.
              </span>
            ) : walletStatus === 'connected' && networkMismatch ? (
              <span className="flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Wallet is on another network; on-chain calls stay disabled until it matches Preprod.
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Connect the 1AM wallet on Preprod to enable real on-chain call submissions.
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void connect()}
            loading={network.status === 'connecting'}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Re-check
          </Button>
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