/**
 * Single instance of midnight-wallet connection logic — consumed by
 * `WalletProvider`, which owns it ONCE for the whole application.
 *
 * `connect()` must be called directly from a user gesture: wallets open an
 * authorization pop-up and browsers block it if the call is detached from the
 * click. This hook therefore invokes `initialApi.connect(networkId)`
 * synchronously (no preceding `await`) and handles the returned promise
 * afterwards.
 *
 * Status model:
 *  - `initializing`: wallet discovery is still running (page load only).
 *  - `disconnected`: no live session. After a refresh this is the NEUTRAL
 *    state — the DApp Connector `InitialAPI` offers no non-interactive
 *    "restore existing authorization" method, so nothing is reconnected and
 *    no approval popup is triggered on load. The user takes one explicit
 *    "Reconnect 1AM" action.
 *  - `connecting`: an explicit connection attempt is in flight.
 *  - `connected`: a live `PreprodSession` (or an account readout) exists.
 *  - `reconnecting`: reserved for future silent-restore attempts; the current
 *    connector surface never reaches this state.
 *  - `error`: only surfaced after an EXPLICIT user action (connect/disconnect/
 *    refresh) fails — never on page load.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildPreprodSession,
  discoverWallets,
  openInstallPage,
  selectWallet,
  targetNetworkId,
  toTokenBalances,
  type ConnectedWalletApi,
  type NamedWallet,
  type PreprodSession,
  type TokenBalance,
  type WalletInfo,
} from '@/lib/midnight/wallet';

export type WalletStatus =
  | 'initializing'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface UseMidnightResult {
  status: WalletStatus;
  wallets: WalletInfo[];
  wallet: WalletInfo | null;
  networkId: string;
  networkMismatch: boolean;
  /** Connected v4 session for on-chain flows; null until connected on the right network. */
  session: PreprodSession | null;
  address: string | null;
  shieldedAddress: string | null;
  shieldedCoinPublicKey: string | null;
  dustAddress: string | null;
  shieldedBalances: TokenBalance[];
  unshieldedBalances: TokenBalance[];
  dustBalance: bigint | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  refresh: () => Promise<void>;
  openInstallPage: () => void;
}

function isUserRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /reject|denied|declin|cancel/i.test(message);
}

export function useMidnight(): UseMidnightResult {
  const networkId = targetNetworkId();
  const apiRef = useRef<ConnectedWalletApi | null>(null);
  const namedWalletRef = useRef<NamedWallet | null>(null);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<WalletStatus>('initializing');
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const [session, setSession] = useState<PreprodSession | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [shieldedAddress, setShieldedAddress] = useState<string | null>(null);
  const [shieldedCoinPublicKey, setShieldedCoinPublicKey] = useState<string | null>(null);
  const [dustAddress, setDustAddress] = useState<string | null>(null);
  const [shieldedBalances, setShieldedBalances] = useState<TokenBalance[]>([]);
  const [unshieldedBalances, setUnshieldedBalances] = useState<TokenBalance[]>([]);
  const [dustBalance, setDustBalance] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(() => {
    const found = discoverWallets();
    if (!mountedRef.current) return;
    setWallets(found.map((w) => w.info));
    setStatus((current) => {
      // Only a live flow keeps its status; an idle (or freshly loaded) app
      // settles into the neutral `disconnected` state — never `error`.
      if (current === 'connected' || current === 'connecting' || current === 'error') return current;
      return 'disconnected';
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Single discovery pass lives at the provider level. Extensions often
    // inject after first paint, so re-scan on focus and shortly after load.
    // Every listener/timer here is torn down on unmount; no portal mounts may
    // register their own copies.
    scan();
    const timers = [200, 800, 2000].map((ms) => window.setTimeout(scan, ms));
    const onFocus = () => scan();
    window.addEventListener('focus', onFocus);
    return () => {
      mountedRef.current = false;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('focus', onFocus);
    };
  }, [scan]);

  const hydrate = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    try {
      const connection = await api.getConnectionStatus?.();
      // The wallet explicitly reports the live session is gone: fall back to
      // the neutral disconnected state so the UI never shows a stale
      // "connected" readout; the single Reconnect 1AM action restores it.
      if (connection?.status === 'disconnected') {
        apiRef.current = null;
        namedWalletRef.current = null;
        setStatus('disconnected');
        setSession(null);
        setAddress(null);
        setShieldedAddress(null);
        setShieldedCoinPublicKey(null);
        setDustAddress(null);
        setShieldedBalances([]);
        setUnshieldedBalances([]);
        setDustBalance(null);
        setNetworkMismatch(false);
        setError(null);
        return;
      }
      const unshielded = await api.getUnshieldedAddress?.();
      const shielded = await api.getShieldedAddresses?.();
      const dust = await api.getDustAddress?.();
      const shieldedTokenBalances = await api.getShieldedBalances?.();
      const unshieldedTokenBalances = await api.getUnshieldedBalances?.();
      const dustBal = await api.getDustBalance?.();
      if (!mountedRef.current) return;

      const reportedNetwork = connection?.networkId;
      setNetworkMismatch(Boolean(reportedNetwork && reportedNetwork !== networkId));
      setAddress(unshielded?.unshieldedAddress ?? null);
      setShieldedAddress(shielded?.shieldedAddress ?? null);
      setShieldedCoinPublicKey(shielded?.shieldedCoinPublicKey ?? null);
      setDustAddress(dust?.dustAddress ?? null);
      setShieldedBalances(toTokenBalances(shieldedTokenBalances));
      setUnshieldedBalances(toTokenBalances(unshieldedTokenBalances));
      setDustBalance(dustBal?.balance ?? null);
      setStatus('connected');
    } catch (hydrateError) {
      if (!mountedRef.current) return;
      setError(hydrateError instanceof Error ? hydrateError.message : String(hydrateError));
      setStatus('error');
    }
  }, [networkId]);

  const connect = useCallback(() => {
    const selected = selectWallet();
    if (!selected) {
      setStatus('disconnected');
      setWallet(null);
      setError('1AM wallet not detected. Install the extension, reload, then connect.');
      return;
    }

    // Call connect synchronously so the wallet pop-up stays within the user gesture.
    setWallet(selected.info);
    setStatus('connecting');
    setError(null);
    setNetworkMismatch(false);

    const namedWallet: NamedWallet = { info: selected.info, api: selected.api };
    namedWalletRef.current = namedWallet;

    let pending: Promise<ConnectedWalletApi>;
    try {
      pending = selected.api.connect(networkId);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : String(syncError));
      setStatus('error');
      return;
    }

    pending
      .then(async (api) => {
        apiRef.current = api;
        if (!mountedRef.current) return;
        await hydrate();
        // Wrap the connected API in a v4 session and confirm the network.
        const selectedWallet = namedWalletRef.current;
        if (!mountedRef.current || !selectedWallet) return;
        try {
          const built = await buildPreprodSession(selectedWallet, api, networkId);
          if (!mountedRef.current) return;
          setSession(built);
          setNetworkMismatch(false);
        } catch (sessionError) {
          // Connected, but on a different network: keep the account readout and
          // surface the mismatch; on-chain flows stay disabled until it matches.
          if (!mountedRef.current) return;
          setSession(null);
          setNetworkMismatch(true);
          if (sessionError instanceof Error && /network/i.test(sessionError.message)) {
            setError(sessionError.message);
          }
        }
      })
      .catch((connectError: unknown) => {
        if (!mountedRef.current) return;
        apiRef.current = null;
        setError(
          isUserRejection(connectError)
            ? 'Connection rejected in the wallet.'
            : connectError instanceof Error
              ? connectError.message
              : String(connectError),
        );
        setStatus('error');
      });
  }, [hydrate, networkId]);

  const disconnect = useCallback(() => {
    const api = apiRef.current;
    apiRef.current = null;
    namedWalletRef.current = null;
    if (api?.disconnect) {
      try {
        void api.disconnect();
      } catch {
        // Wallets are not required to implement disconnect; ignore failures.
      }
    }
    setStatus('disconnected');
    setSession(null);
    setAddress(null);
    setShieldedAddress(null);
    setShieldedCoinPublicKey(null);
    setDustAddress(null);
    setShieldedBalances([]);
    setUnshieldedBalances([]);
    setDustBalance(null);
    setNetworkMismatch(false);
    setError(null);
  }, []);

  const refresh = useCallback(() => hydrate(), [hydrate]);

  const handleOpenInstall = useCallback(() => openInstallPage(), []);

  return {
    status,
    wallets,
    wallet,
    networkId,
    networkMismatch,
    session,
    address,
    shieldedAddress,
    shieldedCoinPublicKey,
    dustAddress,
    shieldedBalances,
    unshieldedBalances,
    dustBalance,
    error,
    connect,
    disconnect,
    refresh,
    openInstallPage: handleOpenInstall,
  };
}