/**
 * VeriShield CLI — issuer / holder / verifier flows without a UI.
 *
 *   pnpm cli                    # demo: full issuer -> holder -> verifier walkthrough
 *   pnpm cli network            # print the active network + contract address
 *   pnpm cli deploy             # register issuer + schema, write deploy manifest
 *   pnpm cli issue [flags]      # build + anchor a credential, write credential.json
 *   pnpm cli prove <cred> --claim <kind|json>   # generate a proof, write proof.json
 *   pnpm cli verify <proof>     # verify a proof artifact
 *
 * Every command replays the same deterministic simulator ledger: wallet seed is
 * persisted in `.midnight-wallet-state/`, and the issuer + schema are
 * re-registered from the same wallet secret, so a credential anchored by
 * `issue` can be proven by a later `prove` invocation.
 */

import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createVeriShield,
  fromHex,
  generateProof,
  toUnixSeconds,
  verifyProof,
} from '@verishield/shared/sdk';
import type {
  BuiltCredential,
  Claim,
  ClaimKind,
  ProofArtifact,
  SerializedCredential,
} from '@verishield/shared';
import { deserializeCredential, serializeCredential } from '@verishield/shared';

import { contractAddressFor, describeNetwork, getNetworkConfig } from './network.js';
import { connectWallet, type WalletClient } from './wallet.js';
import { deployRegistry } from './deploy.js';
import { runSetup } from './setup.js';

const YEAR = 365.25 * 24 * 60 * 60;
const now = Math.floor(Date.now() / 1000);

const HELP = `
VeriShield CLI — credential registry flows without a UI

  pnpm cli                      demo: issuer -> holder -> verifier walkthrough
  pnpm cli network              print network config + registry contract address
  pnpm cli deploy [--network=]  register issuer + schema, write manifest
  pnpm cli setup                run the environment/toolchain setup script
  pnpm cli issue [flags]        build + anchor a credential
  pnpm cli prove <cred.json> --claim <kind|json>   generate a proof
  pnpm cli verify <proof.json>  verify a proof artifact

issue flags:
  --name "Holder Name"   --degree "BSc Computer Science"
  --dob 2000-01-01       --cgpa 8.0
  --issuer "University of Midnight"   --schema "BachelorDegree:v1"
  --holder "stable-binding"           --out credential.json

prove flags:
  --claim HAS_CREDENTIAL | FIELD_EQUALS | RANGE_PROOF | AGE_OVER | NOT_EXPIRED
  --claim '{"kind":"RANGE_PROOF","minCgpa":7.5}'     --out proof.json

verify flags:
  --issuer <hex>   --schema <hex>    (expected values, optional)
`.trim();

function flag(args: string[], name: string, fallback?: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1];
}

function parseClaim(raw: string): Claim {
  const kinds: ClaimKind[] = ['HAS_CREDENTIAL', 'FIELD_EQUALS', 'RANGE_PROOF', 'AGE_OVER', 'NOT_EXPIRED'];
  if ((kinds as string[]).includes(raw)) return { kind: raw as ClaimKind };
  try {
    return JSON.parse(raw) as Claim;
  } catch {
    throw new Error(`Invalid --claim "${raw}". Use a claim kind or a JSON claim object.`);
  }
}

// ---------------------------------------------------------------------------
// Runtime replay: the same deterministic ledger every command sees.
// ---------------------------------------------------------------------------

async function replayRuntime() {
  const config = getNetworkConfig(process.env);
  const wallet = await connectWallet();
  const vs = await createVeriShield({
    coinPublicKey: wallet.coinPublicKey,
    contractAddress: contractAddressFor(config, wallet.address),
    proofServerUrl: config.proofServerUrl,
  });
  return { vs, config, wallet };
}

async function prepareIssuer(
  vs: Awaited<ReturnType<typeof createVeriShield>>,
  wallet: WalletClient,
  issuerName: string,
  issuerId?: string,
): Promise<void> {
  await vs.registerIssuer({ issuerName, issuerId, secretKey: wallet.seedHex });
}

async function prepareSchema(
  vs: Awaited<ReturnType<typeof createVeriShield>>,
  wallet: WalletClient,
  schemaName: string,
  schemaId?: string,
): Promise<void> {
  await vs.registerSchema({ schemaName, schemaId, secretKey: wallet.seedHex });
}

function credentialFile(path: string): SerializedCredential {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as SerializedCredential;
  if (parsed.version !== 1) throw new Error(`Unsupported credential version ${parsed.version}`);
  return parsed;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdNetwork(): Promise<void> {
  const config = getNetworkConfig(process.env);
  const wallet = await connectWallet();
  console.log(describeNetwork(config));
  console.log(`  simulator anchor    ${contractAddressFor(config, wallet.address)} (in-memory ledger, not an on-chain address)`);
  console.log(`  wallet address     ${wallet.address}`);
}

async function cmdIssue(args: string[]): Promise<void> {
  const { vs, wallet } = await replayRuntime();
  const issuerName = flag(args, 'issuer') ?? process.env.MIDNIGHT_ISSUER_NAME ?? 'University of Midnight';
  const schemaName = flag(args, 'schema') ?? process.env.MIDNIGHT_ISSUER_SCHEMA ?? 'BachelorDegree:v1';
  await prepareIssuer(vs, wallet, issuerName);
  await prepareSchema(vs, wallet, schemaName);

  const subjectName = flag(args, 'name') ?? 'Demo Holder';
  const degree = flag(args, 'degree') ?? 'BSc Computer Science';
  const dob = flag(args, 'dob') ?? '2000-01-01';
  const cgpaRaw = flag(args, 'cgpa') ?? '8.0';
  const cgpa = Number(cgpaRaw);
  if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) throw new Error(`Invalid cgpa "${cgpaRaw}"`);

  const credential = await vs.issueCredential(
    {
      issuerName,
      schemaName,
      subject: {
        name: subjectName,
        degree,
        dateOfBirth: toUnixSeconds(dob),
        cgpa,
        holderBinding: flag(args, 'holder'),
      },
    },
    wallet.seedHex,
  );

  const out = flag(args, 'out') ?? 'credential.json';
  await writeFile(out, `${JSON.stringify(serializeCredential(credential), null, 2)}\n`);

  printDisclosure(credential);
  console.log(`  credential written ${resolve(out)}`);
}

async function cmdProve(args: string[]): Promise<void> {
  const credPath = args[0];
  if (!credPath) throw new Error('usage: pnpm cli prove <credential.json> --claim <kind|json>');
  const claimRaw = flag(args, 'claim');
  if (!claimRaw) throw new Error('missing --claim');

  const { vs, wallet } = await replayRuntime();
  const serialized = credentialFile(credPath);
  const credential = deserializeCredential(serialized);

  await prepareIssuer(vs, wallet, serialized.disclosure.issuerName, serialized.disclosure.issuerId);
  await prepareSchema(vs, wallet, serialized.disclosure.schemaName, serialized.disclosure.schemaId);
  await vs.runtime.anchorCredential(
    fromHex(serialized.disclosure.issuerId),
    credential.commitment,
    now,
    wallet.signingSecret(),
  );

  const claim = parseClaim(claimRaw);
  const artifact = await generateProof({ runtime: vs.runtime, credential, claim, blockTime: now });
  const out = flag(args, 'out') ?? 'proof.json';
  await writeFile(out, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(
    `  ${claim.kind.padEnd(15)} proofValid=${artifact.proofValid} (${artifact.timings.circuitMs}ms)` +
      (artifact.failureReason ? `\n  rejected: ${artifact.failureReason}` : ''),
  );
  console.log(`  proof written      ${resolve(out)}`);
  if (!artifact.proofValid) process.exitCode = 1;
}

async function cmdVerify(args: string[]): Promise<void> {
  const proofPath = args[0];
  if (!proofPath) throw new Error('usage: pnpm cli verify <proof.json>');
  const artifact = JSON.parse(readFileSync(proofPath, 'utf8')) as ProofArtifact;
  const result = verifyProof(artifact, {
    claim: artifact.claim,
    issuerId: flag(args, 'issuer'),
    schemaId: flag(args, 'schema'),
  });

  console.log(`  claim              ${artifact.claim}`);
  console.log(`  proofValid         ${artifact.proofValid}`);
  console.log(`  verified           ${result.valid}${result.reason ? ` — ${result.reason}` : ''}`);
  if (!result.valid) process.exitCode = 1;
}

async function cmdDemo(): Promise<void> {
  const { vs, wallet } = await replayRuntime();
  const config = getNetworkConfig(process.env);
  const issuerName = 'University of Midnight';
  const schemaName = 'BachelorDegree:v1';
  await prepareIssuer(vs, wallet, issuerName);
  await prepareSchema(vs, wallet, schemaName);

  console.log(`VeriShield demo — ${config.label} (simulator)`);
  console.log(`  simulator anchor   ${contractAddressFor(config, wallet.address)} (in-memory ledger, not an on-chain address)`);

  const credential = await vs.issueCredential(
    {
      issuerName,
      schemaName,
      subject: { name: 'Priya Sharma', degree: 'BSc Computer Science', dateOfBirth: now - 25 * YEAR, cgpa: 8.21 },
      issuedAt: now - 10 * 24 * 60 * 60,
      expiresAt: now + 300 * 24 * 60 * 60,
    },
    wallet.seedHex,
  );
  printDisclosure(credential);

  const claims: Claim[] = [
    { kind: 'HAS_CREDENTIAL' },
    { kind: 'FIELD_EQUALS', expectedDegree: 'BSc Computer Science' },
    { kind: 'RANGE_PROOF', minCgpa: 7.5 },
    { kind: 'AGE_OVER', minAge: 18 },
    { kind: 'NOT_EXPIRED' },
  ];

  console.log('\n  holder proves:');
  for (const claim of claims) {
    const artifact = await vs.generateProof(credential, claim, now);
    const verified = verifyProof(artifact);
    console.log(
      `    ${claim.kind.padEnd(15)} ${artifact.proofValid && verified.valid ? 'ok' : 'FAILED'} (${artifact.timings.circuitMs}ms)`,
    );
  }

  const negative = await vs.generateProof(credential, { kind: 'RANGE_PROOF', minCgpa: 9.5 }, now);
  console.log(`    ${'RANGE_PROOF 9.5'.padEnd(15)} rejected (${negative.failureReason ?? 'ok'})`);

  await vs.revokeCredential(credential, wallet.seedHex);
  const afterRevoke = await vs.generateProof(credential, { kind: 'HAS_CREDENTIAL' }, now);
  console.log(`    ${'AFTER REVOCATION'.padEnd(15)} rejected (${afterRevoke.failureReason ?? 'ok'})`);

  const summary = vs.publicLedger();
  console.log('\n  ledger summary');
  console.log(`    issuerCount        ${summary.issuerCount}`);
  console.log(`    verificationCount  ${summary.verificationCount}`);
  console.log(`    issuanceRoot       ${summary.issuanceRoot.slice(0, 24)}…`);
  console.log(`    revocationRoot     ${summary.revocationRoot.slice(0, 24)}…`);

  console.log('\nDemo complete. Preprod/live on-chain deploys need a funded wallet — see pnpm run deploy.');
}

function printDisclosure(credential: BuiltCredential): void {
  const d = credential.disclosure;
  console.log('\n  issued credential');
  console.log(`    id                ${d.id}`);
  console.log(`    issuer            ${d.issuerName} (${d.issuerId.slice(0, 24)}…)`);
  console.log(`    schema            ${d.schemaName} (${d.schemaId.slice(0, 24)}…)`);
  console.log(`    commitment        ${d.commitment.slice(0, 24)}…`);
  console.log(`    leaf              ${d.leaf.slice(0, 24)}…`);
  console.log(`    expires           ${new Date(d.expiresAt * 1000).toISOString().slice(0, 10)}`);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'demo';
  switch (command) {
    case 'demo':
      await cmdDemo();
      break;
    case 'network':
      await cmdNetwork();
      break;
    case 'deploy':
      await deployRegistry({ network: process.argv.find((a) => a.startsWith('--network='))?.slice('--network='.length) });
      break;
    case 'setup':
      await runSetup();
      break;
    case 'issue':
      await cmdIssue(process.argv.slice(3));
      break;
    case 'prove':
      await cmdProve(process.argv.slice(3));
      break;
    case 'verify':
      await cmdVerify(process.argv.slice(3));
      break;
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command "${command}"\n\n${HELP}`);
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});