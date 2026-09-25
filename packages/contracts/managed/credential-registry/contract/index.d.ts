import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum ClaimType { HAS_CREDENTIAL = 0,
                        FIELD_EQUALS = 1,
                        RANGE_PROOF = 2,
                        AGE_OVER = 3,
                        NOT_EXPIRED = 4
}

export type Witnesses<PS> = {
  issuerSigningKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  credentialPayload(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { schemaId: Uint8Array,
                                                                                  holderBinding: Uint8Array,
                                                                                  nameHash: Uint8Array,
                                                                                  degree: Uint8Array,
                                                                                  dob: bigint,
                                                                                  cgpaTimes100: bigint,
                                                                                  issueDate: bigint,
                                                                                  expiryDate: bigint
                                                                                }];
  credentialSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerId_0: Uint8Array,
                 name_0: Uint8Array,
                 registeredAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setIssuerActive(context: __compactRuntime.CircuitContext<PS>,
                  issuerId_0: Uint8Array,
                  active_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  registerSchema(context: __compactRuntime.CircuitContext<PS>,
                 schemaId_0: Uint8Array,
                 schemaHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  anchorCredential(context: __compactRuntime.CircuitContext<PS>,
                   issuerId_0: Uint8Array,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   issuerId_0: Uint8Array,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateRevocationRoot(context: __compactRuntime.CircuitContext<PS>,
                       issuerId_0: Uint8Array,
                       root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateIssuanceRoot(context: __compactRuntime.CircuitContext<PS>,
                     issuerId_0: Uint8Array,
                     root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveHoldsCredential(context: __compactRuntime.CircuitContext<PS>,
                       issuerId_0: Uint8Array,
                       schemaId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveFieldEquals(context: __compactRuntime.CircuitContext<PS>,
                   issuerId_0: Uint8Array,
                   schemaId_0: Uint8Array,
                   expectedDegree_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveRange(context: __compactRuntime.CircuitContext<PS>,
             issuerId_0: Uint8Array,
             schemaId_0: Uint8Array,
             minCgpaTimes100_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  proveAgeOver(context: __compactRuntime.CircuitContext<PS>,
               issuerId_0: Uint8Array,
               schemaId_0: Uint8Array,
               minAge_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  proveNotExpired(context: __compactRuntime.CircuitContext<PS>,
                  issuerId_0: Uint8Array,
                  schemaId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerId_0: Uint8Array,
                 name_0: Uint8Array,
                 registeredAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setIssuerActive(context: __compactRuntime.CircuitContext<PS>,
                  issuerId_0: Uint8Array,
                  active_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  registerSchema(context: __compactRuntime.CircuitContext<PS>,
                 schemaId_0: Uint8Array,
                 schemaHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  anchorCredential(context: __compactRuntime.CircuitContext<PS>,
                   issuerId_0: Uint8Array,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   issuerId_0: Uint8Array,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateRevocationRoot(context: __compactRuntime.CircuitContext<PS>,
                       issuerId_0: Uint8Array,
                       root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateIssuanceRoot(context: __compactRuntime.CircuitContext<PS>,
                     issuerId_0: Uint8Array,
                     root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveHoldsCredential(context: __compactRuntime.CircuitContext<PS>,
                       issuerId_0: Uint8Array,
                       schemaId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveFieldEquals(context: __compactRuntime.CircuitContext<PS>,
                   issuerId_0: Uint8Array,
                   schemaId_0: Uint8Array,
                   expectedDegree_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveRange(context: __compactRuntime.CircuitContext<PS>,
             issuerId_0: Uint8Array,
             schemaId_0: Uint8Array,
             minCgpaTimes100_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  proveAgeOver(context: __compactRuntime.CircuitContext<PS>,
               issuerId_0: Uint8Array,
               schemaId_0: Uint8Array,
               minAge_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  proveNotExpired(context: __compactRuntime.CircuitContext<PS>,
                  issuerId_0: Uint8Array,
                  schemaId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
  commitmentFromPayload(schemaId_0: Uint8Array,
                        holderBinding_0: Uint8Array,
                        nameHash_0: Uint8Array,
                        degree_0: Uint8Array,
                        dob_0: bigint,
                        cgpaTimes100_0: bigint,
                        issueDate_0: bigint,
                        expiryDate_0: bigint,
                        salt_0: Uint8Array): Uint8Array;
  leafFromCommitment(issuerId_0: Uint8Array, commitment_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  commitmentFromPayload(context: __compactRuntime.CircuitContext<PS>,
                        schemaId_0: Uint8Array,
                        holderBinding_0: Uint8Array,
                        nameHash_0: Uint8Array,
                        degree_0: Uint8Array,
                        dob_0: bigint,
                        cgpaTimes100_0: bigint,
                        issueDate_0: bigint,
                        expiryDate_0: bigint,
                        salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  leafFromCommitment(context: __compactRuntime.CircuitContext<PS>,
                     issuerId_0: Uint8Array,
                     commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerId_0: Uint8Array,
                 name_0: Uint8Array,
                 registeredAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setIssuerActive(context: __compactRuntime.CircuitContext<PS>,
                  issuerId_0: Uint8Array,
                  active_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  registerSchema(context: __compactRuntime.CircuitContext<PS>,
                 schemaId_0: Uint8Array,
                 schemaHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  anchorCredential(context: __compactRuntime.CircuitContext<PS>,
                   issuerId_0: Uint8Array,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   issuerId_0: Uint8Array,
                   commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateRevocationRoot(context: __compactRuntime.CircuitContext<PS>,
                       issuerId_0: Uint8Array,
                       root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateIssuanceRoot(context: __compactRuntime.CircuitContext<PS>,
                     issuerId_0: Uint8Array,
                     root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveHoldsCredential(context: __compactRuntime.CircuitContext<PS>,
                       issuerId_0: Uint8Array,
                       schemaId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveFieldEquals(context: __compactRuntime.CircuitContext<PS>,
                   issuerId_0: Uint8Array,
                   schemaId_0: Uint8Array,
                   expectedDegree_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  proveRange(context: __compactRuntime.CircuitContext<PS>,
             issuerId_0: Uint8Array,
             schemaId_0: Uint8Array,
             minCgpaTimes100_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  proveAgeOver(context: __compactRuntime.CircuitContext<PS>,
               issuerId_0: Uint8Array,
               schemaId_0: Uint8Array,
               minAge_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  proveNotExpired(context: __compactRuntime.CircuitContext<PS>,
                  issuerId_0: Uint8Array,
                  schemaId_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type Ledger = {
  issuers: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { verifyingKey: __compactRuntime.JubjubPoint,
                                 name: Uint8Array,
                                 registeredAt: bigint,
                                 active: boolean
                               };
    [Symbol.iterator](): Iterator<[Uint8Array, { verifyingKey: __compactRuntime.JubjubPoint,
  name: Uint8Array,
  registeredAt: bigint,
  active: boolean
}]>
  };
  schemaRegistry: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  issuedCommitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  revokedCredentials: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly issuanceRoot: Uint8Array;
  readonly revocationRoot: Uint8Array;
  readonly issuerCount: bigint;
  readonly verificationCount: bigint;
  readonly lastProofValid: boolean;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
