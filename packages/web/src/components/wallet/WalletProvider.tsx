/**
 * Application-level wallet/session OWNER.
 *
 * Renders `useMidnight()` exactly once and shares the single connection/session
 * state with every portal and panel through React context. Portals never call
 * `connect()` themselves and never register their own discovery listeners —
 * route changes therefore cannot spawn a second connection, a duplicate popup,
 * or duplicate `window` listeners.
 *
 * Execution order in `main.tsx`:
 *
 *   <BrowserRouter>
 *     <ToastProvider>
 *       <WalletProvider>      <- one wallet state for the whole app
 *         <AppRoutes/>        <- Landing / Issuer / Holder / Verifier
 *       </WalletProvider>
 *     </ToastProvider>
 *   </BrowserRouter>
 *
 * The full "Connect 1AM" control renders on the Home page; a compact status /
 * reconnect chip renders once inside the shared `PortalShell` header. Both
 * consume this same context — there is never a second wallet implementation.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useMidnight, type UseMidnightResult } from '@/hooks/useMidnight';

const WalletContext = createContext<UseMidnightResult | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useMidnight();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

/** Access to the single shared wallet/session state. Must be under <WalletProvider/>. */
export function useWallet(): UseMidnightResult {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a <WalletProvider>.');
  }
  return context;
}