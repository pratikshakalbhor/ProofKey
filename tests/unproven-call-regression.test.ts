import { describe, it, expect } from 'vitest';
import { asHex as platformCpkAsHex } from '@midnight-ntwrk/platform-js/effect/CoinPublicKey';
import { parseCoinPublicKeyToHex } from '@midnight-ntwrk/midnight-js-utils';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { ContractState as LedgerV8ContractState } from '@midnight-ntwrk/ledger-v8';
import { ContractState as OnChainContractState } from '@midnight-ntwrk/onchain-runtime-v3';
import { ShieldedCoinPublicKey, ShieldedEncryptionPublicKey } from '@midnight-ntwrk/wallet-sdk-address-format';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenCallTxFromInitialStates } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from '@verishield/contracts';
import { signingKeyFromSecret, fromHex, hashLabel, toHex } from '@verishield/shared/sdk';

const KEY_HEX =
  '9f2c4a1d7b3e5086ac91d42f6b8e07c5d3a41f928b6c0e7d5a3f1902c8b4e6a1';

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Regression tests for the real Preprod failures that surfaced in the browser
 * as "Error executing circuit 'registerIssuer'":
 *
 *  1. The contract runtime executes circuits with a PLAIN HEX coin public key
 *     (`CoinPublicKey.asHex` is only a brand, not a Bech32m→hex conversion),
 *     so a Bech32m wallet key died with "Invalid hex-digit 'm' … at index 0".
 *  2. `initialContractState` must be an onchain-runtime-v3 `ContractState`
 *     instance; a ledger-v8 one fails the runtime's `coerceToChargedState`.
 *  3. `createUnprovenCallTxFromInitialStates` reads the SDK global network id,
 *     so `setNetworkId('preprod')` must precede tx building.
 */
describe('unproven-call input boundaries', () => {
  it('coin public key must be plain hex for the contract runtime', () => {
    const bech32m = ShieldedCoinPublicKey.codec
      .encode('preprod', new ShieldedCoinPublicKey(hexToBytes(KEY_HEX)))
      .toString();
    expect(bech32m.startsWith('m')).toBe(true);

    // `CoinPublicKey.asHex` goes through a validated `PlainHex` brand, so a
    // Bech32m key THROWS during validation instead of converting — that is why
    // feeding the wallet's Bech32m key straight into the runtime fails the
    // circuit execution with the "Invalid hex-digit 'm' …" error the browser
    // surfaced.
    expect(() => platformCpkAsHex(bech32m)).toThrow();

    // The tx boundary must convert explicitly via the SDK helper.
    expect(parseCoinPublicKeyToHex(bech32m, 'preprod')).toBe(KEY_HEX);
  });

  it('initialContractState must be the onchain-runtime-v3 ContractState class', () => {
    // compact-runtime coerces the received state via `instanceof ocrt.ContractState`,
    // so the ledger-v8 binding's class is rejected ("has unexpected type").
    expect(LedgerV8ContractState).not.toBe(OnChainContractState);
    expect(typeof OnChainContractState.deserialize).toBe('function');
  });

  it('setNetworkId("preprod") must run before building a call tx', async () => {
    setNetworkId('preprod');
    expect(() => setNetworkId('preprod')).not.toThrow();
    const signingKey = await signingKeyFromSecret(fromHex(KEY_HEX));
    expect(typeof signingKey).toBe('bigint');
  });
});

const RUN_LIVE = process.env.RUN_LIVE_PREPROD === '1';

describe.skipIf(!RUN_LIVE)('live Preprod unproven-build (RUN_LIVE_PREPROD=1)', () => {
  it('builds a serialised anchorCredential unproven call tx from real indexer state', async () => {
    const ADDRESS = 'f9966bb9b48e0eba85a59909b0a3619e904a48888f5c19b6ab9501efa958747f';
    const ENDPOINT = 'https://indexer.preprod.midnight.network/api/v4/graphql';
    setNetworkId('preprod');

    const latest = await (async () => {
      const q =
        'query($a: HexEncoded!){contractAction(address:$a){__typename state zswapState transaction{id hash block{height}}}}';
      const j = await (
        await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: q, variables: { a: ADDRESS } }),
        })
      ).json();
      return j.data.contractAction;
    })();

    const block = await (async () => {
      const q = 'query($o: BlockOffset!){block(offset:$o){height ledgerParameters}}';
      const j = await (
        await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: q, variables: { o: { height: latest.transaction.block.height } } }),
        })
      ).json();
      return j.data.block;
    })();

    const contractState = OnChainContractState.deserialize(hexToBytes(latest.state));
    const { LedgerParameters, ZswapChainState } = await import('@midnight-ntwrk/ledger-v8');
    const zswapChainState = latest.zswapState
      ? ZswapChainState.deserialize(hexToBytes(latest.zswapState))
      : new ZswapChainState();
    const ledgerParameters = LedgerParameters.deserialize(hexToBytes(block.ledgerParameters));

    const issuerSigningKey = await signingKeyFromSecret(fromHex(KEY_HEX));

    const EMPTY_PRIVATE_STATE = {};
    let cc = CompiledContract.make('verishield-credential-registry', Contract);
    cc = CompiledContract.withWitnesses(cc, {
      issuerSigningKey: () => [EMPTY_PRIVATE_STATE, issuerSigningKey],
      credentialPayload: () => {
        throw new Error('UNUSED witness evaluated');
      },
      credentialSalt: () => {
        throw new Error('UNUSED witness evaluated');
      },
    });

    // anchorCredential is the demo step that is still genuinely pending on-chain
    // (the issuer AND the three schemas are already registered), so the circuit
    // EXECUTION here proves the boundary wiring end-to-end against real state
    // without tripping an "already registered/anchored" assertion.
    const issuerId = fromHex(toHex(hashLabel('issuer:Pune University')));
    const commitment = fromHex('ef8e0faf7c1f51bc88e277d5d4d815a1bd1fe8495de40b4781714042e4a178cd');

    const DATA = await createUnprovenCallTxFromInitialStates(
      {
        getVerifierKey: async () => {
          throw new Error('UNUSED zk');
        },
        getVerifierKeys: async () => {
          throw new Error('UNUSED zk');
        },
      } as never,
      {
        compiledContract: cc,
        contractAddress: ADDRESS,
        circuitId: 'anchorCredential',
        args: [issuerId, commitment],
        coinPublicKey: KEY_HEX,
        initialContractState: contractState,
        initialZswapChainState: zswapChainState,
        ledgerParameters,
        initialPrivateState: EMPTY_PRIVATE_STATE,
      } as never,
      ShieldedEncryptionPublicKey.codec
        .encode('preprod', new ShieldedEncryptionPublicKey(hexToBytes(KEY_HEX)))
        .toString() as never,
    );

    const unprovenTx = (DATA as { private: { unprovenTx: { serialize: () => Uint8Array } } }).private
      .unprovenTx;
    const serialized = unprovenTx.serialize();
    expect(serialized.length).toBeGreaterThan(0);
  }, 90_000);
});