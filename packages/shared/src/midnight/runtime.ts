/**
 * VeriShield runtime.
 *
 * Drives the compiled `credential-registry` contract through the Midnight
 * `@midnight-ntwrk/compact-runtime` circuit simulator. The simulator executes
 * the real generated circuit bytecode (the same code a proof server would
 * prove), so every assertion in the Compact source is enforced here - including
 * the in-circuit JubJub Schnorr verification of the issuer's credential
 * signature.
 *
 * This is deliberately the ONLY place that knows how to talk to Midnight.
 * Everything above it works with `buildCredential` / `hashCredential` /
 * `generateProof` / `verifyProof`.
 *
 * Note: Compact runtime 0.19.0 made circuit execution asynchronous, so the
 * runtime is created via `VeriShieldRuntime.create(...)` and every circuit call
 * returns a Promise.
 */

import {
  Contract,
  ledger,
  type Ledger,
  type Witnesses,
} from '@verishield/contracts';
import {
  createConstructorContext,
  createCircuitContext,
  sampleContractAddress,
  type CircuitContext,
  type CircuitResults,
  type ContractState,
  type StateValue,
  type ChargedState,
} from '@midnight-ntwrk/compact-runtime';

/** The ledger state evolves between StateValue/ChargedState/ContractState. */
type LedgerState = ContractState | StateValue | ChargedState;

import type {
  CredentialPayloadValue,
  JubjubSchnorrSignatureValue,
} from '../types/verishield.js';

export type Bytes32Hex = string;

interface WitnessState {
  issuerSigningKey: bigint | null;
  credentialSignature: JubjubSchnorrSignatureValue | null;
  credentialPayload: CredentialPayloadValue | null;
  credentialSalt: Uint8Array | null;
}

type PrivateState = Record<string, never>;

export interface RuntimeOptions {
  /** Zswap coin public key of the executing actor (hex). Defaults to 32 zero bytes. */
  coinPublicKey?: string;
  /** Contract address. Defaults to a sampled address for local runs. */
  contractAddress?: string;
}

function requireWitness<T>(value: T | null, name: string): T {
  if (value === null) {
    throw new Error(
      `Witness "${name}" was requested but no value is loaded. ` +
        `Load the correct role (issuer signing key / credential payload) before running this circuit.`,
    );
  }
  return value;
}

export class VeriShieldRuntime {
  private readonly contract: Contract<PrivateState, Witnesses<PrivateState>>;
  private readonly address: string;
  private readonly coinPublicKey: string;
  private readonly witnessState: WitnessState = {
    issuerSigningKey: null,
    credentialSignature: null,
    credentialPayload: null,
    credentialSalt: null,
  };
  private ledgerState!: LedgerState;
  private readonly privateState: PrivateState = {};

  private constructor(options: RuntimeOptions = {}) {
    this.coinPublicKey = options.coinPublicKey ?? '00'.repeat(32);
    this.address = options.contractAddress ?? sampleContractAddress();

    const witnesses: Witnesses<PrivateState> = {
      issuerSigningKey: () => [
        this.privateState,
        requireWitness(this.witnessState.issuerSigningKey, 'issuerSigningKey'),
      ],
      credentialSignature: () => [
        this.privateState,
        requireWitness(this.witnessState.credentialSignature, 'credentialSignature'),
      ],
      credentialPayload: () => [
        this.privateState,
        requireWitness(this.witnessState.credentialPayload, 'credentialPayload'),
      ],
      credentialSalt: () => [
        this.privateState,
        requireWitness(this.witnessState.credentialSalt, 'credentialSalt'),
      ],
    };

    this.contract = new Contract<PrivateState, Witnesses<PrivateState>>(witnesses);
  }

  /** Creates a runtime with the contract's initial ledger state. */
  static async create(options: RuntimeOptions = {}): Promise<VeriShieldRuntime> {
    const runtime = new VeriShieldRuntime(options);
    const { currentContractState } = await runtime.contract.initialState(
      createConstructorContext(runtime.privateState, runtime.coinPublicKey),
    );
    // `initialState` returns a `ContractState` wrapper; the contract's `ledger()`
    // helper needs the inner `ChargedState` (ContractState.data). Storing the
    // wrapper makes `readLedger()` throw before the first circuit ever runs.
    runtime.ledgerState = currentContractState.data;
    return runtime;
  }

  get contractAddress(): string {
    return this.address;
  }

  /** Runs a circuit with the given witnesses loaded. Advances ledger state. */
  private async call<R>(
    circuit: string,
    args: unknown[],
    blockTime: number,
  ): Promise<R> {
    const context = createCircuitContext(
      circuit,
      this.address,
      this.coinPublicKey,
      this.ledgerState,
      this.privateState,
      undefined,
      undefined,
      undefined,
      blockTime,
    );
    const circuits = this.contract.circuits as unknown as Record<
      string,
      (ctx: CircuitContext<PrivateState>, ...rest: unknown[]) => Promise<CircuitResults<PrivateState, R>>
    >;
    const { result, context: next } = await circuits[circuit](context, ...args);
    this.ledgerState = next.callContext.currentQueryContext.state;
    return result;
  }

  // --- issuer-signing-key scoped circuits --------------------------------

  async registerIssuer(
    issuerId: Uint8Array,
    name: Uint8Array,
    registeredAt: number,
    signingKey: bigint,
  ): Promise<void> {
    this.witnessState.issuerSigningKey = signingKey;
    try {
      await this.call('registerIssuer', [issuerId, name, BigInt(registeredAt)], registeredAt);
    } finally {
      this.witnessState.issuerSigningKey = null;
    }
  }

  async registerSchema(schemaId: Uint8Array, schemaHash: Uint8Array, blockTime: number): Promise<void> {
    await this.call('registerSchema', [schemaId, schemaHash], blockTime);
  }

  async anchorCredential(
    issuerId: Uint8Array,
    commitment: Uint8Array,
    blockTime: number,
    signingKey: bigint,
  ): Promise<Uint8Array> {
    this.witnessState.issuerSigningKey = signingKey;
    try {
      return await this.call<Uint8Array>('anchorCredential', [issuerId, commitment], blockTime);
    } finally {
      this.witnessState.issuerSigningKey = null;
    }
  }

  async revokeCredential(
    issuerId: Uint8Array,
    commitment: Uint8Array,
    blockTime: number,
    signingKey: bigint,
  ): Promise<void> {
    this.witnessState.issuerSigningKey = signingKey;
    try {
      await this.call('revokeCredential', [issuerId, commitment], blockTime);
    } finally {
      this.witnessState.issuerSigningKey = null;
    }
  }

  async publishRevocationRoot(
    issuerId: Uint8Array,
    root: Uint8Array,
    blockTime: number,
    signingKey: bigint,
  ): Promise<void> {
    this.witnessState.issuerSigningKey = signingKey;
    try {
      await this.call('updateRevocationRoot', [issuerId, root], blockTime);
    } finally {
      this.witnessState.issuerSigningKey = null;
    }
  }

  // --- holder-secret scoped circuits -------------------------------------

  async proveClaim(
    circuit:
      | 'proveHoldsCredential'
      | 'proveFieldEquals'
      | 'proveRange'
      | 'proveAgeOver'
      | 'proveNotExpired',
    args: unknown[],
    credential: {
      payload: CredentialPayloadValue;
      salt: Uint8Array;
      signature: JubjubSchnorrSignatureValue;
    },
    blockTime: number,
  ): Promise<boolean> {
    this.witnessState.credentialPayload = credential.payload;
    this.witnessState.credentialSalt = credential.salt;
    this.witnessState.credentialSignature = credential.signature;
    try {
      return await this.call<boolean>(circuit, args, blockTime);
    } finally {
      this.witnessState.credentialPayload = null;
      this.witnessState.credentialSalt = null;
      this.witnessState.credentialSignature = null;
    }
  }

  // --- observation --------------------------------------------------------

  readLedger(): Ledger {
    return ledger(this.ledgerState as StateValue | ChargedState);
  }

  /** Exports the ledger for persistence / handing to another actor. */
  snapshot(): LedgerState {
    return this.ledgerState;
  }

  restore(state: LedgerState): void {
    this.ledgerState = state;
  }
}
