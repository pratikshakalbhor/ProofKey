/**
 * Node-side 1AM wallet connector for the VeriShield CLI.
 *
 * "1AM" = one wallet at a time: a single local wallet identity is persisted in
 * `.midnight-wallet-state/` (gitignored) and reused by every CLI / deploy
 * invocation, so a devnet identity survives across processes.
 *
 * This is a local / devnet connector: there is no `@midnight-ntwrk/wallet`
 * dependency yet, so the wallet is a deterministically derived identity rooted
 * in a random 32-byte seed. The seed hex doubles as the runtime `coinPublicKey`
 * (the same 32-byte form the circuit simulator accepts) and every credential
 * the issuer signs on the local ledger reuses the same identity.
 *
 * Swap this module for a real wallet library (e.g. `@midnight-ntwrk/wallet`
 * backed by a resident key manager / mnemonic) without touching `cli.ts` —
 * callers only use the `WalletClient` surface below.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  hashLabel,
  randomBytes,
  signingKeyFromSecret,
  toHex,
} from '@verishield/shared/sdk';

export const WALLET_SEED_BYTES = 32;

export interface WalletClient {
  /** The persisted wallet identity (deterministic across runs). */
  readonly seedHex: string;
  /** Hex string accepted by the runtime as `coinPublicKey`. */
  readonly coinPublicKey: string;
  /** Deterministic devnet address for this wallet. */
  readonly address: string;
  /** Directory holding the wallet state. */
  readonly stateDir: string;
  getCoinPublicKey(): string;
  getAddress(): string;
  /** JubJub signing scalar derived from the seed (issuer operations). */
  signingSecret(): bigint;
  disconnect(): void;
}

interface WalletStateFile {
  version: 1;
  seedHex: string;
  createdAt: number;
}

function defaultStateDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.MIDNIGHT_WALLET_STATE ?? resolve(join(process.cwd(), '.midnight-wallet-state'));
}

function walletStatePath(stateDir: string): string {
  return join(stateDir, 'wallet.json');
}

function deriveAddress(seedHex: string): string {
  return `mn-${toHex(hashLabel(`wallet:${seedHex}`))}`;
}

async function loadOrCreateWallet(stateDir: string, env: NodeJS.ProcessEnv): Promise<WalletClient> {
  const statePath = walletStatePath(stateDir);
  await mkdir(stateDir, { recursive: true });

  let seedHex = '';
  const existingSeed = env.MIDNIGHT_WALLET_SEED;
  if (existingSeed) {
    seedHex = existingSeed.length === 64 && /^[0-9a-f]{64}$/i.test(existingSeed) ? existingSeed.toLowerCase() : '';
  }
  if (!seedHex && existsSync(statePath)) {
    try {
      const parsed = JSON.parse(await readFile(statePath, 'utf8')) as WalletStateFile;
      if (parsed.version === 1 && /^[0-9a-f]{64}$/i.test(parsed.seedHex)) seedHex = parsed.seedHex.toLowerCase();
    } catch {
      // fall through and regenerate
    }
  }
  if (!seedHex) {
    seedHex = toHex(randomBytes(WALLET_SEED_BYTES));
    await writeFile(statePath, JSON.stringify({ version: 1, seedHex, createdAt: Math.floor(Date.now() / 1000) } satisfies WalletStateFile, null, 2), { mode: 0o600 });
  }

  let disconnected = false;
  const wallet: WalletClient = {
    seedHex,
    coinPublicKey: seedHex,
    get address() {
      return deriveAddress(seedHex);
    },
    stateDir,
    getCoinPublicKey: () => seedHex,
    getAddress: () => deriveAddress(seedHex),
    signingSecret: () => signingKeyFromSecret(new Uint8Array(seedHex.match(/../g)!.map((b) => Number.parseInt(b, 16)))),
    disconnect: () => {
      disconnected = true;
    },
  };
  void disconnected;
  return wallet;
}

export function connectWallet(env: NodeJS.ProcessEnv = process.env): Promise<WalletClient> {
  return loadOrCreateWallet(defaultStateDir(env), env);
}

export async function disconnectWallet(wallet: WalletClient): Promise<void> {
  wallet.disconnect();
}

async function main(): Promise<void> {
  const wallet = await connectWallet();
  console.log('VeriShield 1AM wallet connector (local)');
  console.log(`  state dir     ${wallet.stateDir}`);
  console.log(`  address       ${wallet.address}`);
  console.log(`  coin pub key  ${wallet.coinPublicKey}`);
  await disconnectWallet(wallet);
}

function isMain(moduleUrl: string): boolean {
  return resolve(process.argv[1] ?? '') === decodeURIComponent(new URL(moduleUrl).pathname);
}
if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}