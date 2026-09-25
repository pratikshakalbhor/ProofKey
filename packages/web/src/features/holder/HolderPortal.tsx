import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  ShieldCheck,
  Fingerprint,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ScanSearch,
  Loader2,
  Upload,
  RefreshCw,
  X,
  Handshake,
  ScanLine,
  ClipboardPaste,
} from 'lucide-react';
import type { Claim, ClaimKind, ProofArtifact } from '@verishield/shared';
import { PortalShell } from '@/components/layout/PortalShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/motion';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useHolderStore } from '@/stores/holderStore';
import { useShareStore } from '@/stores/shareStore';
import { QrScanner } from '@/components/holder/QrScanner';
import { claimOptionsFor } from '@/lib/midnight/claims';
import type { HolderCredentialView } from '@/lib/midnight/holderCredential';
import type { PreprodSession } from '@/lib/midnight/wallet';
import { cn } from '@/lib/utils';

export function HolderPortal() {
  return (
    <PortalShell
      role="holder"
      title="Holder Console"
      description="Own your credentials and prove claims without revealing private information."
      accent="violet"
    >
      <HolderConsole />
    </PortalShell>
  );
}

/** Human-friendly "What would you like to prove?" cards per claim kind. */
const PROOF_CARDS: Record<ClaimKind, { title: string; description: string }> = {
  HAS_CREDENTIAL: {
    title: 'I hold this credential',
    description: 'Prove the credential is anchored by its issuer and unrevoked.',
  },
  FIELD_EQUALS: {
    title: 'A field meets a requirement',
    description: 'Prove a private field equals a value without revealing it.',
  },
  RANGE_PROOF: {
    title: 'My value is within a range',
    description: 'Prove a value is above a threshold without revealing it.',
  },
  AGE_OVER: {
    title: 'I meet an age requirement',
    description: 'Prove you are at least N years old — without your date of birth.',
  },
  NOT_EXPIRED: {
    title: 'My credential is not expired',
    description: 'Prove the credential is still within its validity period.',
  },
};

const CLAIM_ORDER: ClaimKind[] = ['HAS_CREDENTIAL', 'FIELD_EQUALS', 'RANGE_PROOF', 'AGE_OVER', 'NOT_EXPIRED'];

const STATUS_LABEL: Record<HolderCredentialView['status'], string> = {
  active: 'Active',
  revoked: 'Revoked',
  'not-anchored': 'Not anchored on-chain',
  'issuer-inactive': 'Issuer inactive',
  'schema-unknown': 'Schema unknown',
  unknown: 'Status unavailable',
};

const STATUS_BADGE: Record<HolderCredentialView['status'], 'verified' | 'revoked' | 'neutral'> = {
  active: 'verified',
  revoked: 'revoked',
  'not-anchored': 'neutral',
  'issuer-inactive': 'neutral',
  'schema-unknown': 'neutral',
  unknown: 'neutral',
};

function canProve(view: HolderCredentialView): { ok: boolean; reason?: string } {
  if (view.status === 'revoked') return { ok: false, reason: 'This credential has been revoked on-chain.' };
  if (view.status === 'not-anchored') return { ok: false, reason: 'Not anchored on-chain by its issuer.' };
  if (view.status === 'issuer-inactive') return { ok: false, reason: 'Its issuer is no longer active on-chain.' };
  if (view.status === 'schema-unknown') return { ok: false, reason: 'Its schema is no longer registered on-chain.' };
  if (view.status === 'unknown')
    return { ok: false, reason: 'On-chain status unavailable — refresh the list.' };
  return { ok: true };
}

function HolderConsole() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { status: walletStatus, session, networkMismatch, connect } = useWallet();
  const { status, error, credentials, proving, load, refreshStatuses, generateProof, clear } =
    useHolderStore();

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [provingView, setProvingView] = useState<HolderCredentialView | null>(null);
  const [proofResult, setProofResult] = useState<ProofArtifact | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  useEffect(() => {
    if (session) void load(session);
    else clear();
  }, [session, load, clear]);

  const runRefresh = async () => {
    if (!session) return;
    setRefreshBusy(true);
    try {
      await refreshStatuses(session);
      toast('Status refreshed', { description: 'Re-checked against the real on-chain contract state.', tone: 'info' });
    } catch {
      toast('Could not refresh', { description: 'The indexer was unreachable; statuses may be stale.', tone: 'error' });
    } finally {
      setRefreshBusy(false);
    }
  };

  const copyProof = async (artifact: ProofArtifact) => {
    await navigator.clipboard?.writeText(JSON.stringify(artifact, null, 2));
    toast('Proof copied', {
      description: 'Only public proof data is in this file — no private credential material.',
      tone: 'success',
    });
  };

  const closeProveModal = () => {
    setProvingView(null);
    setProofResult(null);
    setProofError(null);
  };

  const connected = walletStatus === 'connected' && Boolean(session) && !networkMismatch;

  return (
    <div className="space-y-8">
      {/* CONNECT GATE */}
      {(walletStatus === 'disconnected' || walletStatus === 'initializing') && (
        <FadeIn>
          <Card variant="glass" className="p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
              <Wallet className="h-7 w-7" aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-white">Connect your 1AM wallet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
              Your credentials are stored privately in the browser profile of the wallet you
              connect — possession is what binds them to you.
            </p>
            <Button onClick={connect} className="mt-5">
              <Wallet className="h-4 w-4" aria-hidden />
              Connect 1AM
            </Button>
          </Card>
        </FadeIn>
      )}

      {walletStatus === 'connected' && networkMismatch && (
        <FadeIn>
          <Card variant="glass" className="p-6">
            <div className="flex items-start gap-2 text-sm text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Switch the 1AM wallet to Midnight Preprod. Credentials are tied to this device and
                network; on-chain checks need the real Preprod contract.
              </span>
            </div>
          </Card>
        </FadeIn>
      )}

      {walletStatus === 'connected' && !connected && !networkMismatch && (
        <FadeIn>
          <Card variant="glass" className="p-6 text-sm text-slate-400">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-violet-300" aria-hidden />
            Connecting…
          </Card>
        </FadeIn>
      )}

      {session && (
        <div className="space-y-8">
          {/* MY CREDENTIALS */}
          <FadeIn delay={0.05}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <ShieldCheck className="h-5 w-5 text-violet-300" aria-hidden />
                  My Credentials
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Loaded from this wallet&apos;s vault. Status is checked against the real contract.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={runRefresh} loading={refreshBusy || status === 'checking'}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Refresh status
                </Button>
                <Button size="sm" onClick={() => setReceiveOpen(true)}>
                  <ScanLine className="h-3.5 w-3.5" aria-hidden />
                  Receive credential
                </Button>
              </div>
            </div>
          </FadeIn>

          {status === 'checking' && (
            <div className="grid gap-5 md:grid-cols-2">
              {[0, 1].map((i) => (
                <Card key={i} variant="glass" className="h-52 animate-pulse bg-white/[0.03]" />
              ))}
            </div>
          )}

          {status === 'error' && (
            <FadeIn>
              <Card variant="glass" className="p-6">
                <div className="flex items-start gap-2 text-sm text-rose-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">Could not load this wallet&apos;s vault.</p>
                    <p className="break-words font-mono text-[11px] text-rose-300/90">{error}</p>
                    <Button size="sm" variant="ghost" className="mt-1" onClick={() => session && void load(session)}>
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                      Retry
                    </Button>
                  </div>
                </div>
              </Card>
            </FadeIn>
          )}

          {status === 'ready' && credentials.length === 0 && (
            <FadeIn>
              <Card variant="glass" className="p-10 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
                  <Lock className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">No credentials yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
                  Receive a credential from an issuer.
                </p>
                <Button className="mt-5" onClick={() => setReceiveOpen(true)}>
                  <ScanLine className="h-4 w-4" aria-hidden />
                  Receive credential
                </Button>
                <p className="mt-4 text-xs text-slate-500">
                  Scan the issuer&apos;s on-screen QR, accept a credential shared on this device, or
                  paste the package they send you.
                </p>
              </Card>
            </FadeIn>
          )}

          {status === 'ready' && credentials.length > 0 && (
            <StaggerChildren stagger={0.08}>
              <div className="grid gap-5 md:grid-cols-2">
                {credentials.map((credential) => (
                  <StaggerItem key={credential.id}>
                    <CredentialCard credential={credential} onProve={() => setProvingView(credential)} />
                  </StaggerItem>
                ))}
              </div>
            </StaggerChildren>
          )}

          {/* RECEIVE CREDENTIAL MODAL */}
          <ReceiveModal open={receiveOpen} onClose={() => setReceiveOpen(false)} session={session} />

          <ProveModal
            open={Boolean(provingView)}
            onClose={closeProveModal}
            credential={provingView}
            proving={proving}
            result={proofResult}
            resultError={proofError}
            onGenerate={async (claim) => {
              if (!session || !provingView) return;
              setProofError(null);
              try {
                const artifact = await generateProof(session, provingView.id, claim);
                setProofResult(artifact);
              } catch (generateError) {
                setProofResult(null);
                setProofError(generateError instanceof Error ? generateError.message : String(generateError));
              }
            }}
            onCopyProof={(a) => void copyProof(a)}
            onVerifyProof={() => {
              setProvingView(null);
              navigate('/verifier');
            }}
          />
        </div>
      )}
    </div>
  );
}

function ReceiveModal({
  open,
  onClose,
  session,
}: {
  open: boolean;
  onClose: () => void;
  session: PreprodSession;
}) {
  const { toast } = useToast();
  const importCredential = useHolderStore((s) => s.importCredential);
  const shared = useShareStore((s) => s.packages);
  const consume = useShareStore((s) => s.consume);
  const prune = useShareStore((s) => s.prune);

  const [tab, setTab] = useState<'shared' | 'scan' | 'paste'>('shared');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Receiving credential…');
  const [error, setError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    if (open) {
      prune();
      setError(null);
      setBusy(false);
      setTab(shared.length > 0 ? 'shared' : 'scan');
      setPasteText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session]);

  const runImportText = async (text: string, label: string, after?: () => void) => {
    setBusy(true);
    setBusyLabel(label);
    setError(null);
    try {
      const view = await importCredential(session, text);
      after?.();
      onClose();
      toast('Credential received', {
        description: `Imported into this wallet's vault. On-chain status: ${STATUS_LABEL[view.status].toLowerCase()}.`,
        tone: view.status === 'active' ? 'success' : view.status === 'unknown' ? 'info' : 'error',
      });
    } catch (importErr) {
      setError(importErr instanceof Error ? importErr.message : String(importErr));
    } finally {
      setBusy(false);
    }
  };

  const receiveShared = (credentialId: string, packageJson: string) => {
    void runImportText(packageJson, 'Receiving new credential…', () => consume(credentialId));
  };

  const TABS = [
    { id: 'shared' as const, label: 'Shared on this device', icon: Handshake },
    { id: 'scan' as const, label: 'Scan QR code', icon: ScanLine },
    { id: 'paste' as const, label: 'Paste credential package', icon: ClipboardPaste },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receive credential"
      description="Scan the issuer's share QR, accept a credential shared on this device, or paste the package they send you."
    >
      <div className="space-y-4">
        <div className="flex gap-1.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setError(null);
              }}
              disabled={busy}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors',
                tab === id
                  ? 'border-violet-400/40 bg-violet-400/10 text-violet-200'
                  : 'border-white/8 text-slate-500 hover:border-white/15 hover:text-slate-300',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {error && (
          <p className="break-words rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 font-mono text-[11px] text-rose-300">
            {error}
          </p>
        )}

        {busy && (
          <div className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/5 p-3 text-xs text-violet-200">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {busyLabel}
          </div>
        )}

        {tab === 'shared' && (
          <div className="space-y-2">
            {shared.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                No credential has been shared on this device yet. Ask the issuer to open{" "}
                <span className="text-slate-300">Issuer Console → Share credential</span>, or use
                another tab below.
              </p>
            ) : (
              shared.map((pkg) => (
                <div
                  key={pkg.credentialId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/8 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{pkg.issuerName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {pkg.schemaName} · {pkg.credentialId} · {minutesAgo(pkg.sharedAt)}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => receiveShared(pkg.credentialId, pkg.packageJson)}>
                    Receive
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'scan' && (
          <QrScanner
            onDecoded={(text) => void runImportText(text, 'Verifying received credential…')}
            onError={(message) => setError(message)}
          />
        )}

        {tab === 'paste' && (
          <div className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Credential package
              </span>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder='{"version":1,"payload":…}'
                className="min-h-[120px] w-full rounded-xl border border-white/8 bg-base-100/60 px-3.5 py-2.5 font-mono text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none focus-ring"
                spellCheck={false}
              />
            </label>
            <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              The package is validated (commitment recomputed) and stored only in this wallet&apos;s
              browser profile.
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                loading={busy}
                disabled={!pasteText.trim()}
                onClick={() => void runImportText(pasteText.trim(), 'Verifying credential package…')}
              >
                <Upload className="h-4 w-4" aria-hidden />
                Receive credential
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function minutesAgo(sharedAt: number): string {
  const minutes = Math.max(1, Math.round((Date.now() - sharedAt) / 60000));
  return minutes === 1 ? '1 min ago' : `${minutes} mins ago`;
}

function CredentialCard({ credential, onProve }: { credential: HolderCredentialView; onProve: () => void }) {
  const prove = canProve(credential);
  const typeIcon = credential.credentialType === 'id' ? '🪪' : credential.credentialType === 'license' ? '📜' : '🎓';

  return (
    <Card variant="glass" interactive className="overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500/50 via-fuchsia-500/30 to-transparent" />
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/6 text-xl" aria-hidden>
              {typeIcon}
            </span>
            <div>
              <p className="font-semibold capitalize text-white">{credential.credentialType} credential</p>
              <p className="text-xs text-slate-400">Issued by: {credential.issuerName}</p>
            </div>
          </div>
          <Badge status={STATUS_BADGE[credential.status]}>{STATUS_LABEL[credential.status]}</Badge>
        </div>

        <div className="space-y-2 rounded-xl border border-white/6 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-xs uppercase tracking-wider text-slate-500">Credential ID</span>
            <CopyableHash value={credential.id} length="short" />
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-xs uppercase tracking-wider text-slate-500">Commitment</span>
            <CopyableHash value={credential.commitment} length="short" />
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-xs uppercase tracking-wider text-slate-500">Issued</span>
            <span className="text-xs text-slate-300">
              {new Date(credential.issuedAt * 1000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-xs uppercase tracking-wider text-slate-500">Expires</span>
            <span className="text-xs text-slate-300">
              {new Date(credential.expiresAt * 1000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {!prove.ok && (
          <p className="flex items-center gap-1.5 text-[11px] text-amber-300/80">
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
            {prove.reason}
          </p>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={onProve} disabled={!prove.ok}>
            <Fingerprint className="h-4 w-4" aria-hidden />
            Prove something
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ProveModal({
  open,
  onClose,
  credential,
  proving,
  result,
  resultError,
  onGenerate,
  onCopyProof,
  onVerifyProof,
}: {
  open: boolean;
  onClose: () => void;
  credential: HolderCredentialView | null;
  proving: boolean;
  result: ProofArtifact | null;
  resultError: string | null;
  onGenerate: (claim: Claim) => Promise<void>;
  onCopyProof: (artifact: ProofArtifact) => void;
  onVerifyProof: () => void;
}) {
  const options = useMemo(() => (credential ? claimOptionsFor(credential.credentialType) : []), [credential]);
  const [kind, setKind] = useState<ClaimKind | null>(null);
  const [minCgpa, setMinCgpa] = useState('7.5');
  const [minAge, setMinAge] = useState('18');
  const [field, setField] = useState('');

  // Reset claim selection when a different credential opens the modal.
  useEffect(() => {
    if (open && credential) {
      setKind(null);
      setMinCgpa('7.5');
      setMinAge('18');
      setField('');
    }
  }, [open, credential]);

  const available = new Set(options.map((option) => option.kind));
  const cards = CLAIM_ORDER.filter((c) => available.has(c));

  const buildClaim = (): Claim => {
    const base = { kind };
    switch (kind) {
      case 'RANGE_PROOF': {
        const value = Math.min(10, Math.max(0, Number(minCgpa) || 0));
        return { ...base, minCgpa: value } as Claim;
      }
      case 'AGE_OVER': {
        const value = Math.min(150, Math.max(1, Math.round(Number(minAge) || 1)));
        return { ...base, minAge: value } as Claim;
      }
      case 'FIELD_EQUALS':
        return { ...base, expectedDegree: field.trim() } as Claim;
      default:
        return base as Claim;
    }
  };

  const canGenerate = Boolean(
    kind &&
      (kind !== 'RANGE_PROOF' || minCgpa.trim() !== '') &&
      (kind !== 'AGE_OVER' || minAge.trim() !== '') &&
      (kind !== 'FIELD_EQUALS' || field.trim() !== ''),
  );

  const invalid = Boolean(result && !result.proofValid);
  const showResult = Boolean(credential && result);
  const title = showResult
    ? invalid
      ? 'Not proven'
      : 'Proof ready'
    : credential
      ? (kind ? PROOF_CARDS[kind].title : 'Prove something')
      : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdrop={!proving}
      title={title}
      description={
        showResult
          ? invalid
            ? 'The circuit could not prove this claim.'
            : 'This proof can be verified without revealing your private credential data.'
          : credential
            ? `${credential.issuerName} · ${credential.credentialType} credential`
            : undefined
      }
    >
      {credential && !result && !proving && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
              What would you like to prove?
            </p>
            <div className="space-y-2">
              {cards.map((category) => {
                const card = PROOF_CARDS[category];
                const selected = kind === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setKind(kind === category ? null : category)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      selected ? 'border-violet-400/40 bg-violet-400/5' : 'border-white/8 hover:border-white/15',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border',
                        selected ? 'border-violet-300 bg-violet-400' : 'border-slate-600',
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-200">{card.title}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{card.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {kind === 'RANGE_PROOF' && (
            <Input
              label="Minimum CGPA"
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={minCgpa}
              onChange={(e) => setMinCgpa(e.target.value)}
            />
          )}
          {kind === 'AGE_OVER' && (
            <Input
              label="Minimum age"
              type="number"
              min={1}
              max={150}
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
            />
          )}
          {kind === 'FIELD_EQUALS' && (
            <Input
              label="Field value to prove equals"
              value={field}
              maxLength={32}
              placeholder="e.g. Bachelor in Computer Science"
              onChange={(e) => setField(e.target.value)}
            />
          )}

          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              What the verifier receives
            </p>
            <p className="hash-block text-[11px] text-cyan-300">{'{ proofValid: boolean }'}</p>
            <div className="mt-2 space-y-1">
              {['Name', 'Degree', 'CGPA', 'Date of birth'].map((item) => (
                <div key={item} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Lock className="h-3 w-3" aria-hidden /> {item}
                  </span>
                  <span className="hash-block text-slate-600">[PRIVATE]</span>
                </div>
              ))}
            </div>
          </div>

          {resultError && <p className="break-words text-xs text-rose-400">{resultError}</p>}

          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={proving}>
              Cancel
            </Button>
            <Button size="sm" loading={proving} disabled={!canGenerate} onClick={() => void onGenerate(buildClaim())}>
              <Fingerprint className="h-4 w-4" aria-hidden />
              Generate ZK Proof
            </Button>
          </div>
        </div>
      )}

      {credential && proving && !result && (
        <div className="space-y-4 py-4 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-300" aria-hidden />
          <p className="text-sm text-slate-300">Creating your zero-knowledge proof…</p>
          <p className="text-xs text-slate-500">
            Proving in the browser, then submitting to the real contract through your 1AM wallet.
          </p>
        </div>
      )}

      {result && (
        <ProofResultCard artifact={result} onCopy={() => onCopyProof(result)} onVerify={onVerifyProof} onClose={onClose} />
      )}

      {!credential && <div className="py-6 text-center text-sm text-slate-500">No credential selected.</div>}
    </Modal>
  );
}

function ProofResultCard({
  artifact,
  onCopy,
  onVerify,
  onClose,
}: {
  artifact: ProofArtifact;
  onCopy: () => void;
  onVerify: () => void;
  onClose: () => void;
}) {
  const valid = artifact.proofValid;
  return (
    <div className="space-y-4">
      <div
        className={cn(
          'rounded-xl border p-4 text-center',
          valid ? 'border-cyan-400/30 bg-cyan-400/5' : 'border-rose-500/30 bg-rose-500/5',
        )}
      >
        {valid ? (
          <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-cyan-300" aria-hidden />
        ) : (
          <X className="mx-auto mb-2 h-7 w-7 text-rose-400" aria-hidden />
        )}
        <p className="hash-block text-sm text-white">
          {'{ proofValid: '}
          <span className={valid ? 'text-cyan-300' : 'text-rose-400'}>{String(valid)}</span>
          {' }'}
        </p>
        {!valid && artifact.failureReason && (
          <p className="mt-2 break-words text-xs text-rose-300">{artifact.failureReason}</p>
        )}
        {valid && (
          <p className="mt-2 text-xs text-slate-300">
            Proven on-chain through your 1AM wallet on the deployed Preprod contract.
          </p>
        )}
      </div>

      <div className="space-y-1.5 rounded-xl border border-white/6 bg-white/[0.02] p-3">
        <MetaRow label="claim">{artifact.claim}</MetaRow>
        <MetaRow label="engine">
          <span className={valid ? 'hash-block text-amber-300' : 'hash-block text-slate-400'}>{artifact.engine}</span>
        </MetaRow>
        {artifact.onChain && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-500">anchor tx</span>
            <CopyableHash value={artifact.onChain.txHash} length="short" />
          </div>
        )}
        <MetaRow label="zk-proven">
          <span className={artifact.zkProven ? 'text-cyan-300' : 'text-slate-400'}>{String(artifact.zkProven)}</span>
        </MetaRow>
        <MetaRow label="circuit">
          <span className="hash-block text-slate-300">{artifact.timings.circuitMs.toFixed(1)} ms</span>
        </MetaRow>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-slate-500">binding</span>
          <CopyableHash value={artifact.binding} length="short" />
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-500">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        Only this public boolean is shared. The payload, salt and issuer signature never left the
        browser.
      </p>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onCopy} disabled={!valid}>
            <Copy className="h-4 w-4" aria-hidden />
            Copy proof
          </Button>
          <Button size="sm" onClick={onVerify} disabled={!valid}>
            <ScanSearch className="h-4 w-4" aria-hidden />
            Verify proof
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-300">{children}</span>
    </div>
  );
}