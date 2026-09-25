/**
 * VeriShield on-chain credential schemas — the shared schema registry.
 *
 * The deployed Preprod contract keeps ONE global schema registry; any issuer
 * can anchor credentials against these schemas once they are registered. This
 * module is the single source of truth for the three schema types the product
 * issues (Degree / License / Identity) and builds the `registerSchema` call
 * invocations that register them on the REAL deployed contract:
 *
 *   registerSchema(schemaId: Bytes<32>, schemaHash: Bytes<32>)
 *
 * Every identifier is derived with the same circuit hashes as the deployment
 * tool and the simulator (`hashLabel('schema:…')`,
 * `hashLabel('schema-hash:…')`) — verified byte-for-byte against the deployed
 * record in `managed/deploy/preprod.json`.
 *
 * This module carries NO issuer material: issuer identity and per-wallet
 * registration live in `issuerProfile.ts`. The plan returned here is PUBLIC
 * (names + identifiers) with no witnesses.
 */

import type { CredentialType } from '@verishield/shared';
import { loadVeriShieldSdk } from './sdk';
import type { CallInvocation } from './onchain';

/** The shared on-chain credential types, in display order. */
export const SHARED_SCHEMA_NAMES: readonly string[] = ['Degree', 'License', 'Identity'];

/** Maps a `CredentialType` to its shared on-chain schema name. */
export const SCHEMA_NAMES_BY_TYPE: Record<CredentialType, string> = {
  degree: 'Degree',
  license: 'License',
  id: 'Identity',
};

export interface ProvisionSchema {
  name: string;
  schemaId: string;
  schemaHash: string;
}

/** Public plan summary — safe to render; contains no witness material. */
export interface ProvisionPlan {
  schemas: ProvisionSchema[];
}

/** Private invocation map keyed by step id; kept out of reactive state. */
export type ProvisionInvocations = {
  [schemaStep: `register-schema:${string}`]: CallInvocation;
};

/**
 * Builds the schema-registration plan. Every schema id is derived with the SDK
 * hash so it matches the simulator and the on-chain contract.
 */
export async function buildProvisioningPlan(): Promise<{
  plan: ProvisionPlan;
  invocations: ProvisionInvocations;
}> {
  const sdk = await loadVeriShieldSdk();

  const schemas: ProvisionSchema[] = [];
  const invocations: ProvisionInvocations = {};
  for (const name of SHARED_SCHEMA_NAMES) {
    const schemaId = sdk.toHex(sdk.hashLabel(`schema:${name}`));
    const schemaHash = sdk.toHex(sdk.hashLabel(`schema-hash:${name}`));
    schemas.push({ name, schemaId, schemaHash });
    invocations[`register-schema:${name}`] = {
      circuitId: 'registerSchema',
      args: [sdk.fromHex(schemaId), sdk.fromHex(schemaHash)],
      values: {},
    };
  }

  return { plan: { schemas }, invocations };
}