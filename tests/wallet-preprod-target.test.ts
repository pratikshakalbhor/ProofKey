/**
 * Regression tests for the shared-wallet Preprod targeting.
 *
 * VeriShield must NEVER fall back to the local `undeployed`/devnet flow while
 * the production web build targets Midnight Preprod. These tests pin:
 *
 *  1. the network targeted for wallet sessions defaults to `preprod`
 *     (previously `useMidnight`/`targetNetworkId` defaulted to `undeployed`
 *     whenever `VITE_NETWORK` was not baked in — a real drift bug);
 *  2. the wallet-network id and the on-chain target now share ONE source of
 *     truth (`configuredNetwork` in `lib/midnight/config.ts`);
 *  3. the real deployed Preprod contract address is the only address that
 *     passes the fail-closed on-chain gate.
 */

import { describe, expect, it } from 'vitest';
import {
  DEPLOYED_CONTRACT_ADDRESS,
  assertValidContractTarget,
  checkContractTarget,
  configuredContractAddress,
  configuredNetwork,
} from '../packages/web/src/lib/midnight/config';
import { targetNetworkId } from '../packages/web/src/lib/midnight/wallet';

const HEX64 = /^[0-9a-f]{64}$/;

describe('shared wallet networking', () => {
  it('targets Midnight Preprod by default for wallet sessions', () => {
    expect(targetNetworkId()).toBe('preprod');
  });

  it('keeps the wallet network id aligned with the config source of truth', () => {
    expect(targetNetworkId()).toBe(configuredNetwork());
  });
});

describe('deployed Preprod contract gate', () => {
  it('pins the configured contract address to the real 64-char Preprod deploy', () => {
    expect(DEPLOYED_CONTRACT_ADDRESS).toMatch(HEX64);
    expect(configuredContractAddress()).toBe(DEPLOYED_CONTRACT_ADDRESS);
  });

  it('passes the real Preprod target through the fail-closed gate', () => {
    const check = checkContractTarget('preprod', DEPLOYED_CONTRACT_ADDRESS);
    expect(check.ok).toBe(true);
    expect(check.reasons).toEqual([]);
  });

  it('rejects the local undeployed network as a submission target', () => {
    const check = checkContractTarget('undeployed', DEPLOYED_CONTRACT_ADDRESS);
    expect(check.ok).toBe(false);
    expect(check.reasons.some((reason) => reason.includes("expected 'preprod'"))).toBe(true);
    expect(() => assertValidContractTarget('undeployed', DEPLOYED_CONTRACT_ADDRESS)).toThrow(
      /Refusing to run on-chain/,
    );
  });

  it('rejects a stale local/devnet contract address on Preprod', () => {
    const staleDevnet = 'b72da755'.padEnd(64, '0');
    const check = checkContractTarget('preprod', staleDevnet);
    expect(check.ok).toBe(false);
    expect(check.reasons.some((reason) => reason.includes('does not match'))).toBe(true);
    expect(() => assertValidContractTarget('preprod', staleDevnet)).toThrow(
      /Refusing to run on-chain/,
    );
  });

  it('rejects the real address on any other network', () => {
    expect(checkContractTarget('mainnet', DEPLOYED_CONTRACT_ADDRESS).ok).toBe(false);
  });
});