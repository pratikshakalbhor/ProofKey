import { describe, it, expect } from 'vitest';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { ContractState as OnChainContractState } from '@midnight-ntwrk/onchain-runtime-v3';
import { LedgerParameters, ZswapChainState } from '@midnight-ntwrk/ledger-v8';
import { ShieldedEncryptionPublicKey } from '@midnight-ntwrk/wallet-sdk-address-format';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenCallTxFromInitialStates } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from '@verishield/contracts';
import { signingKeyFromSecret, fromHex, encodeField, hashLabel, toHex } from '@verishield/shared/sdk';
import { isAlreadyProvisionedError } from '../packages/web/src/lib/midnight/alreadyOnChain';

const RUN_LIVE = process.env.RUN_LIVE_PREPROD === '1';

const ADDRESS = 'f9966bb9b48e0eba85a59909b0a3619e904a48888f5c19b6ab9501efa958747f';
const ENDPOINT = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const KEY_HEX = '9f2c4a1d7b3e5086ac91d42f6b8e07c5d3a41f928b6c0e7d5a3f1902c8b4e6a1';
const NAME = 'Pune University';

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function timed(label: string, work: () => Promise<unknown> | unknown, runs = 5): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await work();
    samples.push(Math.round(performance.now() - t0));
  }
   
  console.log(`  ${label}: ${samples.join('ms, ')}ms  (avg ${Math.round(samples.reduce((a, b) => a + b, 0) / runs)}ms)`);
  return samples;
}

const LATEST_Q = 'query($a: HexEncoded!){contractAction(address:$a){__typename state zswapState transaction{id hash block{height}}}}';
const BLOCK_Q = 'query($o: BlockOffset!){block(offset:$o){height ledgerParameters}}';

async function fetchLatest() {
  const j = await (await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: LATEST_Q, variables: { a: ADDRESS } }) })).json();
  return j.data.contractAction;
}
async function fetchBlock(height: number) {
  const j = await (await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: BLOCK_Q, variables: { o: { height } } }) })).json();
  return j.data.block;
}

describe.skipIf(!RUN_LIVE)('provisioning stage profiling (live Preprod, RUN_LIVE_PREPROD=1)', () => {
  it('measures indexer round-trips and tx construction', async () => {
    setNetworkId('preprod');
    const latest = await fetchLatest();
    const block = await fetchBlock(latest.transaction.block.height);

     
    console.log('indexer round-trips (network-bound):');
    await timed('latest-action query', () => fetchLatest());
    await timed('block ledger-params query', () => fetchBlock(latest.transaction.block.height));

     
    console.log('deserialize (CPU):');
    let cs: OnChainContractState | null = null;
    await timed('ContractState.deserialize', () => {
      cs = OnChainContractState.deserialize(hexToBytes(latest.state));
    }, 10);
    await timed('ZswapChainState.deserialize', () => ZswapChainState.deserialize(hexToBytes(latest.zswapState)), 10);
    await timed('LedgerParameters.deserialize', () => LedgerParameters.deserialize(hexToBytes(block.ledgerParameters)), 10);

    const epkBech = ShieldedEncryptionPublicKey.codec.encode('preprod', new ShieldedEncryptionPublicKey(hexToBytes(KEY_HEX))).toString();
    const issuerIdBytes = fromHex(toHex(hashLabel(`issuer:${NAME}`)));
    const issuerSigningKey = await signingKeyFromSecret(fromHex(KEY_HEX));
    const EMPTY = {};
    let cc = CompiledContract.make('verishield-credential-registry', Contract);
    cc = CompiledContract.withWitnesses(cc, {
      issuerSigningKey: () => [EMPTY, issuerSigningKey],
      credentialPayload: () => {
        throw new Error('unused');
      },
      credentialSalt: () => {
        throw new Error('unused');
      },
    });

    const build = (circuitId: 'registerIssuer' | 'registerSchema' | 'anchorCredential', args: unknown[]) =>
      createUnprovenCallTxFromInitialStates(
        { getVerifierKey: async () => { throw new Error('unused'); }, getVerifierKeys: async () => { throw new Error('unused'); } } as never,
        {
          compiledContract: cc,
          contractAddress: ADDRESS,
          circuitId,
          args: args as never,
          coinPublicKey: KEY_HEX,
          initialContractState: cs!,
          initialZswapChainState: ZswapChainState.deserialize(hexToBytes(latest.zswapState)),
          ledgerParameters: LedgerParameters.deserialize(hexToBytes(block.ledgerParameters)),
          initialPrivateState: EMPTY,
        } as never,
        epkBech as never,
      );

    cs = OnChainContractState.deserialize(hexToBytes(latest.state));

     
    console.log('classification probes (circuit execution vs REAL current state):');
    const probe = async (circuitId: 'registerIssuer' | 'registerSchema' | 'anchorCredential', args: unknown[]) => {
      try {
        await build(circuitId, args);
        return 'pending' as const;
      } catch (error) {
        return isAlreadyProvisionedError(error) ? ('already-on-chain' as const) : String(error);
      }
    };
    const t0 = performance.now();
    const registerIssuer = await probe('registerIssuer', [issuerIdBytes, encodeField(NAME), BigInt(Math.floor(Date.now() / 1000))]);
    const schemaId = toHex(hashLabel('schema:Degree'));
    const schemaHash = toHex(hashLabel('schema-hash:Degree'));
    const degreeSchema = await probe('registerSchema', [fromHex(schemaId), fromHex(schemaHash)]);
    const anchor = await probe('anchorCredential', [issuerIdBytes, fromHex('ef8e0faf7c1f51bc88e277d5d4d815a1bd1fe8495de40b4781714042e4a178cd')]);
     
    console.log(`  classify all vs state: ${Math.round(performance.now() - t0)}ms`);
     
    console.log(`  registerIssuer=${registerIssuer} degreeSchema=${degreeSchema} anchor=${anchor}`);

     
    console.log('tx construction (circuit execution, CPU):');
    const warmState = cs;
    const warmZswap = ZswapChainState.deserialize(hexToBytes(latest.zswapState));
    const warmLp = LedgerParameters.deserialize(hexToBytes(block.ledgerParameters));
    // anchorCredential is the one demo step still genuinely pending on-chain,
    // so its circuit EXECUTION succeeds against the real current state.
    const anchorArgs = [issuerIdBytes, fromHex('ef8e0faf7c1f51bc88e277d5d4d815a1bd1fe8495de40b4781714042e4a178cd')];
    const anchorBuild = () =>
      createUnprovenCallTxFromInitialStates(
        { getVerifierKey: async () => { throw new Error('unused'); }, getVerifierKeys: async () => { throw new Error('unused'); } } as never,
        {
          compiledContract: cc,
          contractAddress: ADDRESS,
          circuitId: 'anchorCredential',
          args: anchorArgs as never,
          coinPublicKey: KEY_HEX,
          initialContractState: warmState,
          initialZswapChainState: warmZswap,
          ledgerParameters: warmLp,
          initialPrivateState: EMPTY,
        } as never,
        epkBech as never,
      );
    await anchorBuild();
    await timed('anchorCredential warm (execute + serialize only)', () => anchorBuild(), 3);
    expect(cs).not.toBeNull();
  }, 120_000);
});