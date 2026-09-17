import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.19.0');

export var ClaimType;
(function (ClaimType) {
  ClaimType[ClaimType['HAS_CREDENTIAL'] = 0] = 'HAS_CREDENTIAL';
  ClaimType[ClaimType['FIELD_EQUALS'] = 1] = 'FIELD_EQUALS';
  ClaimType[ClaimType['RANGE_PROOF'] = 2] = 'RANGE_PROOF';
  ClaimType[ClaimType['AGE_OVER'] = 3] = 'AGE_OVER';
  ClaimType[ClaimType['NOT_EXPIRED'] = 4] = 'NOT_EXPIRED';
})(ClaimType || (ClaimType = {}));

const _descriptor_0 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_1 = __compactRuntime.CompactTypeBoolean;

const _descriptor_2 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

const _descriptor_3 = __compactRuntime.CompactTypeJubjubPoint;

const _descriptor_4 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

class _IssuerEntry_0 {
  alignment() {
    return _descriptor_3.alignment().concat(_descriptor_0.alignment().concat(_descriptor_4.alignment().concat(_descriptor_1.alignment())));
  }
  fromValue(value_0) {
    return {
      verifyingKey: _descriptor_3.fromValue(value_0),
      name: _descriptor_0.fromValue(value_0),
      registeredAt: _descriptor_4.fromValue(value_0),
      active: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_3.toValue(value_0.verifyingKey).concat(_descriptor_0.toValue(value_0.name).concat(_descriptor_4.toValue(value_0.registeredAt).concat(_descriptor_1.toValue(value_0.active))));
  }
}

const _descriptor_5 = new _IssuerEntry_0();

class _CredentialPayload_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_4.alignment().concat(_descriptor_2.alignment().concat(_descriptor_4.alignment().concat(_descriptor_4.alignment())))))));
  }
  fromValue(value_0) {
    return {
      schemaId: _descriptor_0.fromValue(value_0),
      holderBinding: _descriptor_0.fromValue(value_0),
      nameHash: _descriptor_0.fromValue(value_0),
      degree: _descriptor_0.fromValue(value_0),
      dob: _descriptor_4.fromValue(value_0),
      cgpaTimes100: _descriptor_2.fromValue(value_0),
      issueDate: _descriptor_4.fromValue(value_0),
      expiryDate: _descriptor_4.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.schemaId).concat(_descriptor_0.toValue(value_0.holderBinding).concat(_descriptor_0.toValue(value_0.nameHash).concat(_descriptor_0.toValue(value_0.degree).concat(_descriptor_4.toValue(value_0.dob).concat(_descriptor_2.toValue(value_0.cgpaTimes100).concat(_descriptor_4.toValue(value_0.issueDate).concat(_descriptor_4.toValue(value_0.expiryDate))))))));
  }
}

const _descriptor_6 = new _CredentialPayload_0();

const _descriptor_7 = __compactRuntime.CompactTypeField;

const _descriptor_8 = new __compactRuntime.CompactTypeVector(32, _descriptor_7);

const _descriptor_9 = __compactRuntime.CompactTypeField;

class _JubjubSchnorrSignature_0 {
  alignment() {
    return _descriptor_3.alignment().concat(_descriptor_7.alignment());
  }
  fromValue(value_0) {
    return {
      announcement: _descriptor_3.fromValue(value_0),
      response: _descriptor_7.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_3.toValue(value_0.announcement).concat(_descriptor_7.toValue(value_0.response));
  }
}

const _descriptor_10 = new _JubjubSchnorrSignature_0();

class _JubjubSchnorrHashInput_0 {
  alignment() {
    return _descriptor_7.alignment().concat(_descriptor_7.alignment().concat(_descriptor_7.alignment().concat(_descriptor_7.alignment().concat(_descriptor_8.alignment()))));
  }
  fromValue(value_0) {
    return {
      annX: _descriptor_7.fromValue(value_0),
      annY: _descriptor_7.fromValue(value_0),
      pkX: _descriptor_7.fromValue(value_0),
      pkY: _descriptor_7.fromValue(value_0),
      msg: _descriptor_8.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_7.toValue(value_0.annX).concat(_descriptor_7.toValue(value_0.annY).concat(_descriptor_7.toValue(value_0.pkX).concat(_descriptor_7.toValue(value_0.pkY).concat(_descriptor_8.toValue(value_0.msg)))));
  }
}

const _descriptor_11 = new _JubjubSchnorrHashInput_0();

const _descriptor_12 = new __compactRuntime.CompactTypeVector(3, _descriptor_0);

class _Either_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_1.fromValue(value_0),
      left: _descriptor_0.fromValue(value_0),
      right: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.is_left).concat(_descriptor_0.toValue(value_0.left).concat(_descriptor_0.toValue(value_0.right)));
  }
}

const _descriptor_13 = new _Either_0();

const _descriptor_14 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_0.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.bytes);
  }
}

const _descriptor_15 = new _ContractAddress_0();

const _descriptor_16 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

const _descriptor_17 = new __compactRuntime.CompactTypeUnsignedInteger(4294967295n, 4);

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.issuerSigningKey) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named issuerSigningKey');
    }
    if (typeof(witnesses_0.credentialSignature) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named credentialSignature');
    }
    if (typeof(witnesses_0.credentialPayload) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named credentialPayload');
    }
    if (typeof(witnesses_0.credentialSalt) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named credentialSalt');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      async commitmentFromPayload(context, ...args_1) {
        return { result: pureCircuits.commitmentFromPayload(...args_1), context };
      },
      async leafFromCommitment(context, ...args_1) {
        return { result: pureCircuits.leafFromCommitment(...args_1), context };
      },
      registerIssuer: async (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`registerIssuer: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const name_0 = args_1[2];
        const registeredAt_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('registerIssuer',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 196 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('registerIssuer',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 196 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(name_0.buffer instanceof ArrayBuffer && name_0.BYTES_PER_ELEMENT === 1 && name_0.length === 32)) {
          __compactRuntime.typeError('registerIssuer',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 196 char 1',
                                     'Bytes<32>',
                                     name_0)
        }
        if (!(typeof(registeredAt_0) === 'bigint' && registeredAt_0 >= 0n && registeredAt_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('registerIssuer',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'credential-registry.compact line 196 char 1',
                                     'Uint<0..18446744073709551616>',
                                     registeredAt_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_0.toValue(name_0).concat(_descriptor_4.toValue(registeredAt_0))),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_4.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._registerIssuer_0(context,
                                                      partialProofData,
                                                      issuerId_0,
                                                      name_0,
                                                      registeredAt_0);
        partialProofData.output = { value: [], alignment: [] };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      setIssuerActive: async (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`setIssuerActive: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const active_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('setIssuerActive',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 209 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('setIssuerActive',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 209 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(typeof(active_0) === 'boolean')) {
          __compactRuntime.typeError('setIssuerActive',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 209 char 1',
                                     'Boolean',
                                     active_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_1.toValue(active_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_1.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._setIssuerActive_0(context,
                                                       partialProofData,
                                                       issuerId_0,
                                                       active_0);
        partialProofData.output = { value: [], alignment: [] };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      registerSchema: async (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`registerSchema: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const schemaId_0 = args_1[1];
        const schemaHash_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('registerSchema',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 220 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(schemaId_0.buffer instanceof ArrayBuffer && schemaId_0.BYTES_PER_ELEMENT === 1 && schemaId_0.length === 32)) {
          __compactRuntime.typeError('registerSchema',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 220 char 1',
                                     'Bytes<32>',
                                     schemaId_0)
        }
        if (!(schemaHash_0.buffer instanceof ArrayBuffer && schemaHash_0.BYTES_PER_ELEMENT === 1 && schemaHash_0.length === 32)) {
          __compactRuntime.typeError('registerSchema',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 220 char 1',
                                     'Bytes<32>',
                                     schemaHash_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(schemaId_0).concat(_descriptor_0.toValue(schemaHash_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._registerSchema_0(context,
                                                      partialProofData,
                                                      schemaId_0,
                                                      schemaHash_0);
        partialProofData.output = { value: [], alignment: [] };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      anchorCredential: async (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`anchorCredential: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const commitment_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('anchorCredential',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 229 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('anchorCredential',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 229 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(commitment_0.buffer instanceof ArrayBuffer && commitment_0.BYTES_PER_ELEMENT === 1 && commitment_0.length === 32)) {
          __compactRuntime.typeError('anchorCredential',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 229 char 1',
                                     'Bytes<32>',
                                     commitment_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_0.toValue(commitment_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._anchorCredential_0(context,
                                                        partialProofData,
                                                        issuerId_0,
                                                        commitment_0);
        partialProofData.output = { value: _descriptor_0.toValue(result_0), alignment: _descriptor_0.alignment() };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      revokeCredential: async (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`revokeCredential: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const commitment_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('revokeCredential',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 238 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('revokeCredential',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 238 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(commitment_0.buffer instanceof ArrayBuffer && commitment_0.BYTES_PER_ELEMENT === 1 && commitment_0.length === 32)) {
          __compactRuntime.typeError('revokeCredential',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 238 char 1',
                                     'Bytes<32>',
                                     commitment_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_0.toValue(commitment_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._revokeCredential_0(context,
                                                        partialProofData,
                                                        issuerId_0,
                                                        commitment_0);
        partialProofData.output = { value: [], alignment: [] };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      updateRevocationRoot: async (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`updateRevocationRoot: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const root_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('updateRevocationRoot',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 247 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('updateRevocationRoot',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 247 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(root_0.buffer instanceof ArrayBuffer && root_0.BYTES_PER_ELEMENT === 1 && root_0.length === 32)) {
          __compactRuntime.typeError('updateRevocationRoot',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 247 char 1',
                                     'Bytes<32>',
                                     root_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_0.toValue(root_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._updateRevocationRoot_0(context,
                                                            partialProofData,
                                                            issuerId_0,
                                                            root_0);
        partialProofData.output = { value: [], alignment: [] };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      updateIssuanceRoot: async (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`updateIssuanceRoot: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const root_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('updateIssuanceRoot',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 252 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('updateIssuanceRoot',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 252 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(root_0.buffer instanceof ArrayBuffer && root_0.BYTES_PER_ELEMENT === 1 && root_0.length === 32)) {
          __compactRuntime.typeError('updateIssuanceRoot',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 252 char 1',
                                     'Bytes<32>',
                                     root_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_0.toValue(root_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._updateIssuanceRoot_0(context,
                                                          partialProofData,
                                                          issuerId_0,
                                                          root_0);
        partialProofData.output = { value: [], alignment: [] };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      proveHoldsCredential: async (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`proveHoldsCredential: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const schemaId_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('proveHoldsCredential',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 268 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('proveHoldsCredential',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 268 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(schemaId_0.buffer instanceof ArrayBuffer && schemaId_0.BYTES_PER_ELEMENT === 1 && schemaId_0.length === 32)) {
          __compactRuntime.typeError('proveHoldsCredential',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 268 char 1',
                                     'Bytes<32>',
                                     schemaId_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_0.toValue(schemaId_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._proveHoldsCredential_0(context,
                                                            partialProofData,
                                                            issuerId_0,
                                                            schemaId_0);
        partialProofData.output = { value: _descriptor_1.toValue(result_0), alignment: _descriptor_1.alignment() };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      proveFieldEquals: async (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`proveFieldEquals: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const schemaId_0 = args_1[2];
        const expectedDegree_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('proveFieldEquals',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 274 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('proveFieldEquals',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 274 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(schemaId_0.buffer instanceof ArrayBuffer && schemaId_0.BYTES_PER_ELEMENT === 1 && schemaId_0.length === 32)) {
          __compactRuntime.typeError('proveFieldEquals',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 274 char 1',
                                     'Bytes<32>',
                                     schemaId_0)
        }
        if (!(expectedDegree_0.buffer instanceof ArrayBuffer && expectedDegree_0.BYTES_PER_ELEMENT === 1 && expectedDegree_0.length === 32)) {
          __compactRuntime.typeError('proveFieldEquals',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'credential-registry.compact line 274 char 1',
                                     'Bytes<32>',
                                     expectedDegree_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_0.toValue(schemaId_0).concat(_descriptor_0.toValue(expectedDegree_0))),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._proveFieldEquals_0(context,
                                                        partialProofData,
                                                        issuerId_0,
                                                        schemaId_0,
                                                        expectedDegree_0);
        partialProofData.output = { value: _descriptor_1.toValue(result_0), alignment: _descriptor_1.alignment() };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      proveRange: async (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`proveRange: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const schemaId_0 = args_1[2];
        const minCgpaTimes100_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('proveRange',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 281 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('proveRange',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 281 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(schemaId_0.buffer instanceof ArrayBuffer && schemaId_0.BYTES_PER_ELEMENT === 1 && schemaId_0.length === 32)) {
          __compactRuntime.typeError('proveRange',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 281 char 1',
                                     'Bytes<32>',
                                     schemaId_0)
        }
        if (!(typeof(minCgpaTimes100_0) === 'bigint' && minCgpaTimes100_0 >= 0n && minCgpaTimes100_0 <= 65535n)) {
          __compactRuntime.typeError('proveRange',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'credential-registry.compact line 281 char 1',
                                     'Uint<0..65536>',
                                     minCgpaTimes100_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_0.toValue(schemaId_0).concat(_descriptor_2.toValue(minCgpaTimes100_0))),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_2.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._proveRange_0(context,
                                                  partialProofData,
                                                  issuerId_0,
                                                  schemaId_0,
                                                  minCgpaTimes100_0);
        partialProofData.output = { value: _descriptor_1.toValue(result_0), alignment: _descriptor_1.alignment() };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      proveAgeOver: async (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`proveAgeOver: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const schemaId_0 = args_1[2];
        const minAge_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('proveAgeOver',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 288 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('proveAgeOver',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 288 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(schemaId_0.buffer instanceof ArrayBuffer && schemaId_0.BYTES_PER_ELEMENT === 1 && schemaId_0.length === 32)) {
          __compactRuntime.typeError('proveAgeOver',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 288 char 1',
                                     'Bytes<32>',
                                     schemaId_0)
        }
        if (!(typeof(minAge_0) === 'bigint' && minAge_0 >= 0n && minAge_0 <= 65535n)) {
          __compactRuntime.typeError('proveAgeOver',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'credential-registry.compact line 288 char 1',
                                     'Uint<0..65536>',
                                     minAge_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_0.toValue(schemaId_0).concat(_descriptor_2.toValue(minAge_0))),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_2.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._proveAgeOver_0(context,
                                                    partialProofData,
                                                    issuerId_0,
                                                    schemaId_0,
                                                    minAge_0);
        partialProofData.output = { value: _descriptor_1.toValue(result_0), alignment: _descriptor_1.alignment() };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      },
      proveNotExpired: async (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`proveNotExpired: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        const schemaId_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('proveNotExpired',
                                     'argument 1 (as invoked from Typescript)',
                                     'credential-registry.compact line 296 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('proveNotExpired',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'credential-registry.compact line 296 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        if (!(schemaId_0.buffer instanceof ArrayBuffer && schemaId_0.BYTES_PER_ELEMENT === 1 && schemaId_0.length === 32)) {
          __compactRuntime.typeError('proveNotExpired',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'credential-registry.compact line 296 char 1',
                                     'Bytes<32>',
                                     schemaId_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(issuerId_0).concat(_descriptor_0.toValue(schemaId_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._proveNotExpired_0(context,
                                                       partialProofData,
                                                       issuerId_0,
                                                       schemaId_0);
        partialProofData.output = { value: _descriptor_1.toValue(result_0), alignment: _descriptor_1.alignment() };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      }
    };
    this.impureCircuits = {
      registerIssuer: this.circuits.registerIssuer,
      setIssuerActive: this.circuits.setIssuerActive,
      registerSchema: this.circuits.registerSchema,
      anchorCredential: this.circuits.anchorCredential,
      revokeCredential: this.circuits.revokeCredential,
      updateRevocationRoot: this.circuits.updateRevocationRoot,
      updateIssuanceRoot: this.circuits.updateIssuanceRoot,
      proveHoldsCredential: this.circuits.proveHoldsCredential,
      proveFieldEquals: this.circuits.proveFieldEquals,
      proveRange: this.circuits.proveRange,
      proveAgeOver: this.circuits.proveAgeOver,
      proveNotExpired: this.circuits.proveNotExpired
    };
    this.provableCircuits = {
      registerIssuer: this.circuits.registerIssuer,
      setIssuerActive: this.circuits.setIssuerActive,
      registerSchema: this.circuits.registerSchema,
      anchorCredential: this.circuits.anchorCredential,
      revokeCredential: this.circuits.revokeCredential,
      updateRevocationRoot: this.circuits.updateRevocationRoot,
      updateIssuanceRoot: this.circuits.updateIssuanceRoot,
      proveHoldsCredential: this.circuits.proveHoldsCredential,
      proveFieldEquals: this.circuits.proveFieldEquals,
      proveRange: this.circuits.proveRange,
      proveAgeOver: this.circuits.proveAgeOver,
      proveNotExpired: this.circuits.proveNotExpired
    };
  }
  async initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('registerIssuer', new __compactRuntime.ContractOperation());
    state_0.setOperation('setIssuerActive', new __compactRuntime.ContractOperation());
    state_0.setOperation('registerSchema', new __compactRuntime.ContractOperation());
    state_0.setOperation('anchorCredential', new __compactRuntime.ContractOperation());
    state_0.setOperation('revokeCredential', new __compactRuntime.ContractOperation());
    state_0.setOperation('updateRevocationRoot', new __compactRuntime.ContractOperation());
    state_0.setOperation('updateIssuanceRoot', new __compactRuntime.ContractOperation());
    state_0.setOperation('proveHoldsCredential', new __compactRuntime.ContractOperation());
    state_0.setOperation('proveFieldEquals', new __compactRuntime.ContractOperation());
    state_0.setOperation('proveRange', new __compactRuntime.ContractOperation());
    state_0.setOperation('proveAgeOver', new __compactRuntime.ContractOperation());
    state_0.setOperation('proveNotExpired', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext('constructor', __compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(0n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(1n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(2n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(3n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(4n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(5n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(6n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(7n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(8n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(false),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.callContext.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.callContext.currentPrivateState,
      currentZswapLocalState: context.callContext.currentZswapLocalState
    }
  }
  async _blockTimeLt_0(context, partialProofData, time_0) {
    return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                     partialProofData,
                                                                     [
                                                                      { dup: { n: 2 } },
                                                                      { idx: { cached: true,
                                                                               pushPath: false,
                                                                               path: [
                                                                                      { tag: 'value',
                                                                                        value: { value: _descriptor_16.toValue(2n),
                                                                                                 alignment: _descriptor_16.alignment() } }] } },
                                                                      { push: { storage: false,
                                                                                value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(time_0),
                                                                                                                             alignment: _descriptor_4.alignment() }).encode() } },
                                                                      'lt',
                                                                      { popeq: { cached: true,
                                                                                 result: undefined } }]).value);
  }
  async _blockTimeGte_0(context, partialProofData, time_0) {
    return !await this._blockTimeLt_0(context, partialProofData, time_0);
  }
  _jubjubSchnorrVerify_0(msg_0, signature_0, pk_0) {
    const __compact_pattern_tmp1_0 = signature_0;
    const announcement_0 = __compact_pattern_tmp1_0.announcement;
    const response_0 = __compact_pattern_tmp1_0.response;
    const cNative_0 = this._transientHash_0({ annX:
                                                this._jubjubPointX_0(announcement_0),
                                              annY:
                                                this._jubjubPointY_0(announcement_0),
                                              pkX: this._jubjubPointX_0(pk_0),
                                              pkY: this._jubjubPointY_0(pk_0),
                                              msg: msg_0 });
    const c_0 = cNative_0;
    const lhs_0 = this._ecMulGenerator_0(response_0);
    const rhs_0 = this._ecAdd_0(announcement_0, this._ecMul_0(pk_0, c_0));
    return this._equal_0(lhs_0, rhs_0);
  }
  _transientHash_0(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_11, value_0);
    return result_0;
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_12, value_0);
    return result_0;
  }
  _persistentCommit_0(value_0, rand_0) {
    const result_0 = __compactRuntime.persistentCommit(_descriptor_6,
                                                       value_0,
                                                       rand_0);
    return result_0;
  }
  _jubjubPointX_0(pt_0) {
    const result_0 = __compactRuntime.jubjubPointX(pt_0);
    return result_0;
  }
  _jubjubPointY_0(pt_0) {
    const result_0 = __compactRuntime.jubjubPointY(pt_0);
    return result_0;
  }
  _ecAdd_0(a_0, b_0) {
    const result_0 = __compactRuntime.ecAdd(a_0, b_0);
    return result_0;
  }
  _ecMul_0(a_0, b_0) {
    const result_0 = __compactRuntime.ecMul(a_0, b_0);
    return result_0;
  }
  _ecMulGenerator_0(b_0) {
    const result_0 = __compactRuntime.ecMulGenerator(b_0);
    return result_0;
  }
  _secondsPerYear_0() { return 31557600n; }
  _tagCredential_0() {
    return new Uint8Array([118, 101, 114, 105, 115, 104, 105, 101, 108, 100, 58, 99, 114, 101, 100, 101, 110, 116, 105, 97, 108, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0]);
  }
  _issuerSigningKey_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.callContext.currentQueryContext.state), context.callContext.currentPrivateState, context.callContext.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.issuerSigningKey(witnessContext_0);
    context.callContext.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_JUBJUB_SCALAR)) {
      __compactRuntime.typeError('issuerSigningKey',
                                 'return value',
                                 'credential-registry.compact line 87 char 1',
                                 'JubjubScalar',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_9.toValue(result_0),
      alignment: _descriptor_9.alignment()
    });
    return result_0;
  }
  _credentialSignature_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.callContext.currentQueryContext.state), context.callContext.currentPrivateState, context.callContext.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.credentialSignature(witnessContext_0);
    context.callContext.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'object' && typeof(result_0.announcement.x) === 'bigint' && typeof(result_0.announcement.y) === 'bigint' && typeof(result_0.response) === 'bigint' && result_0.response >= 0 && result_0.response <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('credentialSignature',
                                 'return value',
                                 'credential-registry.compact line 91 char 1',
                                 'struct JubjubSchnorrSignature<announcement: JubjubPoint, response: Field>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_10.toValue(result_0),
      alignment: _descriptor_10.alignment()
    });
    return result_0;
  }
  _credentialPayload_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.callContext.currentQueryContext.state), context.callContext.currentPrivateState, context.callContext.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.credentialPayload(witnessContext_0);
    context.callContext.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'object' && result_0.schemaId.buffer instanceof ArrayBuffer && result_0.schemaId.BYTES_PER_ELEMENT === 1 && result_0.schemaId.length === 32 && result_0.holderBinding.buffer instanceof ArrayBuffer && result_0.holderBinding.BYTES_PER_ELEMENT === 1 && result_0.holderBinding.length === 32 && result_0.nameHash.buffer instanceof ArrayBuffer && result_0.nameHash.BYTES_PER_ELEMENT === 1 && result_0.nameHash.length === 32 && result_0.degree.buffer instanceof ArrayBuffer && result_0.degree.BYTES_PER_ELEMENT === 1 && result_0.degree.length === 32 && typeof(result_0.dob) === 'bigint' && result_0.dob >= 0n && result_0.dob <= 18446744073709551615n && typeof(result_0.cgpaTimes100) === 'bigint' && result_0.cgpaTimes100 >= 0n && result_0.cgpaTimes100 <= 65535n && typeof(result_0.issueDate) === 'bigint' && result_0.issueDate >= 0n && result_0.issueDate <= 18446744073709551615n && typeof(result_0.expiryDate) === 'bigint' && result_0.expiryDate >= 0n && result_0.expiryDate <= 18446744073709551615n)) {
      __compactRuntime.typeError('credentialPayload',
                                 'return value',
                                 'credential-registry.compact line 92 char 1',
                                 'struct CredentialPayload<schemaId: Bytes<32>, holderBinding: Bytes<32>, nameHash: Bytes<32>, degree: Bytes<32>, dob: Uint<0..18446744073709551616>, cgpaTimes100: Uint<0..65536>, issueDate: Uint<0..18446744073709551616>, expiryDate: Uint<0..18446744073709551616>>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_6.toValue(result_0),
      alignment: _descriptor_6.alignment()
    });
    return result_0;
  }
  _credentialSalt_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.callContext.currentQueryContext.state), context.callContext.currentPrivateState, context.callContext.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.credentialSalt(witnessContext_0);
    context.callContext.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('credentialSalt',
                                 'return value',
                                 'credential-registry.compact line 93 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_0.toValue(result_0),
      alignment: _descriptor_0.alignment()
    });
    return result_0;
  }
  _computeCommitment_0(p_0, salt_0) {
    return this._persistentCommit_0(p_0, salt_0);
  }
  _credentialLeaf_0(issuerId_0, commitment_0) {
    return this._persistentHash_0([this._tagCredential_0(),
                                   issuerId_0,
                                   commitment_0]);
  }
  _commitmentMessage_0(commitment_0) {
    return Array.from(commitment_0, BigInt);
  }
  _commitmentFromPayload_0(schemaId_0,
                           holderBinding_0,
                           nameHash_0,
                           degree_0,
                           dob_0,
                           cgpaTimes100_0,
                           issueDate_0,
                           expiryDate_0,
                           salt_0)
  {
    const payload_0 = { schemaId: schemaId_0,
                        holderBinding: holderBinding_0,
                        nameHash: nameHash_0,
                        degree: degree_0,
                        dob: dob_0,
                        cgpaTimes100: cgpaTimes100_0,
                        issueDate: issueDate_0,
                        expiryDate: expiryDate_0 };
    return this._persistentCommit_0(payload_0, salt_0);
  }
  _leafFromCommitment_0(issuerId_0, commitment_0) {
    return this._credentialLeaf_0(issuerId_0, commitment_0);
  }
  async _requireActiveIssuer_0(context, partialProofData, issuerId_0) {
    __compactRuntime.assert(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_16.toValue(0n),
                                                                                                                  alignment: _descriptor_16.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(issuerId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Unknown issuer');
    const issuer_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                               partialProofData,
                                                                               [
                                                                                { dup: { n: 0 } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_16.toValue(0n),
                                                                                                           alignment: _descriptor_16.alignment() } }] } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_0.toValue(issuerId_0),
                                                                                                           alignment: _descriptor_0.alignment() } }] } },
                                                                                { popeq: { cached: false,
                                                                                           result: undefined } }]).value);
    __compactRuntime.assert(issuer_0.active, 'Issuer inactive');
    return issuer_0;
  }
  async _requireIssuerAuthority_0(context, partialProofData, issuerId_0) {
    const issuer_0 = await this._requireActiveIssuer_0(context,
                                                       partialProofData,
                                                       issuerId_0);
    __compactRuntime.assert(this._equal_1(this._ecMulGenerator_0(this._issuerSigningKey_0(context,
                                                                                          partialProofData)),
                                          issuer_0.verifyingKey),
                            'Caller is not the registered issuer');
    return issuer_0;
  }
  async _verifyCredential_0(context, partialProofData, issuerId_0, schemaId_0) {
    const payload_0 = this._credentialPayload_0(context, partialProofData);
    const commitment_0 = this._computeCommitment_0(payload_0,
                                                   this._credentialSalt_0(context,
                                                                          partialProofData));
    const leaf_0 = this._credentialLeaf_0(issuerId_0, commitment_0);
    const issuer_0 = await this._requireActiveIssuer_0(context,
                                                       partialProofData,
                                                       issuerId_0);
    __compactRuntime.assert(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_16.toValue(1n),
                                                                                                                  alignment: _descriptor_16.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(schemaId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Unknown schema');
    __compactRuntime.assert(this._equal_2(payload_0.schemaId, schemaId_0),
                            'Credential schema mismatch');
    __compactRuntime.assert(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_16.toValue(2n),
                                                                                                                  alignment: _descriptor_16.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(leaf_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Credential was never issued by this issuer');
    __compactRuntime.assert(this._equal_3(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_16.toValue(2n),
                                                                                                                                alignment: _descriptor_16.alignment() } }] } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_0.toValue(leaf_0),
                                                                                                                                alignment: _descriptor_0.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value),
                                          issuerId_0),
                            'Issuer does not match anchor');
    __compactRuntime.assert(!_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_16.toValue(3n),
                                                                                                                   alignment: _descriptor_16.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(commitment_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Credential has been revoked');
    __compactRuntime.assert(this._jubjubSchnorrVerify_0(this._commitmentMessage_0(commitment_0),
                                                        this._credentialSignature_0(context,
                                                                                    partialProofData),
                                                        issuer_0.verifyingKey),
                            'Credential signature is not from the registered issuer');
    return payload_0;
  }
  async _registerIssuer_0(context,
                          partialProofData,
                          issuerId_0,
                          name_0,
                          registeredAt_0)
  {
    __compactRuntime.assert(!_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_16.toValue(0n),
                                                                                                                   alignment: _descriptor_16.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(issuerId_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Issuer already registered');
    const verifyingKey_0 = this._ecMulGenerator_0(this._issuerSigningKey_0(context,
                                                                           partialProofData));
    const entry_0 = { verifyingKey: verifyingKey_0,
                      name: name_0,
                      registeredAt: registeredAt_0,
                      active: true };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_16.toValue(0n),
                                                                  alignment: _descriptor_16.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(issuerId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(entry_0),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_16.toValue(6n),
                                                                  alignment: _descriptor_16.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_2.toValue(tmp_0),
                                                                alignment: _descriptor_2.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  async _setIssuerActive_0(context, partialProofData, issuerId_0, active_0) {
    const issuer_0 = await this._requireIssuerAuthority_0(context,
                                                          partialProofData,
                                                          issuerId_0);
    const updated_0 = { verifyingKey: issuer_0.verifyingKey,
                        name: issuer_0.name,
                        registeredAt: issuer_0.registeredAt,
                        active: active_0 };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_16.toValue(0n),
                                                                  alignment: _descriptor_16.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(issuerId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(updated_0),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  async _registerSchema_0(context, partialProofData, schemaId_0, schemaHash_0) {
    __compactRuntime.assert(!_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_16.toValue(1n),
                                                                                                                   alignment: _descriptor_16.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(schemaId_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Schema already registered');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_16.toValue(1n),
                                                                  alignment: _descriptor_16.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(schemaId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(schemaHash_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  async _anchorCredential_0(context, partialProofData, issuerId_0, commitment_0)
  {
    await this._requireIssuerAuthority_0(context, partialProofData, issuerId_0);
    const leaf_0 = this._credentialLeaf_0(issuerId_0, commitment_0);
    __compactRuntime.assert(!_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_16.toValue(2n),
                                                                                                                   alignment: _descriptor_16.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(leaf_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Credential already anchored');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_16.toValue(2n),
                                                                  alignment: _descriptor_16.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(leaf_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(issuerId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(4n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(leaf_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return leaf_0;
  }
  async _revokeCredential_0(context, partialProofData, issuerId_0, commitment_0)
  {
    await this._requireIssuerAuthority_0(context, partialProofData, issuerId_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_16.toValue(3n),
                                                                  alignment: _descriptor_16.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(commitment_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(5n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(commitment_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  async _updateRevocationRoot_0(context, partialProofData, issuerId_0, root_0) {
    await this._requireIssuerAuthority_0(context, partialProofData, issuerId_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(5n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(root_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  async _updateIssuanceRoot_0(context, partialProofData, issuerId_0, root_0) {
    await this._requireIssuerAuthority_0(context, partialProofData, issuerId_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(4n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(root_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  async _publishValid_0(context, partialProofData) {
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_16.toValue(8n),
                                                                                              alignment: _descriptor_16.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(true),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_16.toValue(7n),
                                                                  alignment: _descriptor_16.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_2.toValue(tmp_0),
                                                                alignment: _descriptor_2.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return true;
  }
  async _proveHoldsCredential_0(context,
                                partialProofData,
                                issuerId_0,
                                schemaId_0)
  {
    const _payload_0 = await this._verifyCredential_0(context,
                                                      partialProofData,
                                                      issuerId_0,
                                                      schemaId_0);
    return await this._publishValid_0(context, partialProofData);
  }
  async _proveFieldEquals_0(context,
                            partialProofData,
                            issuerId_0,
                            schemaId_0,
                            expectedDegree_0)
  {
    const payload_0 = await this._verifyCredential_0(context,
                                                     partialProofData,
                                                     issuerId_0,
                                                     schemaId_0);
    __compactRuntime.assert(this._equal_4(payload_0.degree, expectedDegree_0),
                            'Field does not match');
    return await this._publishValid_0(context, partialProofData);
  }
  async _proveRange_0(context,
                      partialProofData,
                      issuerId_0,
                      schemaId_0,
                      minCgpaTimes100_0)
  {
    const payload_0 = await this._verifyCredential_0(context,
                                                     partialProofData,
                                                     issuerId_0,
                                                     schemaId_0);
    let t_0;
    __compactRuntime.assert((t_0 = payload_0.cgpaTimes100,
                             t_0 >= minCgpaTimes100_0),
                            'Value below threshold');
    return await this._publishValid_0(context, partialProofData);
  }
  async _proveAgeOver_0(context,
                        partialProofData,
                        issuerId_0,
                        schemaId_0,
                        minAge_0)
  {
    const payload_0 = await this._verifyCredential_0(context,
                                                     partialProofData,
                                                     issuerId_0,
                                                     schemaId_0);
    const threshold_0 = ((t1) => {
                          if (t1 > 18446744073709551615n) {
                            throw new __compactRuntime.CompactError('credential-registry.compact line 290 char 21: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                          }
                          return t1;
                        })(payload_0.dob + minAge_0 * this._secondsPerYear_0());
    __compactRuntime.assert(await this._blockTimeGte_0(context,
                                                       partialProofData,
                                                       threshold_0),
                            'Holder is under the minimum age');
    return await this._publishValid_0(context, partialProofData);
  }
  async _proveNotExpired_0(context, partialProofData, issuerId_0, schemaId_0) {
    const payload_0 = await this._verifyCredential_0(context,
                                                     partialProofData,
                                                     issuerId_0,
                                                     schemaId_0);
    __compactRuntime.assert(await this._blockTimeLt_0(context,
                                                      partialProofData,
                                                      payload_0.expiryDate),
                            'Credential has expired');
    return await this._publishValid_0(context, partialProofData);
  }
  _equal_0(x0, y0) {
    if (x0.x != y0.x || x0.y != y0.y) {
      return false;
    }
    return true;
  }
  _equal_1(x0, y0) {
    if (x0.x != y0.x || x0.y != y0.y) {
      return false;
    }
    return true;
  }
  _equal_2(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_3(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_4(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    callContext: { currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()), currentGasCost: __compactRuntime.emptyRunningCost() },
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    issuers: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(0n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                                                                 alignment: _descriptor_4.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(0n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'credential-registry.compact line 67 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(0n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(key_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'credential-registry.compact line 67 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(0n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_0.toValue(key_0),
                                                                                                     alignment: _descriptor_0.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[0];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_5.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    schemaRegistry: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(1n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                                                                 alignment: _descriptor_4.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(1n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'credential-registry.compact line 68 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(1n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(key_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'credential-registry.compact line 68 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(1n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_0.toValue(key_0),
                                                                                                     alignment: _descriptor_0.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_0.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    issuedCommitments: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(2n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                                                                 alignment: _descriptor_4.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(2n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'credential-registry.compact line 70 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(2n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(key_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'credential-registry.compact line 70 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(2n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_0.toValue(key_0),
                                                                                                     alignment: _descriptor_0.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[2];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_0.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    revokedCredentials: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(3n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(0n),
                                                                                                                                 alignment: _descriptor_4.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(3n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'credential-registry.compact line 72 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_16.toValue(3n),
                                                                                                     alignment: _descriptor_16.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[3];
        return self_0.asMap().keys().map((elem) => _descriptor_0.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    get issuanceRoot() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_16.toValue(4n),
                                                                                                   alignment: _descriptor_16.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get revocationRoot() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_16.toValue(5n),
                                                                                                   alignment: _descriptor_16.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get issuerCount() {
      return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_16.toValue(6n),
                                                                                                   alignment: _descriptor_16.alignment() } }] } },
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    },
    get verificationCount() {
      return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_16.toValue(7n),
                                                                                                   alignment: _descriptor_16.alignment() } }] } },
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    },
    get lastProofValid() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_16.toValue(8n),
                                                                                                   alignment: _descriptor_16.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    }
  };
}
const _emptyContext = {
  callContext: { currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress()), currentGasCost: __compactRuntime.emptyRunningCost() }
};
const _dummyContract = new Contract({
  issuerSigningKey: (...args) => undefined,
  credentialSignature: (...args) => undefined,
  credentialPayload: (...args) => undefined,
  credentialSalt: (...args) => undefined
});
export const pureCircuits = {
  commitmentFromPayload: (...args_0) => {
    if (args_0.length !== 9) {
      throw new __compactRuntime.CompactError(`commitmentFromPayload: expected 9 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const schemaId_0 = args_0[0];
    const holderBinding_0 = args_0[1];
    const nameHash_0 = args_0[2];
    const degree_0 = args_0[3];
    const dob_0 = args_0[4];
    const cgpaTimes100_0 = args_0[5];
    const issueDate_0 = args_0[6];
    const expiryDate_0 = args_0[7];
    const salt_0 = args_0[8];
    if (!(schemaId_0.buffer instanceof ArrayBuffer && schemaId_0.BYTES_PER_ELEMENT === 1 && schemaId_0.length === 32)) {
      __compactRuntime.typeError('commitmentFromPayload',
                                 'argument 1',
                                 'credential-registry.compact line 120 char 1',
                                 'Bytes<32>',
                                 schemaId_0)
    }
    if (!(holderBinding_0.buffer instanceof ArrayBuffer && holderBinding_0.BYTES_PER_ELEMENT === 1 && holderBinding_0.length === 32)) {
      __compactRuntime.typeError('commitmentFromPayload',
                                 'argument 2',
                                 'credential-registry.compact line 120 char 1',
                                 'Bytes<32>',
                                 holderBinding_0)
    }
    if (!(nameHash_0.buffer instanceof ArrayBuffer && nameHash_0.BYTES_PER_ELEMENT === 1 && nameHash_0.length === 32)) {
      __compactRuntime.typeError('commitmentFromPayload',
                                 'argument 3',
                                 'credential-registry.compact line 120 char 1',
                                 'Bytes<32>',
                                 nameHash_0)
    }
    if (!(degree_0.buffer instanceof ArrayBuffer && degree_0.BYTES_PER_ELEMENT === 1 && degree_0.length === 32)) {
      __compactRuntime.typeError('commitmentFromPayload',
                                 'argument 4',
                                 'credential-registry.compact line 120 char 1',
                                 'Bytes<32>',
                                 degree_0)
    }
    if (!(typeof(dob_0) === 'bigint' && dob_0 >= 0n && dob_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('commitmentFromPayload',
                                 'argument 5',
                                 'credential-registry.compact line 120 char 1',
                                 'Uint<0..18446744073709551616>',
                                 dob_0)
    }
    if (!(typeof(cgpaTimes100_0) === 'bigint' && cgpaTimes100_0 >= 0n && cgpaTimes100_0 <= 65535n)) {
      __compactRuntime.typeError('commitmentFromPayload',
                                 'argument 6',
                                 'credential-registry.compact line 120 char 1',
                                 'Uint<0..65536>',
                                 cgpaTimes100_0)
    }
    if (!(typeof(issueDate_0) === 'bigint' && issueDate_0 >= 0n && issueDate_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('commitmentFromPayload',
                                 'argument 7',
                                 'credential-registry.compact line 120 char 1',
                                 'Uint<0..18446744073709551616>',
                                 issueDate_0)
    }
    if (!(typeof(expiryDate_0) === 'bigint' && expiryDate_0 >= 0n && expiryDate_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('commitmentFromPayload',
                                 'argument 8',
                                 'credential-registry.compact line 120 char 1',
                                 'Uint<0..18446744073709551616>',
                                 expiryDate_0)
    }
    if (!(salt_0.buffer instanceof ArrayBuffer && salt_0.BYTES_PER_ELEMENT === 1 && salt_0.length === 32)) {
      __compactRuntime.typeError('commitmentFromPayload',
                                 'argument 9',
                                 'credential-registry.compact line 120 char 1',
                                 'Bytes<32>',
                                 salt_0)
    }
    return _dummyContract._commitmentFromPayload_0(schemaId_0,
                                                   holderBinding_0,
                                                   nameHash_0,
                                                   degree_0,
                                                   dob_0,
                                                   cgpaTimes100_0,
                                                   issueDate_0,
                                                   expiryDate_0,
                                                   salt_0);
  },
  leafFromCommitment: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`leafFromCommitment: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const issuerId_0 = args_0[0];
    const commitment_0 = args_0[1];
    if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
      __compactRuntime.typeError('leafFromCommitment',
                                 'argument 1',
                                 'credential-registry.compact line 144 char 1',
                                 'Bytes<32>',
                                 issuerId_0)
    }
    if (!(commitment_0.buffer instanceof ArrayBuffer && commitment_0.BYTES_PER_ELEMENT === 1 && commitment_0.length === 32)) {
      __compactRuntime.typeError('leafFromCommitment',
                                 'argument 2',
                                 'credential-registry.compact line 144 char 1',
                                 'Bytes<32>',
                                 commitment_0)
    }
    return _dummyContract._leafFromCommitment_0(issuerId_0, commitment_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
export const expectedVk = {
  'anchorCredential': '3826399e138c74e86c778f39dc224b329a12e80c4636b49c3c0f006d235172ae',
  'proveAgeOver': 'fa5ebbb1d615e7ecaa98bfb05d26f88ede5e2aff5f0d343aed11640ee4e10e9d',
  'proveFieldEquals': '1da466240e5ca28ec6eb0fd81c4d0318a24293f7593c3fb9e68198577e035072',
  'proveHoldsCredential': 'b7f11f940f3fe133f8d795800857e7ea12e61ec1fd82108e025dd166549d57ee',
  'proveNotExpired': '4227b76b10ef5e1c46a224900884a4208b145b716b2fcabf4cd0e4ce9f3fcd25',
  'proveRange': '32b439ac2afb7afe27dc9a3255c22bf639197430e064e922894ad3ea07ecb55c',
  'registerIssuer': 'eee959992f0f889976c648742277ff40efb17a66e5c8684a0ed61ccbbbd6cccd',
  'registerSchema': '753be0a663da8565e170a70dfa3b2d1299a9cadbd651a954ad00a3c6229f7d73',
  'revokeCredential': '984a266fe9e8eee94a9ae095c7f48c62a58a08ba9fe425a3764ac3f7478b4446',
  'setIssuerActive': 'a34e4aa62257fb4ca1d69b4cf832a4f772611dba65d18de48b053632a3ea064b',
  'updateIssuanceRoot': 'dac329c6fda5aa36ebd785bd622360ce279520438bf3716f79fecaee3bb33ed2',
  'updateRevocationRoot': 'd90dc838d09e5c3f9e980feadf3402d0784494c8d7e23d7fb5f40f72c41525ef',
};

//# sourceMappingURL=index.js.map
