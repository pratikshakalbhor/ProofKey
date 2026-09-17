import { create } from 'zustand';

export interface NetworkConfig {
  name: 'undeployed' | 'preview' | 'preprod' | 'mainnet';
  label: string;
  status: 'connected' | 'connecting' | 'disconnected';
  rpcUrl?: string;
  indexerUrl?: string;
  proofServerUrl?: string;
}

interface NetworkState {
  network: NetworkConfig;
  setNetwork: (network: Partial<NetworkConfig>) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const localNetwork: NetworkConfig = {
  name: 'undeployed',
  label: 'Local Devnet',
  status: 'disconnected',
  rpcUrl: 'http://localhost:9944',
  indexerUrl: 'http://localhost:8088/api/v4/graphql',
  proofServerUrl: 'http://localhost:6300',
};

export const useNetworkStore = create<NetworkState>((set) => ({
  network: localNetwork,
  setNetwork: (network) =>
    set((state) => ({ network: { ...state.network, ...network } })),
  connect: async () => {
    set((state) => ({
      network: { ...state.network, status: 'connecting' },
    }));
    // Devnet connectivity is deferred: the local node/indexer are not started,
    // so this remains a placeholder indicator rather than a real RPC probe.
    await new Promise((resolve) => setTimeout(resolve, 800));
    set((state) => ({
      network: { ...state.network, status: 'connected' },
    }));
  },
  disconnect: () =>
    set((state) => ({
      network: { ...state.network, status: 'disconnected' },
    })),
}));