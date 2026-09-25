import { create } from 'zustand';
import {
  fetchLedgerContext,
  type LedgerContext,
} from '@/lib/midnight/onchain';
import {
  createIssuerProfile,
  issueCredentialRealtime,
  isIssuerRegisteredOnChain,
  loadIssuedCredentials,
  loadStoredProfile,
  publicOf,
  registerIssuerRealtime,
  revokeCredentialRealtime,
  saveIssuedCredentials,
  saveIssuerProfile,
  walletKeyOf,
  type IssuerProfile,
  type IssuerProfileInput,
  type IssuerProfilePublic,
  type IssuedCredentialView,
  type RealtimeIssueInput,
} from '@/lib/midnight/issuerProfile';
import { prepareProvingProvider, type SubmitOptions } from '@/lib/midnight/onchain';
import { readableReason } from '@/lib/midnight/alreadyOnChain';
import type { PreprodSession, WalletProvingProvider } from '@/lib/midnight/wallet';

export type IssuerPortalStatus = 'idle' | 'checking' | 'none' | 'creating' | 'unconfirmed' | 'ready' | 'error';

interface RegistrationState {
  busy: boolean;
  txHash: string | null;
  error: string | null;
}

interface IssuerState {
  status: IssuerPortalStatus;
  error: string | null;
  profile: IssuerProfilePublic | null;
  walletKey: string | null;
  registration: RegistrationState;
  issued: IssuedCredentialView[];
  issuing: boolean;
  revokingId: string | null;

  check: (session: PreprodSession) => Promise<void>;
  create: (session: PreprodSession, input: IssuerProfileInput) => Promise<void>;
  reRegister: (session: PreprodSession) => Promise<void>;
  issue: (session: PreprodSession, input: RealtimeIssueInput) => Promise<IssuedCredentialView>;
  revoke: (session: PreprodSession, id: string) => Promise<void>;
  clear: () => void;
}

/** Full profile incl. secret. Module scope only — never placed in reactive state. */
let activeProfile: IssuerProfile | null = null;

/** Wallet proving providers are stateless per proof; bind once per wallet session. */
const providerCache = new WeakMap<object, Promise<WalletProvingProvider>>();
function cachedProvingProvider(api: PreprodSession['api']): Promise<WalletProvingProvider> {
  const hit = providerCache.get(api);
  if (hit) return hit;
  const pending = prepareProvingProvider(api).catch((error) => {
    providerCache.delete(api);
    throw error;
  });
  providerCache.set(api, pending);
  return pending;
}

function staleSubmitOptions(session: PreprodSession): Promise<SubmitOptions> {
  return Promise.all([fetchLedgerContext(session), cachedProvingProvider(session.api)]).then(
    ([context, provingProvider]) => ({ context, provingProvider }),
  );
}

const idleRegistration: RegistrationState = { busy: false, txHash: null, error: null };

async function reconcile(session: PreprodSession, profile: IssuerProfile, context: LedgerContext) {
  const registered = await isIssuerRegisteredOnChain(profile, context);
  return {
    profile: publicOf(profile),
    walletKey: profile.walletKey,
    issued: loadIssuedCredentials(profile.walletKey),
    status: (registered ? 'ready' : 'unconfirmed') as IssuerPortalStatus,
  };
}

export const useIssuerStore = create<IssuerState>((set, get) => ({
  status: 'idle',
  error: null,
  profile: null,
  walletKey: null,
  registration: idleRegistration,
  issued: [],
  issuing: false,
  revokingId: null,

  check: async (session) => {
    set({ status: 'checking', error: null, registration: idleRegistration });
    try {
      const walletKey = await walletKeyOf(session);
      const profile = loadStoredProfile(walletKey);
      if (!profile) {
        activeProfile = null;
        set({ status: 'none', profile: null, walletKey, issued: [] });
        return;
      }
      activeProfile = profile;
      const context = await fetchLedgerContext(session);
      set(await reconcile(session, profile, context));
    } catch (error) {
      set({ status: 'error', error: readableReason(error) });
    }
  },

  create: async (session, input) => {
    const { registration } = get();
    if (registration.busy) return;
    set({ registration: { busy: true, txHash: null, error: null }, error: null });
    try {
      const walletKey = await walletKeyOf(session);
      const existing = loadStoredProfile(walletKey);
      if (existing) {
        // Already registered in this browser for this wallet: reconcile with
        // real on-chain state instead of creating a duplicate identity.
        activeProfile = existing;
        const context = await fetchLedgerContext(session);
        set({
          ...(await reconcile(session, existing, context)),
          registration: idleRegistration,
        });
        return;
      }

      const profile = await createIssuerProfile(input, walletKey);
      // Classify BEFORE submitting: if this wallet+name is already on-chain but
      // the local secret was lost, registration cannot honestly be resumed —
      // a fresh secret would not be the scalar behind the stored verifying key.
      const context = await fetchLedgerContext(session);
      if (await isIssuerRegisteredOnChain(profile, context)) {
        throw new Error(
          `An issuer with the institution name “${input.name}” is already registered on-chain for this wallet, ` +
            'but the matching signing key is missing (browser data was cleared). Registration cannot be resumed ' +
            'without the original key. Choose a different institution name or a fresh wallet.',
        );
      }

      const result = await registerIssuerRealtime(session, profile, { context });
      // `registerIssuerRealtime` classified before submitting. A race that ends
      // `already-on-chain` means some registration for this wallet+name exists
      // but we have no provably-matching secret — not ours to claim.
      if (result.kind === 'already-on-chain') {
        throw new Error(
          `An issuer with the institution name “${input.name}” is already registered on-chain for this wallet, ` +
            'but the matching signing key is missing (browser data was cleared). Registration cannot be resumed ' +
            'without the original key. Choose a different institution name or a fresh wallet.',
        );
      }
      saveIssuerProfile(profile);
      activeProfile = profile;
      set({
        status: 'ready',
        profile: publicOf(profile),
        walletKey,
        issued: [],
        registration: {
          busy: false,
          txHash: result.kind === 'confirmed' ? result.submission.txHash : null,
          error: null,
        },
      });
    } catch (error) {
      const message = readableReason(error);
      set({ registration: { busy: false, txHash: null, error: message }, error: message });
    }
  },

  // A local profile whose registration is not yet confirmed on-chain (e.g. a
  // wallet approval that did not finalise, or a partial run).
  reRegister: async (session) => {
    const profile = activeProfile;
    if (!profile) return;
    set({ registration: { busy: true, txHash: null, error: null }, error: null });
    try {
      const fresh = { ...profile, registeredAt: Math.floor(Date.now() / 1000) };
      const options = await staleSubmitOptions(session);
      const result = await registerIssuerRealtime(session, fresh, options);
      saveIssuerProfile(fresh);
      activeProfile = fresh;
      set({
        status: 'ready',
        profile: publicOf(fresh),
        registration: {
          busy: false,
          txHash: result.kind === 'confirmed' ? result.submission.txHash : null,
          error: null,
        },
      });
    } catch (error) {
      const message = readableReason(error);
      set({ registration: { busy: false, txHash: null, error: message }, error: message });
    }
  },

  issue: async (session, input) => {
    const profile = activeProfile;
    if (!profile) throw new Error('No issuer profile is loaded.');
    set({ issuing: true, error: null });
    try {
      const options = await staleSubmitOptions(session);
      const view = await issueCredentialRealtime(session, profile, input, options);
      const list = [...loadIssuedCredentials(profile.walletKey), view];
      saveIssuedCredentials(profile.walletKey, list);
      set({ issued: list, issuing: false });
      return view;
    } catch (error) {
      set({ issuing: false, error: readableReason(error) });
      throw error;
    }
  },

  revoke: async (session, id) => {
    const profile = activeProfile;
    if (!profile) return;
    set({ revokingId: id, error: null });
    try {
      const view = get().issued.find((credential) => credential.id === id);
      if (!view) throw new Error('Unknown issued credential.');
      const options = await staleSubmitOptions(session);
      await revokeCredentialRealtime(session, profile, view.disclosure.commitment, options);
      const list = get().issued.map((credential) =>
        credential.id === id ? { ...credential, revoked: true } : credential,
      );
      saveIssuedCredentials(profile.walletKey, list);
      set({ issued: list, revokingId: null });
    } catch (error) {
      set({ revokingId: null, error: readableReason(error) });
      throw error;
    }
  },

  clear: () => {
    activeProfile = null;
    set({
      status: 'idle',
      error: null,
      profile: null,
      walletKey: null,
      registration: idleRegistration,
      issued: [],
      issuing: false,
      revokingId: null,
    });
  },
}));