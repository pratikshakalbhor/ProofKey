/**
 * Pure helpers for classifying circuit-execution outcomes against REAL on-chain
 * state. No network I/O, no witness values — importable from unit tests.
 */

/** Deepest non-empty error message without touching any private values. */
export function readableReason(error: unknown): string {
  let current: unknown = error;
  const seen = new Set<unknown>();
  let lastMessage = 'unknown error';
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const message = (current as { message?: unknown }).message;
    if (typeof message === 'string' && message) lastMessage = message;
    current = (current as { cause?: unknown }).cause;
  }
  return lastMessage;
}

/**
 * True when ANY layer of the error chain says the on-chain effect already
 * exists ("Issuer already registered" / "Credential already anchored"). Compact
 * emits these as `failed assert: …` both directly and nested inside the
 * `Error executing circuit '…'` wrapper, so the whole cause chain is inspected.
 * Used only to resume provisioning idempotently from genuinely observed
 * on-chain state — never fabricated.
 */
export function isAlreadyProvisionedError(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const message = (current as { message?: unknown }).message;
    if (typeof message === 'string' && /already (registered|anchored)/i.test(message)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}