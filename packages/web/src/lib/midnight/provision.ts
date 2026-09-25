/**
 * VeriShield on-chain provisioning — real contract-level setup operations.
 *
 * This module resolves the ONE canonical demo identity ("Pune University",
 * owned by `demo.ts`) and builds the `registerIssuer` / `registerSchema` /
 * `anchorCredential` call invocations that provision the REAL deployed Preprod
 * contract:
 *
 *   registerIssuer(issuerId, name, registeredAt)   witness issuerSigningKey
 *   registerSchema(schemaId, schemaHash)           (no witnesses)
 *   anchorCredential(issuerId, commitment)         witness issuerSigningKey
 *
 * Every ID is derived with the same circuit hashes as the deployment tool and
 * the simulator (`hashLabel('issuer:…')`, `hashLabel('schema:…')`,
 * `hashLabel('schema-hash:…')`) — verified byte-for-byte against the deployed
 * record in `managed/deploy/preprod.json`.
 *
 * The plan returned to the UI is PUBLIC only (names + identifiers). Witness
 * material (the issuer signing scalar) lives in `ProvisionInvocations` and is
 * handed to the caller so it can be kept out of reactive store state.
 */

import { loadVeriShieldSdk } from './sdk';
import { getDemoEngine, DEMO_ISSUER_NAME, DEMO_SCHEMA_NAMES, demoIssuerSigningKey } from './demo';
import type { CallInvocation } from './onchain';
import type { CredentialType } from '@verishield/shared';

/** Public plan summary — safe to render; contains no witness material. */
export interface ProvisionPlan {
  issuer: {
    name: string;
    issuerId: string;
    verifyingKey: { x: string; y: string };
  };
  schemas: Array<{ name: string; schemaId: string; schemaHash: string }>;
  credentials: Array<{
    id: string;
    holderName: string;
    credentialType: CredentialType;
    headline: string;
    issuerId: string;
    schemaId: string;
    schemaName: string;
    commitment: string;
  }>;
}

/** Private invocation map keyed by step id; kept out of reactive state. */
export type ProvisionInvocations = {
  'register-issuer': CallInvocation;
  [schemaStep: `register-schema:${string}`]: CallInvocation;
  [anchorStep: `anchor-credential:${string}`]: CallInvocation;
};

/**
 * Builds the provisioning plan for the demo identity. Boots the demo engine
 * (issuing the three demo credentials) and derives every identifier with the
 * SDK hash so it matches the simulator and the on-chain contract.
 */
export async function buildProvisioningPlan(): Promise<{
  plan: ProvisionPlan;
  invocations: ProvisionInvocations;
}> {
  const engine = await getDemoEngine();
  const sdk = await loadVeriShieldSdk();
  const signingKey = await demoIssuerSigningKey();

  const issuerIdBytes = sdk.fromHex(engine.issuer.issuerId);
  const nameBytes = sdk.encodeField(DEMO_ISSUER_NAME);
  const registeredAt = BigInt(Math.floor(Date.now() / 1000));

  const invocations: ProvisionInvocations = {
    'register-issuer': {
      circuitId: 'registerIssuer',
      args: [issuerIdBytes, nameBytes, registeredAt],
      values: { issuerSigningKey: signingKey },
    },
  };

  const schemas = Object.values(DEMO_SCHEMA_NAMES).map((name) => {
    const schemaId = sdk.toHex(sdk.hashLabel(`schema:${name}`));
    const schemaHash = sdk.toHex(sdk.hashLabel(`schema-hash:${name}`));
    invocations[`register-schema:${name}`] = {
      circuitId: 'registerSchema',
      args: [sdk.fromHex(schemaId), sdk.fromHex(schemaHash)],
      values: {},
    };
    return { name, schemaId, schemaHash };
  });

  const credentials = engine.listCredentials().map((credential) => {
    const { disclosure } = credential;
    invocations[`anchor-credential:${disclosure.id}`] = {
      circuitId: 'anchorCredential',
      args: [issuerIdBytes, sdk.fromHex(disclosure.commitment)],
      values: { issuerSigningKey: signingKey },
    };
    return {
      id: disclosure.id,
      holderName: credential.holderName,
      credentialType: credential.credentialType,
      headline: credential.headline,
      issuerId: disclosure.issuerId,
      schemaId: disclosure.schemaId,
      schemaName: disclosure.schemaName,
      commitment: disclosure.commitment,
    };
  });

  return {
    plan: {
      issuer: {
        name: engine.issuer.name,
        issuerId: engine.issuer.issuerId,
        verifyingKey: engine.issuer.verifyingKey,
      },
      schemas,
      credentials,
    },
    invocations,
  };
}