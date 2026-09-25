import { describe, expect, it } from 'vitest';
import {
  isAlreadyProvisionedError,
  readableReason,
} from '../packages/web/src/lib/midnight/alreadyOnChain';

describe('isAlreadyProvisionedError (on-chain idempotency classifier)', () => {
  it('recognises the compact "Issuer already registered" assert', () => {
    const err = new Error('failed assert: Issuer already registered');
    expect(isAlreadyProvisionedError(err)).toBe(true);
  });

  it('recognises the assertion nested inside the circuit wrapper', () => {
    const inner = new Error('failed assert: Issuer already registered');
    const wrapper = new Error("Error executing circuit 'registerIssuer'", { cause: inner });
    expect(isAlreadyProvisionedError(wrapper)).toBe(true);
  });

  it('recognises the "Credential already anchored" assert', () => {
    expect(isAlreadyProvisionedError(new Error('failed assert: Credential already anchored'))).toBe(true);
  });

  it('rejects genuine circuit failures', () => {
    expect(isAlreadyProvisionedError(new Error('failed assert: Issuer must exist'))).toBe(false);
    expect(isAlreadyProvisionedError(new Error('failed assert: confirmed leaf mismatches'))).toBe(false);
    expect(isAlreadyProvisionedError(new Error('Failed to fetch ledger context'))).toBe(false);
    expect(isAlreadyProvisionedError(new Error('Network ID has not been configured'))).toBe(false);
    expect(isAlreadyProvisionedError(null)).toBe(false);
    expect(isAlreadyProvisionedError('plain string')).toBe(false);
  });

  it('reads the deepest message from the cause chain', () => {
    const deep = new Error('failed assert: Issuer already registered');
    const mid = new Error('something else', { cause: deep });
    const top = new Error('outer', { cause: mid });
    expect(readableReason(top)).toBe('failed assert: Issuer already registered');
  });
});