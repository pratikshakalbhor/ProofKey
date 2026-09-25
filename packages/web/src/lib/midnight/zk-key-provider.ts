/**
 * ZK key-material providers for the on-chain flow.
 *
 * Two surfaces with identical inputs:
 *  - `ZKConfigProvider<string>` (midnight-js) drives `createUnprovenCallTx*`
 *    when assembling an unproven call transaction in the browser.
 *  - the DApp Connector `KeyMaterialProvider` shape is handed to the wallet's
 *    `getProvingProvider(...)` so the WALLET can prove with the same artifacts.
 *
 * Both read the real compiled artifacts from `@verishield/contracts`.
 */

import type { KeyMaterialProvider } from '@midnight-ntwrk/midnight-js-types';
import { ZKConfigProvider, createProverKey, createVerifierKey, createZKIR } from '@midnight-ntwrk/midnight-js-types';
import { fetchCircuitArtifact } from './artifacts';

/** All impure (provable) circuits in the compiled credential-registry contract. */
export type ProvableCircuitOfContract =
  | 'registerIssuer'
  | 'setIssuerActive'
  | 'registerSchema'
  | 'anchorCredential'
  | 'revokeCredential'
  | 'updateRevocationRoot'
  | 'updateIssuanceRoot'
  | 'proveHoldsCredential'
  | 'proveFieldEquals'
  | 'proveRange'
  | 'proveAgeOver'
  | 'proveNotExpired';

export const PROVABLE_CIRCUITS: readonly ProvableCircuitOfContract[] = [
  'registerIssuer',
  'setIssuerActive',
  'registerSchema',
  'anchorCredential',
  'revokeCredential',
  'updateRevocationRoot',
  'updateIssuanceRoot',
  'proveHoldsCredential',
  'proveFieldEquals',
  'proveRange',
  'proveAgeOver',
  'proveNotExpired',
];

export function isProvableCircuit(name: string): name is ProvableCircuitOfContract {
  return (PROVABLE_CIRCUITS as readonly string[]).includes(name);
}

/**
 * Reads the compiled artifacts from the browser. Must be used lazily (the
 * prover keys are several MB each and only needed at wallet-proving time).
 */
export class VeriShieldZKConfigProvider extends ZKConfigProvider<ProvableCircuitOfContract> {
  override async getZKIR(circuitId: ProvableCircuitOfContract) {
    return createZKIR(await fetchCircuitArtifact(circuitId, 'zkir'));
  }

  override async getProverKey(circuitId: ProvableCircuitOfContract) {
    return createProverKey(await fetchCircuitArtifact(circuitId, 'prover'));
  }

  override async getVerifierKey(circuitId: ProvableCircuitOfContract) {
    return createVerifierKey(await fetchCircuitArtifact(circuitId, 'verifier'));
  }
}

/** Singleton — the abstract `ZKConfigProvider` exposes `asKeyMaterialProvider()`. */
export const veriShieldZKConfigProvider = new VeriShieldZKConfigProvider();

/** The DApp Connector-compatible key material provider for `getProvingProvider`. */
export function walletKeyMaterialProvider(): KeyMaterialProvider {
  return veriShieldZKConfigProvider.asKeyMaterialProvider();
}