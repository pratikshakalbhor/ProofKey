import { describe, it, expect } from 'vitest';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { ContractState as OnChainContractState } from '@midnight-ntwrk/onchain-runtime-v3';
import { LedgerParameters, ZswapChainState } from '@midnight-ntwrk/ledger-v8';
import { ShieldedEncryptionPublicKey } from '@midnight-ntwrk/wallet-sdk-address-format';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenCallTxFromInitialStates } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from '@verishield/contracts';
import { signingKeyFromSecret, fromHex, encodeField, hashLabel, toHex } from '@verishield/shared/sdk';
import { isAlreadyProvisionedError, readableReason } from '../packages/web/src/lib/midnight/alreadyOnChain';

const ADDRESS = 'f9966bb9b48e0eba85a59909b0a3619e904a48888f5c19b6ab9501efa958747f';
const ENDPOINT = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const KEY_HEX = '9f2c4a1d7b3e5086ac91d42f6b8e07c5d3a41f928b6c0e7d5a3f1902c8b4e6a1';
const ISSUER_NAME = 'Pune University';
const SCHEMA_NAMES = {
  degree: 'Degree',
  license: 'License',
  identity: 'Identity',
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function probeState() {
  setNetworkId('preprod');
  const latest = await (async () => {
    const q =
      'query($a: HexEncoded!){contractAction(address:$a){__typename state zswapState transaction{id hash block{height}}}}';
    const j = await (
      await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q, variables: { a: ADDRESS } }) })
    ).json();
    return j.data.contractAction;
  })();
  const block = await (async () => {
    const q = 'query($o: BlockOffset!){block(offset:$o){height ledgerParameters}}';
    const j = await (
      await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q, variables: { o: { height: latest.transaction.block.height } } }) })
    ).json();
    return j.data.block;
  })();

  const contractState = OnChainContractState.deserialize(hexToBytes(latest.state));
  const zswapChainState = latest.zswapState ? ZswapChainState.deserialize(hexToBytes(latest.zswapState)) : new ZswapChainState();
  const ledgerParameters = LedgerParameters.deserialize(hexToBytes(block.ledgerParameters));
  const epkBech = ShieldedEncryptionPublicKey.codec.encode('preprod', new ShieldedEncryptionPublicKey(hexToBytes(KEY_HEX))).toString();
  const issuerSigningKey = await signingKeyFromSecret(fromHex(KEY_HEX));

  const EMPTY = {};
  let cc = CompiledContract.make('verishield-credential-registry', Contract);
  cc = CompiledContract.withWitnesses(cc, {
    issuerSigningKey: () => [EMPTY, issuerSigningKey],
    credentialPayload: () => { throw new Error('unused'); },
    credentialSalt: () => { throw new Error('unused'); },
  });

  const probe = async (circuitId: 'registerIssuer' | 'registerSchema' | 'anchorCredential', args: unknown[]) => {
    try {
      await createUnprovenCallTxFromInitialStates(
        { getVerifierKey: async () => { throw new Error('unused'); }, getVerifierKeys: async () => { throw new Error('unused'); } } as never,
        {
          compiledContract: cc,
          contractAddress: ADDRESS,
          circuitId,
          args: args as never,
          coinPublicKey: KEY_HEX,
          initialContractState: contractState,
          initialZswapChainState: zswapChainState,
          ledgerParameters,
          initialPrivateState: EMPTY,
        } as never,
        epkBech as never,
      );
      return { kind: 'ok' as const, error: null };
    } catch (e) {
      return { kind: isAlreadyProvisionedError(e) ? ('already-on-chain' as const) : ('errored' as const), error: e };
    }
  };

  const issuerId = fromHex(toHex(hashLabel(`issuer:${ISSUER_NAME}`)));
  const issuerProbe = await probe('registerIssuer', [issuerId, encodeField(ISSUER_NAME), BigInt(Math.floor(Date.now() / 1000))]);
   
  console.log('registerIssuer probe:', readableReason(issuerProbe.error));

  let registered = 0;
  let notRegistered = 0;
  for (const name of Object.values(SCHEMA_NAMES)) {
    const schemaId = toHex(hashLabel(`schema:${name}`));
    const schemaHash = toHex(hashLabel(`schema-hash:${name}`));
    const r = await probe('registerSchema', [fromHex(schemaId), fromHex(schemaHash)]);
     
    console.log(`registerSchema(${name}) probe:`, readableReason(r.error));
    if (r.kind === 'already-on-chain') registered += 1;
    else if (r.kind === 'ok') notRegistered += 1;
  }

  const commitment = 'ef8e0faf7c1f51bc88e277d5d4d815a1bd1fe8495de40b4781714042e4a178cd';
  const anchorProbe = await probe('anchorCredential', [issuerId, fromHex(commitment)]);
   
  console.log('anchorCredential probe:', readableReason(anchorProbe.error));

  return {
    issuerPresent: issuerProbe.kind === 'already-on-chain',
    registeredSchemas: registered,
    unregisteredSchemas: notRegistered,
    anchorProbe,
  };
}

describe.skipIf(process.env.RUN_LIVE_PREPROD !== '1')('on-chain provisioning state probe (RUN_LIVE_PREPROD=1)', () => {
  it('reports which setup steps already exist on-chain', async () => {
    const r = await probeState();
     
    console.log('summary:', JSON.stringify({ issuerPresent: r.issuerPresent, registeredSchemas: r.registeredSchemas, unregisteredSchemas: r.unregisteredSchemas, anchorError: r.anchorProbe.error }));
    // Pins the CURRENT real Preprod state. Update these when a step advances
    // on-chain: the whole point is that they describe what really exists.
    expect(r.issuerPresent).toBe(true);
    expect(r.registeredSchemas).toBe(3);
    expect(r.unregisteredSchemas).toBe(0);
    expect(r.anchorProbe.error).toBeNull();
  }, 120_000);
});

// Re-export to keep tree-shaking happy about unused import.
export { probeState };