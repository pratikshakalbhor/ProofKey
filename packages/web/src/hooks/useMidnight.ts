/**
 * React binding for the Midnight 1AM wallet.
 *
 * `connect()` must be called directly from a user gesture: wallets open an
 * authorization pop-up and browsers block it if the call is detached from the
 * click. This hook therefore invokes `initialApi.connect(networkId)`
 * synchronously (no preceding `await`) and handles the returned promise
 * afterwards.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  discoverWallets,
  openInstallPage,
  selectWallet,
  targetNetworkId,
  toTokenBalances,
  type ConnectedWalletApi,
  type TokenBalance,
  type WalletInfo,
} from '@/lib/midnight/wallet';

export type WalletPhase = 'unavailable' | 'detected' | 'connecting' | 'connected' | 'error';

export interface UseMidnightResult {
  phase: WalletPhase;
  wallets: WalletInfo[];
  wallet: WalletInfo | null;
  networkId: string;
  networkMismatch: boolean;
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
  const mountedRef = useRef(true);

  const [phase, setPhase] = useState<WalletPhase>('detected');
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);
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
    setPhase((current) => {
      if (current === 'connected' || current === 'connecting' || current === 'error') return current;
      return found.length > 0 ? 'detected' : 'unavailable';
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    scan();
    // Extensions often inject after first paint; re-scan on focus and shortly after load.
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
      const status = await api.getConnectionStatus?.();
      const unshielded = await api.getUnshieldedAddress?.();
      const shielded = await api.getShieldedAddresses?.();
      const dust = await api.getDustAddress?.();
      const shieldedTokenBalances = await api.getShieldedBalances?.();
      const unshieldedTokenBalances = await api.getUnshieldedBalances?.();
      const dustBal = await api.getDustBalance?.();
      if (!mountedRef.current) return;

      const reportedNetwork = status?.networkId;
      setNetworkMismatch(Boolean(reportedNetwork && reportedNetwork !== networkId));
      setAddress(unshielded?.unshieldedAddress ?? null);
      setShieldedAddress(shielded?.shieldedAddress ?? null);
      setShieldedCoinPublicKey(shielded?.shieldedCoinPublicKey ?? null);
      setDustAddress(dust?.dustAddress ?? null);
      setShieldedBalances(toTokenBalances(shieldedTokenBalances));
      setUnshieldedBalances(toTokenBalances(unshieldedTokenBalances));
      setDustBalance(dustBal?.balance ?? null);
      setPhase('connected');
    } catch (hydrateError) {
      if (!mountedRef.current) return;
      setError(hydrateError instanceof Error ? hydrateError.message : String(hydrateError));
      setPhase('error');
    }
  }, [networkId]);

  const connect = useCallback(() => {
    const selected = selectWallet();
    if (!selected) {
      setPhase('unavailable');
      setWallet(null);
      setError('1AM wallet not detected. Install the extension to connect.');
      return;
    }

    // Call connect synchronously so the wallet pop-up stays within the user gesture.
    setWallet(selected.info);
    setPhase('connecting');
    setError(null);
    setNetworkMismatch(false);

    let pending: Promise<ConnectedWalletApi>;
    try {
      pending = selected.api.connect(networkId);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : String(syncError));
      setPhase('error');
      return;
    }

    pending
      .then((api) => {
        apiRef.current = api;
        if (!mountedRef.current) return;
        return hydrate();
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
        setPhase('error');
      });
  }, [hydrate, networkId]);

  const disconnect = useCallback(() => {
    const api = apiRef.current;
    apiRef.current = null;
    if (api?.disconnect) {
      try {
        void api.disconnect();
      } catch {
        // Wallets are not required to implement disconnect; ignore failures.
      }
    }
    setPhase(wallets.length > 0 ? 'detected' : 'unavailable');
    setAddress(null);
    setShieldedAddress(null);
    setShieldedCoinPublicKey(null);
    setDustAddress(null);
    setShieldedBalances([]);
    setUnshieldedBalances([]);
    setDustBalance(null);
    setNetworkMismatch(false);
    setError(null);
  }, [wallets.length]);

  const refresh = useCallback(() => hydrate(), [hydrate]);

  const handleOpenInstall = useCallback(() => openInstallPage(), []);

  return {
    phase,
    wallets,
    wallet,
    networkId,
    networkMismatch,
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
