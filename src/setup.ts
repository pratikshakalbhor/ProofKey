/**
 * VeriShield environment / toolchain setup.
 *
 * Run `pnpm setup` after cloning. It validates the local toolchain, creates the
 * state directories the deploy/CLI scripts expect and writes a `.env` file from
 * `.env.example` when one does not exist yet (never overwrites user secrets).
 */

import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();

function requirement(ok: boolean, label: string, hint?: string): boolean {
  if (ok) {
    console.log(`  \u2713 ${label}`);
  } else {
    console.error(`  \u2717 ${label}${hint ? ` \u2014 ${hint}` : ''}`);
  }
  return ok;
}

function hasCommand(command: string): boolean {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore', timeout: 10000 });
  return result.status === 0;
}

async function main(): Promise<void> {
  await runSetup();
}

export async function runSetup(): Promise<void> {
  console.log('VeriShield setup');
  const failed: string[] = [];

  // --- toolchain -----------------------------------------------------------
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  if (!requirement(major >= 22, `Node.js >= 22 (found ${process.versions.node})`)) failed.push('node');
  if (!requirement(hasCommand('pnpm'), 'pnpm is available (install via corepack)')) failed.push('pnpm');
  if (!requirement(hasCommand('compact'), 'compact compiler on PATH (needed for `pnpm compile:contracts`)')) {
    failed.push('compact');
  }

  // --- dependencies ---------------------------------------------------------
  if (!requirement(existsSync(join(ROOT, 'node_modules')), 'dependencies installed (otherwise run `pnpm install`)')) {
    failed.push('deps');
  }

  // --- state directories ----------------------------------------------------
  await mkdir(join(ROOT, 'managed'), { recursive: true });
  await mkdir(join(ROOT, '.midnight-wallet-state'), { recursive: true });
  console.log('  created state directories: managed/, .midnight-wallet-state/');

  // --- .env -----------------------------------------------------------------
  const envFile = join(ROOT, '.env');
  const envExample = join(ROOT, '.env.example');
  if (!existsSync(envFile) && existsSync(envExample)) {
    await copyFile(envExample, envFile);
    console.log('  wrote .env from .env.example (defaults for local devnet)');
  } else if (existsSync(envFile)) {
    console.log('  .env already present \u2014 left untouched');
  }

  // --- report ---------------------------------------------------------------
  if (failed.length > 0) {
    console.error(`\nMissing requirements: ${failed.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nSetup complete. Next steps:');
  console.log('  pnpm install            # if deps were missing');
  console.log('  docker compose up -d    # local devnet (node + indexer + proof server)');
  console.log('  pnpm compile:contracts  # regenerate contract artifacts');
  console.log('  pnpm test               # credential-registry vitest suite');
  console.log('  pnpm run deploy         # deploy the registry (local devnet)');
}

if (resolve(process.argv[1] ?? '') === decodeURIComponent(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}