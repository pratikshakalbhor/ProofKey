# VeriShield

[![CI](https://github.com/OWNER/verishield/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/verishield/actions/workflows/ci.yml)

Zero-knowledge credential verification on Midnight. Prove a claim — don't hand over the whole certificate.

> Replace `OWNER` in the badge URL above with the GitHub organization/user that hosts this repo.

## What is this?

When applying for jobs, visas, or loans, people hand over their entire degree certificate or ID even though the verifier only needs one fact ("has a bachelor's degree", "is over 18"). VeriShield lets the issuer anchor a credential on-chain, the holder generate a zero-knowledge proof of a single claim, and the verifier receive **ONLY** `{ proofValid: true }` — a boolean, and nothing else.

## Monorepo layout

```
verishield/
├── docker-compose.yml            Local Midnight devnet (node + indexer + proof server)
├── packages/
│   ├── contracts/                Compact contract
│   │   ├── src/credential-registry.compact
│   │   └── managed/credential-registry/   Compiled artifacts (ZK keys + bindings)
│   ├── shared/                   Types, crypto SDK and the four-function API
│   │   ├── src/midnight/         buildCredential / hashCredential / generateProof / verifyProof
│   │   └── scripts/e2e-crypto.ts Full lifecycle harness
│   ├── issuer-api/               Express + SQLite issuer service (Phase 3)
│   └── web/                      React 18 + Vite frontend — all three portals
```

## Prerequisites

- Node.js **22+**
- pnpm **12+** (`npm i -g pnpm`); the exact version is pinned in `package.json` (`packageManager`)
- Compact toolchain **0.34.0** (`compact` on `PATH`; manager at `~/.local/bin/compact`) — this is the minimum version that binds the JubJub Schnorr builtins used for in-circuit signature verification
- Docker + Docker Compose v2 — only needed for the real devnet / proof server

## Getting started

```bash
pnpm install
pnpm dev                 # web app on http://localhost:3000
pnpm test:e2e-crypto     # full credential lifecycle, no devnet required
```

## The SDK interface

Everything the frontend needs lives in `@verishield/shared/sdk`:

```ts
import { createVeriShield } from '@verishield/shared/sdk';

const vs = await createVeriShield();
const secret = randomBytes(32);

const { issuerId } = await vs.registerIssuer({ issuerName: 'University of Midnight', secretKey: secret });
const { schemaId } = await vs.registerSchema({ schemaName: 'BachelorDegree:v1', secretKey: secret });

// Builds the credential, signs the commitment with the issuer's JubJub key and
// anchors it on-chain.
const credential = await vs.issueCredential(
  {
    issuerName: 'University of Midnight',
    issuerId,
    schemaName: 'BachelorDegree:v1',
    schemaId,
    subject: { name: 'Priya Sharma', degree: 'BSc Computer Science', dateOfBirth: '2001-04-12', cgpa: 8.21 },
  },
  secret,
);

// The only thing the verifier ever sees: { proofValid: true }.
const proof = await vs.generateProof(credential, { kind: 'AGE_OVER', minAge: 18 });
const { valid } = vs.verifyProof(proof, { claim: 'AGE_OVER' });
```

`buildCredential`, `hashCredential`, `generateProof` and `verifyProof` are also exported as standalone functions. Nothing above the SDK imports `@verishield/contracts` or the Midnight runtime directly.

The default `@verishield/shared` entry point is browser-safe (types + constants only). The `sdk` subpath bundles the onchain-runtime WASM, so a browser build must import it lazily and enable WASM support (e.g. `vite-plugin-wasm`).

## The contract

`packages/contracts/src/credential-registry.compact` holds issuer/schema registries, an issuance commitment accumulator, a revocation set and the five claim circuits:

| Claim | Circuit | Predicate |
|-------|---------|-----------|
| `HAS_CREDENTIAL` | `proveHoldsCredential` | commitment anchored to an active issuer **and** carrying that issuer's valid JubJub Schnorr signature |
| `FIELD_EQUALS` | `proveFieldEquals` | a private field equals an expected value |
| `RANGE_PROOF` | `proveRange` | CGPA ≥ threshold |
| `AGE_OVER` | `proveAgeOver` | `blockTimeGte(dob + minAge·yr)` |
| `NOT_EXPIRED` | `proveNotExpired` | `blockTimeLt(expiry)` |

Every claim circuit returns a single `Boolean` and writes `lastProofValid`.

**Issuer authenticity is enforced in-circuit.** Each issuer registers a JubJub verifying key (`ecMulGenerator(issuerSigningKey)`). Issuing a credential produces a JubJub Schnorr signature over the credential commitment; the claim circuits recompute the commitment from the holder's private payload and run `jubjubSchnorrVerify<32>(commitment as Vector<32, Field>, credentialSignature(), issuer.verifyingKey)`. A forged signature, or one produced by any key other than the registered issuer's, makes the circuit assert and the proof fail — so the verifier trusts the on-chain proving system, not an off-chain check.

Recompile after editing the contract:

```bash
pnpm compile:contracts      # compact compile → packages/contracts/managed/credential-registry
```

### Toolchain notes (verified against Compact 0.34.0)

- **In-circuit signature verification requires Compact ≥ 0.34.0.** The `JubjubPoint`, `JubjubScalar`, `JubjubSchnorrSignature` types and the `jubjubSchnorrVerify` / `jubjubSchnorrSign` / `ecMulGenerator` builtins are not present in the 0.31.x standard library (nor in `@midnight-ntwrk/compact-runtime@0.16.0`), which is why earlier builds could only anchor commitments. This repo now targets compiler **0.34.0**, language **0.26.0**, runtime **0.19.0**. Run `compact update 0.34.0` before `pnpm compile:contracts`.
- Compact runtime 0.19.0 made circuit execution asynchronous: `VeriShieldRuntime.create(...)` and every circuit call return Promises, and `createCircuitContext` takes the circuit id as its first argument.
- `MerkleTree.root()` is runtime-only and cannot be called in-circuit; membership uses `checkRoot(merkleTreePathRoot(path))` and revocation uses a `Set`.
- Time predicates reveal the 1-bit claim bound by construction (`blockTimeGte`/`blockTimeLt` require an explicit `disclose`); no PII is disclosed.

## Local devnet

```bash
docker compose up -d
docker compose ps
```

| Service | URL | Image |
|---------|-----|-------|
| Node | http://localhost:9944 | `midnightntwrk/midnight-node:0.22.3` |
| Indexer | http://localhost:8088/api/v4/graphql | `midnightntwrk/indexer-standalone:4.0.1` |
| Proof server | http://localhost:6300 | `midnightntwrk/proof-server:8.0.3` |

The proof server runs locally on port 6300 for every network (including preprod) because it processes private witness data. Check it with `curl http://localhost:6300/health`.

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Run the web app (Vite, port 3000) |
| `pnpm dev:issuer` | Run the issuer API (Express + SQLite) |
| `pnpm build` | Build shared, issuer-api and web |
| `pnpm lint` | ESLint across the whole workspace |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm compile:contracts` | Recompile the Compact contract (ZK keys + bindings) |
| `pnpm test:e2e-crypto` | Full credential lifecycle against the compiled circuits |

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main`, every pull request and on manual dispatch. It installs with `--frozen-lockfile`, then runs `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test:e2e-crypto`. The badge at the top of this README reflects the latest `main` result.

## Preprod deployment

> **Contract address (Preprod):** `PENDING — filled in after Phase 4 deployment`

Phase 4 adds a deploy script to `packages/contracts` that:
1. starts the local proof server (`docker compose up -d proof-server`) — it runs locally for every network so private witnesses never leave the machine;
2. connects to a Preprod-funded wallet and the Preprod indexer;
3. submits the compiled `credential-registry` contract and writes the resulting address to `.midnight-state.json`.

The deploying wallet must hold tDUST on Preprod.

## Status

- **Phase 1** — design system, component library, landing page, three portal shells, mock data. Done.
- **Phase 2** — Compact contract, compiled ZK circuits, **in-circuit JubJub Schnorr issuer-signature verification**, shared crypto SDK, in-terminal e2e lifecycle (29/29 checks), devnet compose. Done.
- **Phase 3** — portals wired to the shared SDK, issuer API (Express + SQLite), 1AM wallet connect (discovery, connection status, addresses, shielded/unshielded/DUST balances) and in-browser circuit-simulator proofs. Done.
- **Phase 4** — Preprod deployment (contract address above), indexer reads, real proof-server proving. In progress.

## License

Apache-2.0
