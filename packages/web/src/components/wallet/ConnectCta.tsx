import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';

/**
 * The ONE primary wallet action on the landing page.
 *
 * Deliberately the only control that calls the shared provider's `connect()`
 * on the landing screen; the passive `LandingWalletPanel` below it only
 * describes the session. States:
 *
 *  - disconnected + wallet installed -> "Connect 1AM Wallet" (connect once)
 *  - disconnected + no wallet        -> "Get 1AM wallet" (install, then reload)
 *  - connecting                      -> "Waiting for wallet approval…"
 *  - connected                       -> "Wallet Connected · Midnight Preprod" + Continue
 *  - error                           -> "Reconnect 1AM" (one explicit retry)
 *
 * Every state drives the same global `WalletProvider`; nothing here spawns a
 * competing connection flow.
 */
export function ConnectCta() {
  const { status, wallets, error, connect, openInstallPage } = useWallet();

  if (status === 'connected') {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-sm font-medium text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Wallet Connected · Midnight Preprod
        </div>
        <a
          href="#roles"
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 text-sm font-semibold text-white shadow-xl shadow-indigo-950/50 transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Choose your role
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
    );
  }

  if (status === 'connecting' || status === 'reconnecting' || status === 'initializing') {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-12 cursor-default items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 text-sm font-semibold text-slate-400"
      >
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
        {status === 'connecting'
          ? 'Waiting for wallet approval…'
          : status === 'initializing'
            ? 'Detecting 1AM wallet…'
            : 'Reconnecting 1AM…'}
      </button>
    );
  }

  const installFirst = wallets.length === 0;

  return (
    <div className="flex flex-col items-center gap-2.5">
      <button
        type="button"
        onClick={installFirst ? openInstallPage : connect}
        className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-sm font-semibold text-white shadow-xl shadow-indigo-950/50 transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        {installFirst ? (
          <ExternalLink className="h-4 w-4" aria-hidden />
        ) : (
          <Wallet className="h-4 w-4" aria-hidden />
        )}
        {status === 'error' ? 'Reconnect 1AM' : installFirst ? 'Get 1AM wallet' : 'Connect 1AM Wallet'}
      </button>
      {status === 'error' && error ? (
        <p className="flex items-center gap-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : installFirst ? (
        <p className="text-xs text-slate-500">
          Install the 1AM wallet extension, then reload — meanwhile explore how it works below.
        </p>
      ) : null}
    </div>
  );
}