/**
 * Midnight DApp Connector wallet discovery (1AM).
 *
 * Wallets inject an `InitialAPI` instance on `window.midnight`, keyed by a
 * CAIP-372 UUID. Per the DApp Connector spec a dApp must enumerate the
 * injected instances rather than rely on a fixed key. 1AM additionally
 * advertises a stable `window.midnight['1am']`, which we prefer when present.
 *
 * Reference: https://docs.midnight.network/api-reference/dapp-connector
 */

export const ONE_AM_INSTALL_URL =
  'https://chromewebstore.google.com/detail/bphnkdkcnfhompoegfpgnkidcjfbojjp';

export interface WalletConnectionStatus {
  status: 'connected' | 'disconnected';
  networkId?: string;
}

export interface ShieldedAddresses {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
}

export interface DustBalance {
  cap: bigint;
  balance: bigint;
}

export interface ConnectedWalletApi {
  getConnectionStatus?(): Promise<WalletConnectionStatus>;
  getShieldedAddresses?(): Promise<ShieldedAddresses>;
  getUnshieldedAddress?(): Promise<{ unshieldedAddress: string }>;
  getDustAddress?(): Promise<{ dustAddress: string }>;
  getShieldedBalances?(): Promise<Record<string, bigint>>;
  getUnshieldedBalances?(): Promise<Record<string, bigint>>;
  getDustBalance?(): Promise<DustBalance>;
  disconnect?(): Promise<void> | void;
}

export interface InitialWalletApi {
  rdns?: string;
  name?: string;
  icon?: string;
  apiVersion?: string;
  connect(networkId: string): Promise<ConnectedWalletApi>;
}

export interface WalletInfo {
  id: string;
  name: string;
  rdns?: string;
  icon?: string;
  apiVersion?: string;
}

export interface TokenBalance {
  tokenType: string;
  amount: bigint;
}

function isInitialApi(value: unknown): value is InitialWalletApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { connect?: unknown }).connect === 'function'
  );
}

function describeWallet(id: string, wallet: InitialWalletApi): WalletInfo {
  const isOneAm = id === '1am' || wallet.rdns?.toLowerCase().includes('1am') === true;
  return {
    id,
    name: wallet.name ?? (isOneAm ? '1AM' : id),
    rdns: wallet.rdns,
    icon: wallet.icon,
    apiVersion: wallet.apiVersion,
  };
}

/** Enumerates every injected Midnight wallet, de-duplicated by identity. */
export function discoverWallets(): Array<{ info: WalletInfo; api: InitialWalletApi }> {
  if (typeof window === 'undefined') return [];
  const injected = (window as { midnight?: Record<string, unknown> }).midnight;
  if (!injected) return [];

  const seen = new Map<string, { info: WalletInfo; api: InitialWalletApi }>();
  const add = (id: string, value: unknown) => {
    if (!isInitialApi(value)) return;
    const info = describeWallet(id, value);
    const key = info.rdns ?? info.name;
    if (!seen.has(key)) seen.set(key, { info, api: value });
  };

  // 1AM's stable key first, then the full CAIP-372 enumeration.
  add('1am', injected['1am']);
  for (const [id, value] of Object.entries(injected)) {
    if (id === '1am') continue;
    add(id, value);
  }

  return [...seen.values()];
}

/** Picks 1AM when available, otherwise the first injected wallet. */
export function selectWallet(): { info: WalletInfo; api: InitialWalletApi } | null {
  const wallets = discoverWallets();
  if (wallets.length === 0) return null;
  const oneAm = wallets.find(
    (w) => w.info.id === '1am' || w.info.name.toLowerCase().includes('1am'),
  );
  return oneAm ?? wallets[0];
}

/** Target network from Vite env; defaults to the local undeployed network. */
export function targetNetworkId(): string {
  const configured = import.meta.env?.VITE_NETWORK?.trim();
  return configured && configured.length > 0 ? configured : 'undeployed';
}

export function openInstallPage(): void {
  window.open(ONE_AM_INSTALL_URL, '_blank', 'noopener,noreferrer');
}

/** Normalizes a token-type -> bigint record into a stable array. */
export function toTokenBalances(record: Record<string, bigint> | undefined): TokenBalance[] {
  if (!record) return [];
  return Object.entries(record).map(([tokenType, amount]) => ({ tokenType, amount }));
}

/** Human label for common Midnight token types. */
export function tokenLabel(tokenType: string): string {
  const normalized = tokenType.toLowerCase();
  if (normalized === 'night' || normalized.includes('00000000')) return 'NIGHT';
  if (normalized === 'dust') return 'DUST';
  return tokenType.length > 14 ? `${tokenType.slice(0, 8)}…${tokenType.slice(-4)}` : tokenType;
}

export interface MidnightConfiguration {
  networkId: string;
  indexerUri?: string;
  indexerWsUri?: string;
  substrateNodeUri?: string;
}

/**
 * The DApp Connector v4 `ConnectedAPI` surface VeriShield depends on for the
 * on-chain flow: proving, shielding/unshielding and transaction submission.
 * Mirrors `@midnight-ntwrk/dapp-connector-api` (v4.0.1) so the web package can
 * stay decoupled from that dependency tree.
 */
export interface MidnightConnectedApi {
  getConnectionStatus?(): Promise<WalletConnectionStatus>;
  getShieldedAddresses?(): Promise<ShieldedAddresses>;
  getUnshieldedAddress?(): Promise<{ unshieldedAddress: string }>;
  getDustAddress?(): Promise<{ dustAddress: string }>;
  getShieldedBalances?(): Promise<Record<string, bigint>>;
  getUnshieldedBalances?(): Promise<Record<string, bigint>>;
  getDustBalance?(): Promise<DustBalance>;
  disconnect?(): Promise<void> | void;

  getConfiguration?(): Promise<MidnightConfiguration>;
  getProvingProvider?(keyMaterialProvider: {
    getZKIR: (keyLocation: string) => Promise<Uint8Array>;
    getProverKey: (keyLocation: string) => Promise<Uint8Array>;
    getVerifierKey: (keyLocation: string) => Promise<Uint8Array>;
  }): Promise<WalletProvingProvider>;
  balanceUnsealedTransaction?(unsealedTx: string): Promise<{ tx: string }>;
  submitTransaction?(transaction: string): Promise<void>;
  getTxHistory?(): Promise<WalletTxHistoryEntry[]>;
}

export interface WalletProvingProvider {
  check?(getName: string, unprovenTx: string): Promise<CheckCallError[]>;
  prove?(getName: string, unprovenTx: string): Promise<string>;
}

export interface CheckCallError {
  name: string;
  index: number;
  errors: string[];
}

export interface WalletTxHistoryEntry {
  transaction?: string;
  type?: string;
  [k: string]: unknown;
}

function assertInitialApiConnected(value: unknown): asserts value is ConnectedWalletApi {
  if (!isConnectedApi(value)) {
    throw new Error('Wallet connected instance is missing the DApp Connector API surface');
  }
}

function isConnectedApi(value: unknown): value is ConnectedWalletApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ConnectedWalletApi).getShieldedAddresses === 'function'
  );
}

function asMidnightConnectedApi(value: ConnectedWalletApi): MidnightConnectedApi {
  return value as MidnightConnectedApi;
}

export interface NamedWallet {
  info: WalletInfo;
  api: InitialWalletApi;
}

export interface PreprodSession {
  wallet: NamedWallet;
  api: MidnightConnectedApi;
  configuration: MidnightConfiguration;
}

/**
 * Builds a `PreprodSession` from an API the wallet already returned from
 * `connect(...)`. Validates the connected network against the requested id and
 * types the instance against the verified DApp Connector v4 surface; any method
 * a particular wallet build does not implement is a hard error at call time,
 * never a silent fallback.
 */
export async function buildPreprodSession(
  wallet: NamedWallet,
  connected: ConnectedWalletApi,
  networkId: string,
): Promise<PreprodSession> {
  assertInitialApiConnected(connected);
  const api = asMidnightConnectedApi(connected);

  let configuration: MidnightConfiguration | undefined;
  if (typeof api.getConfiguration === 'function') {
    try {
      configuration = await api.getConfiguration();
    } catch {
      configuration = undefined;
    }
  }
  if (configuration && configuration.networkId && configuration.networkId !== networkId) {
    throw new Error(
      `Wallet is connected to "${configuration.networkId}" but the app requires "${networkId}". ` +
        'Switch networks in the wallet and retry.',
    );
  }

  return { wallet, api, configuration: configuration ?? { networkId } };
}

/**
 * Connects to an injected wallet and wraps the result in a `PreprodSession`,
 * requiring the matched network.
 */
export async function connectToNetwork(
  wallet: NamedWallet,
  networkId: string,
): Promise<PreprodSession> {
  const connected = await wallet.api.connect(networkId);
  return buildPreprodSession(wallet, connected, networkId);
}
