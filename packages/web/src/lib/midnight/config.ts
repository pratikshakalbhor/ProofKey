/**
 * VeriShield web — network + deployed-contract configuration.
 *
 * Source of truth for the REAL Preprod deployment. The deployed contract address
 * is the one finalized on-chain on 2026-09-24 (see `managed/deploy/preprod.json`):
 *
 *   f9966bb9b48e0eba85a59909b0a3619e904a48888f5c19b6ab9501efa958747f
 *
 * On-chain deploy tx: a4fda59021c5b5afe4cebe9eba352cb67e151f87b9df60d3906e56be806fd98c
 * (block 2687934 / 993f43c6318d601bcaea90016d218633fe65975ed7860c6c182ef39d5befa62c).
 *
 * Every real on-chain path must go through `assertValidContractTarget()` so a
 * stale local/devnet address (b72da755…) can never be used on Preprod, and a
 * wrong network can never receive a real transaction.
 */

export type MidnightNetworkId = 'undeployed' | 'preview' | 'preprod' | 'mainnet';

export interface PreprodEndpoints {
  /** Midnight public Preprod indexer (GraphQL API v4). */
  indexerUrl: string;
  indexerWsUrl: string;
  /** Midnight public Preprod node (RPC). */
  nodeUrl: string;
}

/** The one and only live Preprod contract address (this branch's deployment). */
export const DEPLOYED_CONTRACT_ADDRESS =
  'f9966bb9b48e0eba85a59909b0a3619e904a48888f5c19b6ab9501efa958747f';

/** On-chain deploy transaction hash that produced the deployed contract. */
export const DEPLOY_TX_HASH =
  'a4fda59021c5b5afe4cebe9eba352cb67e151f87b9df60d3906e56be806fd98c';

/** Block in which the deploy was finalized. */
export const DEPLOY_BLOCK = Object.freeze({
  height: 2687934,
  hash: '993f43c6318d601bcaea90016d218633fe65975ed7860c6c182ef39d5befa62c',
  timestamp: 1790245278000,
});

export const PREPROD_ENDPOINTS: PreprodEndpoints = Object.freeze({
  indexerUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  nodeUrl: 'https://rpc.preprod.midnight.network',
});

const HEX64 = /^[0-9a-f]{64}$/i;

/** Reads a Vite env string (trimmed; empty -> undefined). */
function envString(key: string): string | undefined {
  const value = typeof import.meta?.env === 'object' ? (import.meta.env as Record<string, string | undefined>)[key] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/** The network the web app is configured for (defaults to Preprod). */
export function configuredNetwork(): MidnightNetworkId {
  const value = envString('VITE_NETWORK');
  if (!value) return 'preprod';
  if (value === 'undeployed' || value === 'preview' || value === 'preprod' || value === 'mainnet') {
    return value;
  }
  throw new Error(`VITE_NETWORK="${value}" is not a supported Midnight network id.`);
}

/** Contract address the app will target (defaults to the real Preprod deploy). */
export function configuredContractAddress(): string {
  const override = envString('VITE_CONTRACT_ADDRESS');
  if (override) {
    return override;
  }
  return DEPLOYED_CONTRACT_ADDRESS;
}

export function isHexContractAddress(value: string): boolean {
  return HEX64.test(value);
}

export function isValidNetworkId(value: string): value is MidnightNetworkId {
  return value === 'undeployed' || value === 'preview' || value === 'preprod' || value === 'mainnet';
}

export interface ContractTarget {
  networkId: MidnightNetworkId;
  contractAddress: string;
  endpoints: PreprodEndpoints;
}

export interface ContractTargetCheck {
  ok: boolean;
  networkId: string;
  contractAddress: string;
  expectedContractAddress: string;
  reasons: string[];
}

/** The real Preprod target (the only one the on-chain paths may act on). */
export function preprodTarget(): ContractTarget {
  return {
    networkId: 'preprod',
    contractAddress: configuredContractAddress(),
    endpoints: PREPROD_ENDPOINTS,
  };
}

/**
 * Fail-closed gate for every real submission path. Returns the failure list
 * (empty means the target is safe to act on):
 *  - the live contract address must be exactly the deployed Preprod address —
 *    a stale local/devnet address (b72da755…) must never be targeted;
 *  - the network must be preprod.
 */
export function checkContractTarget(networkId: string, contractAddress: string): ContractTargetCheck {
  const reasons: string[] = [];
  const expected = DEPLOYED_CONTRACT_ADDRESS;

  if (networkId !== 'preprod') {
    reasons.push(`network is '${networkId}', expected 'preprod'`);
  }
  if (!isHexContractAddress(contractAddress)) {
    reasons.push(`contract address is not 64-char hex: ${contractAddress.length} chars`);
  } else if (contractAddress.toLowerCase() !== expected) {
    reasons.push(
      `contract ${contractAddress.slice(0, 12)}… does not match the deployed Preprod address ${expected.slice(0, 12)}…`,
    );
  }

  return {
    ok: reasons.length === 0,
    networkId,
    contractAddress,
    expectedContractAddress: expected,
    reasons,
  };
}

/**
 * Throws unless the given network+address is exactly the deployed Preprod
 * contract. Never proceeds on mismatch — no real transaction may target
 * anything else.
 */
export function assertValidContractTarget(networkId: string, contractAddress: string): void {
  const check = checkContractTarget(networkId, contractAddress);
  if (!check.ok) {
    throw new Error(
      `Refusing to run on-chain: ${check.reasons.join('; ')}. ` +
        `The only approved target is the deployed Preprod contract ${expectedContractAddressShort(check.expectedContractAddress)}.`,
    );
  }
}

function expectedContractAddressShort(address: string): string {
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}