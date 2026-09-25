import { AlertTriangle, ArrowRight, ExternalLink, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { useWallet } from '@/components/wallet/WalletProvider';

const NETWORK_LABEL: Record<string, string> = {
  preprod: 'Midnight Preprod',
  mainnet: 'Midnight Mainnet',
  preview: 'Midnight Preview',
  undeployed: 'Undeployed',
};

/**
 * Passive session panel shown on the landing page. It only READS the shared
 * `WalletProvider` state — it never calls `connect()`. The single connection
 * action on the landing page is the hero `ConnectCta`.
 */
export function LandingWalletPanel() {
  const {
    status,
    wallets,
    wallet,
    address,
    networkId,
    networkMismatch,
    error,
    openInstallPage,
  } = useWallet();

  const networkLabel = NETWORK_LABEL[networkId] ?? `Midnight ${networkId}`;

  const badge =
    status === 'connected' ? (
      <Badge status={networkMismatch ? 'pending' : 'verified'} pulse={!networkMismatch}>
        {networkMismatch ? 'Wrong network' : 'Connected'}
      </Badge>
    ) : status === 'error' ? (
      <Badge status="revoked">Failed</Badge>
    ) : status === 'connecting' || status === 'reconnecting' ? (
      <Badge status="pending" pulse>
        Connecting
      </Badge>
    ) : status === 'initializing' ? (
      <Badge status="neutral" pulse>
        Detecting
      </Badge>
    ) : (
      <Badge status="neutral">Not connected</Badge>
    );

  return (
    <Card variant="glass" className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Your 1AM session</p>
            <p className="text-xs text-slate-400">
              Shared across Issuer, Holder and Verifier — connect once.
            </p>
          </div>
        </div>
        {badge}
      </div>

      <div className="space-y-4 p-5">
        {status === 'connected' && (
          <>
            {networkMismatch && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0">
                  Wallet is on another network. Switch it to Midnight Preprod to use the portals
                  with on-chain features.
                </span>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Network
                </p>
                <p className="hash-block mt-1.5 text-sm text-emerald-300">{networkLabel}</p>
              </div>
              <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Wallet
                </p>
                <div className="mt-1.5 text-xs text-slate-200">
                  {wallet?.name ?? '1AM'} · {address ? <CopyableHash value={address} length="short" /> : 'connected'}
                </div>
              </div>
            </div>

            <p className="flex items-start gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
              This session is shared by every portal — navigating never reconnects or opens a new
              wallet approval.
            </p>
            <a
              href="#roles"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white transition-all hover:from-indigo-500 hover:to-violet-500"
            >
              Choose your role
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </>
        )}

        {status === 'disconnected' && wallets.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Connect once on Midnight Preprod. Your session is shared across Issuer, Holder, and
              Verifier.
            </p>
            <ol className="space-y-2">
              <Step n={1}>Connect your 1AM wallet below</Step>
              <Step n={2}>Choose a role once connected</Step>
              <Step n={3}>Use the same session in every portal</Step>
            </ol>
            <p className="text-xs text-slate-500">
              Use the <span className="text-slate-300">Connect 1AM Wallet</span> button above to
              start.
            </p>
          </div>
        )}

        {status === 'disconnected' && wallets.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              No Midnight 1AM wallet detected. The real Preprod flow needs the extension — your
              credentials and proofs never leave your browser.
            </p>
            <Button size="sm" onClick={openInstallPage}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Get 1AM wallet
            </Button>
            <p className="text-xs text-slate-500">Reload this page after installing.</p>
          </div>
        )}

        {(status === 'connecting' || status === 'reconnecting') && (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin text-violet-300" aria-hidden />
            Approve the connection request in your 1AM wallet…
          </div>
        )}

        {status === 'initializing' && (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin text-violet-300" aria-hidden />
            Detecting Midnight wallets…
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">
              {error ?? 'Connection failed.'} Use the{' '}
              <span className="text-rose-200">Reconnect 1AM</span> button above to retry.
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-sm text-slate-300">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/6 text-xs font-semibold text-slate-300">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}