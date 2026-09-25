import { ExternalLink, RefreshCw, Unplug } from 'lucide-react';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { useWallet } from '@/components/wallet/WalletProvider';
import { cn } from '@/lib/utils';

const NETWORK_LABEL: Record<string, string> = {
  preprod: 'Midnight Preprod',
  mainnet: 'Midnight Mainnet',
  preview: 'Midnight Preview',
  undeployed: 'Undeployed',
};

/**
 * Compact, read-only wallet status chip shown ONCE in the shared PortalShell
 * header. It never runs its own connection flow — everything reads the single
 * `WalletProvider` state. When there is no live session it offers the one
 * explicit "Connect / Reconnect 1AM" action (a user gesture) and, on network
 * mismatch or a failed explicit attempt, a neutral recovery action.
 */
export function WalletStatus() {
  const {
    status,
    wallets,
    address,
    networkId,
    networkMismatch,
    error,
    connect,
    disconnect,
    openInstallPage,
  } = useWallet();

  const networkLabel = NETWORK_LABEL[networkId] ?? `Midnight ${networkId}`;

  if (status === 'connected') {
    return (
      <div
        className="glass flex items-center gap-2 rounded-full px-3 py-1.5"
        title={`1AM connected · ${networkLabel}`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              networkMismatch ? 'bg-amber-400' : 'bg-emerald-400',
            )}
          />
          <span
            className={cn(
              'relative inline-flex h-1.5 w-1.5 rounded-full',
              networkMismatch ? 'bg-amber-400' : 'bg-emerald-400',
            )}
          />
        </span>
        <span className="text-xs font-medium text-slate-200">
          {networkMismatch ? 'Wrong network' : '1AM Connected'}
        </span>
        {!networkMismatch && (
          <span className="hidden text-xs text-slate-500 lg:inline"> · {networkLabel}</span>
        )}
        {address && (
          <span className="hidden sm:block">
            <CopyableHash value={address} length="short" />
          </span>
        )}
        <button
          onClick={disconnect}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-rose-300"
          aria-label="Disconnect 1AM wallet"
          title="Disconnect 1AM wallet"
        >
          <Unplug className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  if (status === 'connecting' || status === 'reconnecting') {
    return (
      <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" aria-hidden />
        <span className="text-xs font-medium text-slate-300">
          {status === 'connecting' ? 'Waiting for 1AM…' : 'Reconnecting 1AM…'}
        </span>
      </div>
    );
  }

  if (status === 'initializing') {
    return (
      <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" />
        <span className="text-xs font-medium text-slate-400">Detecting wallet…</span>
      </div>
    );
  }

  // Neutral recovery states: `disconnected` (no wallet or not connected) and
  // `error` (an explicit connect attempt failed). Both allow exactly ONE
  // explicit reconnect action; neither is a misleading page-load error.
  const showInstall = wallets.length === 0;
  return (
    <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
      {status === 'error' ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-rose-500"
          title={error ?? 'Connection failed'}
        />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
      )}
      <button
        onClick={showInstall ? openInstallPage : connect}
        className={cn(
          'text-xs font-medium transition-colors',
          status === 'error' ? 'text-amber-300 hover:text-amber-100' : 'text-slate-300 hover:text-white',
        )}
        title={
          showInstall
            ? 'Install the 1AM wallet extension'
            : status === 'error'
              ? 'Retry the wallet connection'
              : 'Connect the 1AM wallet on Midnight Preprod'
        }
      >
        {showInstall ? (
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Get 1AM wallet
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <RefreshCw className="h-3 w-3" aria-hidden />
            {status === 'error' ? 'Reconnect 1AM' : 'Connect 1AM'}
          </span>
        )}
      </button>
    </div>
  );
}