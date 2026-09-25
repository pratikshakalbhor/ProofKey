import { create } from 'zustand';
import {
  PREPROD_ENDPOINTS,
  configuredContractAddress,
  configuredNetwork,
} from '@/lib/midnight/config';
import { inspectOnChain, type OnChainSnapshot } from '@/lib/midnight/onchain';

export type NetworkStatus = 'connected' | 'connecting' | 'disconnected';

export interface NetworkConfig {
  name: 'undeployed' | 'preview' | 'preprod' | 'mainnet';
  label: string;
  status: NetworkStatus;
  rpcUrl?: string;
  indexerUrl?: string;
  contractAddress?: string;
}

interface NetworkState {
  network: NetworkConfig;
  /** Real facts about the configured Preprod contract, straight from the indexer. */
  snapshot: OnChainSnapshot | null;
  /** Probe failure (real error from the indexer / config gate), never a fake reason. */
  error: string | null;
  setNetwork: (network: Partial<NetworkConfig>) => void;
  /** Real probe: reads the configured contract from the live Preprod indexer. */
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  network: {
    name: configuredNetwork(),
    label: 'Preprod',
    status: 'disconnected',
    rpcUrl: PREPROD_ENDPOINTS.nodeUrl,
    indexerUrl: PREPROD_ENDPOINTS.indexerUrl,
    contractAddress: configuredContractAddress(),
  },
  snapshot: null,
  error: null,
  setNetwork: (network) =>
    set((state) => ({ network: { ...state.network, ...network } })),
  connect: async () => {
    set((state) => ({
      network: { ...state.network, status: 'connecting' },
      error: null,
    }));
    try {
      const snapshot = await inspectOnChain();
      set((state) => ({
        network: {
          ...state.network,
          status: snapshot.found ? 'connected' : 'disconnected',
        },
        snapshot,
        error: snapshot.found
          ? null
          : 'The configured Preprod contract has no indexed actions yet.',
      }));
    } catch (error) {
      set((state) => ({
        network: { ...state.network, status: 'disconnected' },
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  },
  disconnect: () =>
    set((state) => ({
      network: { ...state.network, status: 'disconnected' },
      snapshot: null,
    })),
}));