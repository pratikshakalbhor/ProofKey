/**
 * In-session credential hand-off between the Issuer and Holder sides of this
 * app.
 *
 * When the issuer "shares" a credential, the package (the same safe serialized
 * package that backs "Show QR" and "Copy") is placed here so a holder on this
 * device can receive it without re-typing or pasting. It is mirrored to a
 * short-TTL localStorage slot so the hand-off survives a reload / works across
 * two tabs in the same browser — never across devices, never on a public URL.
 *
 * The package still travels through the SAME import pipeline as a scanned QR
 * or a paste: structural parse, commitment-integrity recompute, on-chain
 * classification. Nothing here bypasses validation.
 */

import { create } from 'zustand';

export interface SharedCredentialPackage {
  credentialId: string;
  issuerName: string;
  schemaName: string;
  packageJson: string;
  sharedAt: number;
}

const SHARED_STORAGE_KEY = 'verishield:share:packages';
const TTL_MS = 30 * 60 * 1000;

export function sharedStorageKey(): string {
  return SHARED_STORAGE_KEY;
}

function readShared(storage = localStorage): SharedCredentialPackage[] {
  try {
    const raw = storage.getItem(SHARED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SharedCredentialPackage[];
    const now = Date.now();
    return parsed.filter((p) => now - p.sharedAt < TTL_MS);
  } catch {
    return [];
  }
}

function writeShared(packages: SharedCredentialPackage[], storage = localStorage): void {
  try {
    storage.setItem(SHARED_STORAGE_KEY, JSON.stringify(packages));
  } catch {
    // Best-effort; the in-memory ledger stays usable for the session.
  }
}

interface SharedState {
  packages: SharedCredentialPackage[];
  publish: (pkg: SharedCredentialPackage) => void;
  consume: (credentialId: string) => SharedCredentialPackage | null;
  prune: () => void;
}

export const useShareStore = create<SharedState>((set, get) => ({
  packages: readShared(),

  publish: (pkg) => {
    const packages = [
      pkg,
      ...get().packages.filter((p) => p.credentialId !== pkg.credentialId),
    ].slice(0, 50);
    writeShared(packages);
    set({ packages });
  },

  consume: (credentialId) => {
    const pkg = get().packages.find((p) => p.credentialId === credentialId) ?? null;
    if (pkg) {
      const packages = get().packages.filter((p) => p.credentialId !== credentialId);
      writeShared(packages);
      set({ packages });
    }
    return pkg;
  },

  prune: () => {
    const packages = readShared();
    writeShared(packages);
    set({ packages });
  },
}));