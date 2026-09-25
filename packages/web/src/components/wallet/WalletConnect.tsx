import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Eye,
  RefreshCw,
  ShieldCheck,
  Unplug,
  Wallet,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { useWallet } from '@/components/wallet/WalletProvider';
import { tokenLabel, type TokenBalance } from '@/lib/midnight/wallet';

const WALLET_TITLES: Record<string, string> = {
  connected: '1AM wallet connected',
  connecting: 'Waiting for 1AM…',
  disconnected: 'Connect your 1AM wallet',
  initializing: 'Detecting wallet…',
  reconnecting: 'Reconnecting 1AM…',
  error: 'Wallet connection failed',
};

/**
 * The single full wallet-connection card. Rendered only on the Home page; the
 * shared PortalShell header shows the compact `WalletStatus` chip instead. Both
 * read the same `WalletProvider` state — no portal mounts its own copy.
 */
export function WalletConnect() {
  const wallet = useWallet();
  const { status } = wallet;
  const [dismissed, setDismissed] = useState<'connect-error' | 'network-mismatch' | null>(null);

  // Show the notice again whenever the wallet status or network state changes.
  useEffect(() => {
    setDismissed(null);
  }, [status, wallet.networkMismatch]);

  const networkSubtitle = wallet.wallet
    ? `${wallet.wallet.name}${wallet.wallet.apiVersion ? ` · API ${wallet.wallet.apiVersion}` : ''}`
    : `Midnight DApp Connector · target: ${wallet.networkId}`;

  return (
    <Card variant="glass" className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{WALLET_TITLES[status]}</p>
            <p className="text-xs text-slate-400">{networkSubtitle}</p>
          </div>
        </div>
        {status === 'connected' ? (
          <Badge status={wallet.networkMismatch ? 'pending' : 'verified'} pulse={!wallet.networkMismatch}>
            {wallet.networkMismatch ? 'Network mismatch' : 'Connected'}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        {status === 'disconnected' && wallet.wallets.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Install the 1AM wallet extension for Midnight, then reload this page. Your
              credentials and proofs never leave your browser.
            </p>
            <Button size="sm" onClick={wallet.openInstallPage}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Get 1AM wallet
            </Button>
          </div>
        )}

        {status === 'disconnected' && wallet.wallets.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              {wallet.wallets.length} wallet{wallet.wallets.length === 1 ? '' : 's'} detected.
              Connect once on Midnight Preprod — the session is then shared by the Issuer,
              Holder and Verifier portals.
            </p>
            <Button size="sm" onClick={wallet.connect}>
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Connect {wallet.wallets[0]?.name ?? 'wallet'}
            </Button>
          </div>
        )}

        {status === 'connecting' && (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin text-violet-300" aria-hidden />
            Approve the connection request in your wallet…
          </div>
        )}

        {status === 'initializing' && (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin text-violet-300" aria-hidden />
            Detecting Midnight wallets…
          </div>
        )}

        {status === 'error' && dismissed !== 'connect-error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p>{wallet.error}</p>
                <p className="mt-1 text-xs text-slate-400">
                  No transaction is broadcast without a live wallet approval on Midnight Preprod.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissed('connect-error')}
                className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Dismiss wallet warning"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <Button size="sm" variant="secondary" onClick={wallet.connect}>
              Reconnect 1AM
            </Button>
          </div>
        )}

        {status === 'connected' && (
          <div className="space-y-4">
            {wallet.networkMismatch && dismissed !== 'network-mismatch' && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  Wallet is connected to a different network than{' '}
                  <span className="hash-block">{wallet.networkId}</span>. Switch the network in
                  your wallet to Midnight Preprod to enable on-chain call submissions.
                </div>
                <button
                  type="button"
                  onClick={() => setDismissed('network-mismatch')}
                  className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Dismiss network warning"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <AddressField label="Unshielded address" value={wallet.address} />
              <AddressField label="Shielded address" value={wallet.shieldedAddress} />
              <AddressField label="DUST address" value={wallet.dustAddress} />
              <AddressField label="Shielded coin key" value={wallet.shieldedCoinPublicKey} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <BalanceGroup title="Shielded" balances={wallet.shieldedBalances} icon />
              <BalanceGroup title="Unshielded" balances={wallet.unshieldedBalances} icon />
              <BalanceGroup
                title="DUST"
                balances={
                  wallet.dustBalance === null
                    ? []
                    : [{ tokenType: 'dust', amount: wallet.dustBalance }]
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => void wallet.refresh()}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Refresh
              </Button>
              <Button size="sm" variant="ghost" className="text-rose-400" onClick={wallet.disconnect}>
                <Unplug className="h-3.5 w-3.5" aria-hidden />
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function AddressField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <div className="mt-1.5">
        {value ? (
          <CopyableHash value={value} length="short" />
        ) : (
          <span className="text-xs text-slate-600">not provided</span>
        )}
      </div>
    </div>
  );
}

function BalanceGroup({
  title,
  balances,
  icon,
}: {
  title: string;
  balances: TokenBalance[];
  icon?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {icon ? <Eye className="h-3 w-3" aria-hidden /> : null}
        {title}
      </p>
      {balances.length === 0 ? (
        <p className="mt-1.5 text-xs text-slate-600">—</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {balances.map((balance) => (
            <li key={balance.tokenType} className="flex items-center justify-between gap-2 text-xs">
              <span className="hash-block text-slate-400">{tokenLabel(balance.tokenType)}</span>
              <span className="font-mono text-slate-200">{balance.amount.toString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}