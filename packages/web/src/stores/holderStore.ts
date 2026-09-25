/**
 * Holder-owned state for the production holder flow.
 *
 * The vault is keyed by the connected wallet's shielded coin public key
 * (`verishield:holder:vault:<walletKey>`), so each wallet sees exactly the
 * credentials that reached IT. The private built credential (payload + salt)
 * lives in a module-scope cache — decoded from the stored serialized form at
 * load/import time — and is never placed in reactive state or logged.
 *
 * Real on-chain facts only: credential status is classified by executing the
 * real claim circuit against the real indexer state, and proofs are produced
 * by proving + submitting the claim circuit through the connected wallet.
 */

import { create } from 'zustand';
import { serializeCredential, type BuiltCredential, type Claim, type ProofArtifact } from '@verishield/shared';
import { loadVeriShieldSdk } from '@/lib/midnight/sdk';
import { fetchLedgerContext } from '@/lib/midnight/onchain';
import { walletKeyOf } from '@/lib/midnight/issuerProfile';
import {
  classifyCredentialStatus,
  decodeStoredCredential,
  loadStoredCredentials,
  parseExportedCredential,
  proveClaimOnChain,
  saveStoredCredentials,
  toView,
  type HolderCredentialView,
  type StoredHolderCredential,
} from '@/lib/midnight/holderCredential';
import { readableReason } from '@/lib/midnight/alreadyOnChain';
import { publishArtifact } from './proofStore';
import type { PreprodSession } from '@/lib/midnight/wallet';

export type HolderPortalStatus = 'idle' | 'checking' | 'ready' | 'error';

interface HolderState {
  status: HolderPortalStatus;
  error: string | null;
  walletKey: string | null;
  credentials: HolderCredentialView[];
  proving: boolean;
  proveError: string | null;

  load: (session: PreprodSession) => Promise<void>;
  refreshStatuses: (session: PreprodSession) => Promise<void>;
  importCredential: (session: PreprodSession, exportedJson: string) => Promise<HolderCredentialView>;
  drop: (credentialId: string) => void;
  generateProof: (session: PreprodSession, credentialId: string, claim: Claim) => Promise<ProofArtifact>;
  clear: () => void;
}

/** Private credential material. Module scope only — never in React state. */
const builtCache = new Map<string, BuiltCredential>();

function refreshCache(records: StoredHolderCredential[]): void {
  builtCache.clear();
  for (const record of records) {
    try {
      const built = decodeStoredCredential(record);
      builtCache.set(built.disclosure.id, built);
    } catch {
      // A corrupt vault record is dropped from the cache; it stays out of the UI.
    }
  }
}

export const useHolderStore = create<HolderState>((set, get) => ({
  status: 'idle',
  error: null,
  walletKey: null,
  credentials: [],
  proving: false,
  proveError: null,

  load: async (session) => {
    set({ status: 'checking', error: null, proveError: null });
    try {
      const walletKey = await walletKeyOf(session);
      const records = loadStoredCredentials(walletKey);
      refreshCache(records);
      const views: HolderCredentialView[] = records
        .map((record) => {
          const built = builtCache.get(record.serialized.disclosure.id);
          return built ? toView(built, 'unknown', record.importedAt) : null;
        })
        .filter((view): view is HolderCredentialView => view !== null);
      set({ walletKey, credentials: views, status: 'ready' });
      if (views.length > 0) await get().refreshStatuses(session);
    } catch (error) {
      set({ status: 'error', error: readableReason(error) });
    }
  },

  refreshStatuses: async (session) => {
    const walletKey = get().walletKey;
    if (!walletKey) return;
    set({ status: 'checking', error: null });
    try {
      const context = await fetchLedgerContext(session);
      const updated: HolderCredentialView[] = [];
      for (const view of get().credentials) {
        const built = builtCache.get(view.id);
        if (!built) {
          updated.push(view);
          continue;
        }
        updated.push({ ...view, status: await classifyCredentialStatus(built, context) });
      }
      set({ credentials: updated, status: 'ready' });
    } catch (error) {
      // A classifier failure (e.g. indexer unreachable) surfaces as an
      // unavailable status rather than losing the vault.
      set({
        status: 'ready',
        credentials: get().credentials.map((view) => ({ ...view, status: 'unknown' as const })),
        error: readableReason(error),
      });
    }
  },

  importCredential: async (session, exportedJson) => {
    const walletKey = get().walletKey ?? (await walletKeyOf(session));
    set({ error: null, proveError: null });
    const built = parseExportedCredential(exportedJson.trim());

    const existing = get().credentials.find((view) => view.commitment === built.disclosure.commitment);
    if (existing) throw new Error('This credential is already in the vault.');

    const serialized = serializeCredential(built);

    // Integrity gate: recompute the on-chain commitment + leaf from the
    // package's own payload/salt (same pure circuits the contract uses) and
    // only accept a package whose digests match. Do not mark a credential
    // valid unless this passes.
    const sdk = await loadVeriShieldSdk();
    const integrity = sdk.verifyCredentialIntegrity(serialized);
    if (!integrity.ok) {
      throw new Error(`Credential package rejected: ${integrity.error ?? 'integrity check failed'}`);
    }

    const importedAt = Math.floor(Date.now() / 1000);
    const records = loadStoredCredentials(walletKey);
    records.push({ serialized, importedAt });
    refreshCache(records);
    saveStoredCredentials(walletKey, records);

    const view = toView(built, 'unknown', importedAt);
    // Classify against the real on-chain state before showing it.
    try {
      const context = await fetchLedgerContext(session);
      view.status = await classifyCredentialStatus(built, context);
    } catch {
      view.status = 'unknown';
    }

    set({ walletKey, credentials: [view, ...get().credentials.filter((v) => v.id !== view.id)], status: 'ready' });
    return view;
  },

  drop: (credentialId) => {
    const walletKey = get().walletKey;
    if (!walletKey) return;
    const records = loadStoredCredentials(walletKey).filter(
      (r) => r.serialized.disclosure.id !== credentialId,
    );
    saveStoredCredentials(walletKey, records);
    builtCache.delete(credentialId);
    set({ credentials: get().credentials.filter((view) => view.id !== credentialId) });
  },

  generateProof: async (session, credentialId, claim) => {
    const built = builtCache.get(credentialId);
    if (!built) throw new Error('This credential is not loaded in the current wallet.');
    set({ proving: true, proveError: null });
    try {
      const { artifact } = await proveClaimOnChain(session, built, claim);
      if (artifact.proofValid) publishArtifact(artifact);
      set({ proving: false });
      return artifact;
    } catch (error) {
      const message = readableReason(error);
      set({ proving: false, proveError: message });
      throw error;
    }
  },

  clear: () => {
    builtCache.clear();
    set({
      status: 'idle',
      error: null,
      walletKey: null,
      credentials: [],
      proving: false,
      proveError: null,
    });
  },
}));