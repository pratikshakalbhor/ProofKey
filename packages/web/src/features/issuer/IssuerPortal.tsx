import { useEffect, useState } from 'react';
import {
  FilePlus2,
  ShieldCheck,
  AlertTriangle,
  Ban,
  ChevronDown,
  Settings2,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Building2,
  Share2,
  Copy,
} from 'lucide-react';
import type { CredentialType } from '@verishield/shared';
import { PortalShell } from '@/components/layout/PortalShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/motion';
import { OnChainPanel } from '@/components/onchain/OnChainPanel';
import { ProvisioningPanel } from '@/components/onchain/ProvisioningPanel';
import { WalletStatus } from '@/components/wallet/WalletStatus';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useIssuerStore } from '@/stores/issuerStore';
import { useShareStore } from '@/stores/shareStore';
import {
  exportIssuedCredential,
  listExportableCredentialIds,
  type IssuerProfileInput,
  type IssuedCredentialView,
  type RealtimeIssueInput,
} from '@/lib/midnight/issuerProfile';
import { credentialQrDataUrl } from '@/lib/midnight/qr';

export function IssuerPortal() {
  return (
    <PortalShell
      role="issuer"
      title="Issuer Console"
      description="Create and manage your institution's digital credentials."
      accent="indigo"
    >
      <IssuerDashboard />
    </PortalShell>
  );
}

const LEVEL_LABELS: Record<string, string> = {
  bachelor: 'Bachelor',
  master: 'Master',
  phd: 'Doctorate',
  diploma: 'Diploma',
};

const INSTITUTION_TYPES = ['University', 'College', 'Professional body', 'Government agency', 'Research institute', 'Other'];

function IssuerDashboard() {
  const { toast } = useToast();
  const {
    status,
    error,
    profile,
    registration,
    issued,
    issuing,
    revokingId,
    check,
    create,
    reRegister,
    issue,
    revoke,
    clear,
  } = useIssuerStore();
  const { session, networkMismatch } = useWallet();

  const [showForm, setShowForm] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [created, setCreated] = useState<IssuedCredentialView | null>(null);
  const [shareCredential, setShareCredential] = useState<IssuedCredentialView | null>(null);

  useEffect(() => {
    if (session) void check(session);
    else clear();
  }, [session, check, clear]);

  useEffect(() => {
    if (registration.busy) setRegOpen(true);
    else setRegOpen(false);
  }, [registration.busy]);

  const handleCreate = async (input: IssuerProfileInput) => {
    if (!session) return;
    await create(session, input);
    if (useIssuerStore.getState().status === 'ready') {
      toast('Institution profile created', {
        description: `“${input.name}” is registered on-chain for this wallet and ready to issue credentials.`,
        tone: 'success',
      });
    }
  };

  const handleReRegister = async () => {
    if (!session) return;
    await reRegister(session);
    if (useIssuerStore.getState().status === 'ready') {
      toast('Issuer registered on-chain', { description: 'Registration confirmed by the Midnight indexer.', tone: 'success' });
    }
  };

  const handleIssue = async (input: RealtimeIssueInput) => {
    if (!session) return;
    setShowForm(false);
    try {
      const credential = await issue(session, input);
      setCreated(credential);
      toast('Credential issued', {
        description: 'Anchored to the deployed Preprod contract through your 1AM wallet.',
        tone: 'success',
      });
    } catch (issueError) {
      const message = issueError instanceof Error ? issueError.message : String(issueError);
      console.error('[VeriShield issue]', issueError);
      toast('Issuance failed', { description: message, tone: 'error' });
    }
  };

  const handleRevoke = async (credential: IssuedCredentialView) => {
    if (!session) return;
    try {
      await revoke(session, credential.id);
      toast('Credential revoked', {
        description: 'Revoked on-chain — proofs for it will now fail.',
        tone: 'success',
      });
    } catch (revokeError) {
      console.error('[VeriShield revoke]', revokeError);
      toast('Revocation failed', {
        description: revokeError instanceof Error ? revokeError.message : String(revokeError),
        tone: 'error',
      });
    }
  };

  const handleShare = (credential: IssuedCredentialView) => {
    if (!shareableIds.has(credential.id)) {
      toast('Share unavailable', {
        description:
          'This credential was issued before share support existed; its delivery package is not retained. It remains valid on-chain.',
        tone: 'error',
      });
      return;
    }
    setShareCredential(credential);
  };

  const shareableIds = profile ? new Set(listExportableCredentialIds(profile.walletKey)) : new Set<string>();
  const canIssue = status === 'ready' && Boolean(session) && !networkMismatch;

  return (
    <div className="space-y-10">
      {/* HERO */}
      <FadeIn delay={0}>
        <div className="relative overflow-hidden rounded-2xl border border-white/6 bg-gradient-to-br from-indigo-500/10 via-white/[0.02] to-cyan-500/5 px-6 py-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              {profile ? (
                <>
                  <h1 className="text-2xl font-bold tracking-tight text-white">{profile.name}</h1>
                  <p className="mt-1 text-sm text-slate-400">Issuer profile</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {profile.institutionType} · {profile.country}
                    {profile.website ? ` · ${profile.website}` : ''}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    Register your institution on the Midnight ledger
                  </h1>
                  <p className="mt-1 max-w-xl text-sm text-slate-400">
                    Each connected wallet manages its own issuer profile. Registration is a real on-chain
                    transaction confirmed by the Midnight Preprod indexer.
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Wallet</span>
              <WalletStatus />
            </div>
          </div>
          {profile && session && (
            <div className="mt-5 flex items-center gap-2 text-xs">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    networkMismatch ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${networkMismatch ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              </span>
              <span className={networkMismatch ? 'text-amber-300' : 'text-emerald-300'}>
                {networkMismatch
                  ? 'Connected on the wrong network — switch the 1AM wallet to Midnight Preprod.'
                  : 'Connected · Midnight Preprod'}
              </span>
            </div>
          )}
        </div>
      </FadeIn>

      {/* 0 · PROFILE: create form */}
      {status === 'none' && !networkMismatch && (
        <FadeIn delay={0.05}>
          <CreateProfileCard busy={registration.busy} error={registration.error} onSubmit={(input) => void handleCreate(input)} />
        </FadeIn>
      )}

      {status === 'none' && networkMismatch && (
        <FadeIn delay={0.05}>
          <Card variant="glass" className="p-6">
            <div className="flex items-start gap-2 text-sm text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Switch the 1AM wallet to Midnight Preprod to create this institution&apos;s issuer profile. No
                registration is possible on another network.
              </span>
            </div>
          </Card>
        </FadeIn>
      )}

      {status === 'checking' && (
        <FadeIn delay={0.05}>
          <Card variant="glass" className="p-6">
            <p className="flex items-center gap-2 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-300" aria-hidden />
              Checking this wallet&apos;s issuer profile against the real on-chain registry…
            </p>
          </Card>
        </FadeIn>
      )}

      {status === 'unconfirmed' && profile && (
        <FadeIn delay={0.05}>
          <Card variant="glass" className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-white">{profile.name}</p>
                <p className="mt-1 text-sm text-slate-400">This profile exists locally but its registration has not been confirmed on-chain.</p>
                {registration.error ? (
                  <p className="mt-3 break-words font-mono text-[11px] text-rose-300">{registration.error}</p>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    Re-register with the 1AM wallet — the transaction is broadcast only after your approval.
                  </p>
                )}
              </div>
              <Button onClick={() => void handleReRegister()} loading={registration.busy}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                Complete registration
              </Button>
            </div>
          </Card>
        </FadeIn>
      )}

      {status === 'error' && (
        <FadeIn delay={0.05}>
          <Card variant="glass" className="p-6">
            <div className="flex items-start gap-2 text-sm text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">Could not reach the on-chain registry.</p>
                <p className="break-words font-mono text-[11px] text-rose-300/90">{error}</p>
                {session && (
                  <Button size="sm" variant="ghost" onClick={() => void check(session)}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </FadeIn>
      )}

      {/* READY: the issuer console */}
      {status === 'ready' && profile && (
        <>
          {/* 1 · CREDENTIAL TYPES */}
          <FadeIn delay={0.05}>
            <section className="space-y-4">
              <SectionHeading
                step="1"
                title="Credential types"
                description="The shared on-chain schemas your institution can issue against."
              />
              <ProvisioningPanel />
            </section>
          </FadeIn>

          {/* 2 · ISSUE CREDENTIAL */}
          <FadeIn delay={0.1}>
            <section className="space-y-4">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <SectionHeading
                  step="2"
                  title="Issue credential"
                  description="Create a digital credential and anchor it to the deployed contract."
                />
                <Button onClick={() => setShowForm(true)} disabled={!canIssue}>
                  <FilePlus2 className="h-4 w-4" aria-hidden />
                  Issue Credential
                </Button>
              </div>
              {!canIssue && networkMismatch ? (
                <p className="text-xs text-amber-300/90">
                  Switch the 1AM wallet to Midnight Preprod before issuing.
                </p>
              ) : null}
            </section>
          </FadeIn>

          {/* 3 · ISSUED CREDENTIALS */}
          <FadeIn delay={0.15}>
            <section className="space-y-4">
              <SectionHeading
                step="3"
                title="Issued credentials"
                description="Digital credentials anchored by this institution, with their current status."
              />
              {issued.length === 0 ? (
                <Card variant="glass" className="p-6 text-sm text-slate-400">
                  No credentials issued yet. Issue one through the section above.
                </Card>
              ) : (
                <StaggerChildren stagger={0.07}>
                  <div className="grid gap-4 md:grid-cols-2">
                    {issued.map((credential) => (
                      <StaggerItem key={credential.id}>
                        <CredentialRow
                          credential={credential}
                          shareable={shareableIds.has(credential.id)}
                          revoking={revokingId === credential.id}
                          onRevoke={() => void handleRevoke(credential)}
                          onShare={() => handleShare(credential)}
                        />
                      </StaggerItem>
                    ))}
                  </div>
                </StaggerChildren>
              )}
            </section>
          </FadeIn>

          {/* TECHNICAL DETAILS (collapsed) — the real blockchain facts */}
          <FadeIn delay={0.2}>
            <details className="group rounded-xl border border-white/6 bg-white/[0.02] p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-300">
                <Settings2 className="h-4 w-4 text-slate-500" aria-hidden />
                Technical details
                <span className="ml-auto text-xs text-slate-500">Contract · issuer identity · key material</span>
                <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-5">
                <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500">Issuer ID</span>
                    <div className="mt-1">
                      <CopyableHash value={profile.issuerId} length="medium" />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500">Verifying key</span>
                    <div className="mt-1">
                      <CopyableHash value={`${profile.verifyingKey.x}${profile.verifyingKey.y}`} length="medium" />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500">Wallet key</span>
                    <div className="mt-1">
                      <CopyableHash value={profile.walletKey} length="short" />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500">Credentials issued</span>
                    <div className="mt-1 font-mono text-lg font-semibold text-white">{issued.length}</div>
                  </div>
                  {registration.txHash && (
                    <div className="sm:col-span-2">
                      <span className="text-xs uppercase tracking-wider text-slate-500">Registration</span>
                      <div className="mt-1">
                        <CopyableHash value={registration.txHash} length="medium" />
                      </div>
                    </div>
                  )}
                </div>
                {status === 'ready' && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                    Issuer registration confirmed by the Midnight indexer on the real deployed Preprod contract.
                  </div>
                )}
                <OnChainPanel />
              </div>
            </details>
          </FadeIn>
        </>
      )}

      <IssueModal
        open={showForm}
        onClose={() => setShowForm(false)}
        issuerName={profile?.name ?? ''}
        onSubmit={(input) => void handleIssue(input)}
      />

      {/* Registration in flight */}
      <Modal
        open={regOpen}
        onClose={() => undefined}
        title="Creating your institution profile"
        description="Generating a fresh issuer key and registering your institution on the deployed Preprod contract."
        className="max-w-sm"
        closeOnBackdrop={false}
      >
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
          <p className="text-center text-xs text-slate-400">
            Approve the transaction with the 1AM wallet when prompted. Nothing is broadcast without your approval.
          </p>
        </div>
      </Modal>

      {/* Issuing in flight */}
      <Modal
        open={issuing}
        onClose={() => undefined}
        title="Anchoring credential on-chain"
        description="Building the credential and anchoring it to the deployed contract."
        className="max-w-sm"
        closeOnBackdrop={false}
      >
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
          <p className="text-center text-xs text-slate-400">Approve the proof with the 1AM wallet when prompted.</p>
        </div>
      </Modal>

      {/* Issued success */}
      <Modal
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        title="Credential issued"
        description="Anchored to the deployed Preprod contract through your 1AM wallet"
      >
        {created && (
          <div className="space-y-3">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-500">Credential ID</span>
              <div className="mt-1">
                <CopyableHash value={created.disclosure.id} length="full" />
              </div>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-500">Commitment</span>
              <div className="mt-1">
                <CopyableHash value={created.disclosure.commitment} length="medium" />
              </div>
            </div>
            {created.txHash && (
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500">Anchor transaction</span>
                <div className="mt-1">
                  <CopyableHash value={created.txHash} length="medium" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-300">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
              The holder&apos;s name, marks and date of birth never leave the browser.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setCreated(null);
                  setShareCredential(created);
                }}
              >
                <Share2 className="h-4 w-4" aria-hidden />
                Share credential
              </Button>
              <Button fullWidth onClick={() => setCreated(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Share credential */}
      <IssuerShareModal
        open={Boolean(shareCredential)}
        onClose={() => setShareCredential(null)}
        credential={shareCredential}
      />
    </div>
  );
}

function SectionHeading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-xs font-bold text-indigo-300">
          {step}
        </span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <p className="mt-1.5 max-w-2xl text-sm text-slate-400">{description}</p>
    </div>
  );
}

function CreateProfileCard({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (input: IssuerProfileInput) => void;
}) {
  const [name, setName] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');

  const submit = () => {
    if (!name.trim() || !institutionType.trim() || !country.trim()) return;
    onSubmit({
      name: name.trim(),
      institutionType: institutionType.trim(),
      country: country.trim(),
      website: website.trim() || undefined,
    });
  };

  return (
    <Card variant="glass" className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
          <Building2 className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Create your institution profile</p>
          <p className="text-xs text-slate-400">Registered on-chain with this wallet; each wallet manages its own issuer.</p>
        </div>
      </div>
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          label="Institution name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Riverside University"
          required
          maxLength={32}
        />
        <Select label="Institution type" value={institutionType} onChange={(e) => setInstitutionType(e.target.value)} required>
          <option value="" disabled>
            Select a type
          </option>
          {INSTITUTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. India" required />
          <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
        </div>
        {error && (
          <p className="break-words rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 font-mono text-[11px] text-rose-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Registration is a real on-chain transaction: approve it with the 1AM wallet on Midnight Preprod.
          </p>
          <Button type="submit" loading={busy}>
            Create issuer profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function IssueModal({
  open,
  onClose,
  issuerName,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  issuerName: string;
  onSubmit: (input: RealtimeIssueInput) => void;
}) {
  const [holderName, setHolderName] = useState('Anjali Verma');
  const [credentialType, setCredentialType] = useState<CredentialType>('degree');
  const [degreeType, setDegreeType] = useState('bachelor');
  const [course, setCourse] = useState('Computer Science');
  const [cgpa, setCgpa] = useState('8.5');
  const [dob, setDob] = useState('2002-08-19');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [licenseNumber, setLicenseNumber] = useState('LIC-2026-000123');

  const submit = () => {
    const degree =
      credentialType === 'degree'
        ? `${LEVEL_LABELS[degreeType] ?? 'Bachelor'} in ${course}`.slice(0, 32)
        : credentialType === 'license'
          ? 'Professional License'
          : 'Identity Document';
    const parsedCgpa = Number(cgpa);
    onSubmit({
      holderName: holderName.trim() || 'Unnamed Holder',
      credentialType,
      degree,
      cgpa: Number.isFinite(parsedCgpa) ? Math.min(10, Math.max(0, parsedCgpa)) : 7,
      dateOfBirth: dob,
      licenseNumber: credentialType === 'license' ? licenseNumber : undefined,
      issuedAt: new Date(`${issueDate}T00:00:00Z`),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Issue a new credential" description={issuerName}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          label="Student name"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          required
        />
        <Select
          label="Credential type"
          value={credentialType}
          onChange={(e) => setCredentialType(e.target.value as CredentialType)}
        >
          <option value="degree">Degree certificate</option>
          <option value="license">Professional license</option>
          <option value="id">Identity verification</option>
        </Select>
        {credentialType === 'degree' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Degree type" value={degreeType} onChange={(e) => setDegreeType(e.target.value)}>
                <option value="bachelor">Bachelor</option>
                <option value="master">Master</option>
                <option value="phd">Doctorate</option>
                <option value="diploma">Diploma</option>
              </Select>
              <Input
                label="Degree / Course"
                value={course}
                maxLength={16}
                onChange={(e) => setCourse(e.target.value)}
              />
            </div>
            <Input
              label="CGPA"
              value={cgpa}
              inputMode="decimal"
              onChange={(e) => setCgpa(e.target.value)}
            />
          </>
        )}
        {credentialType === 'license' && (
          <Input
            label="License number"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date of Birth"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          <Input
            label="Issue Date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">
            Anchored on-chain via the 1AM wallet — requires your approval.
          </span>
          <Button type="submit">Issue</Button>
        </div>
      </form>
    </Modal>
  );
}

const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  degree: 'Degree',
  license: 'License',
  id: 'Identity',
};

function CredentialRow({
  credential,
  shareable,
  revoking,
  onRevoke,
  onShare,
}: {
  credential: IssuedCredentialView;
  shareable: boolean;
  revoking: boolean;
  onRevoke: () => void;
  onShare: () => void;
}) {
  return (
    <div className="glass glass-interactive group rounded-xl p-4 transition-shadow hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{credential.holderName}</p>
          <p className="mt-0.5 truncate text-sm text-slate-400">{credential.headline}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {CREDENTIAL_TYPE_LABELS[credential.credentialType]}
          </span>
          <Badge status={credential.revoked ? 'revoked' : 'verified'}>
            {credential.revoked ? 'Revoked' : 'Active'}
          </Badge>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <CopyableHash value={credential.disclosure.id} length="short" />
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            disabled={!shareable}
            onClick={onShare}
            title={shareable ? 'Show QR / copy the credential package for the holder' : 'Issued before share support existed'}
            className="text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={revoking}
            disabled={credential.revoked}
            onClick={onRevoke}
            className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <Ban className="h-3.5 w-3.5" aria-hidden />
            Revoke
          </Button>
        </div>
      </div>
    </div>
  );
}

function IssuerShareModal({
  open,
  onClose,
  credential,
}: {
  open: boolean;
  onClose: () => void;
  credential: IssuedCredentialView | null;
}) {
  const { toast } = useToast();
  const publish = useShareStore((s) => s.publish);
  const [qr, setQr] = useState<string | null>(null);
  const [packageJson, setPackageJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!open || !credential) return;
    setQr(null);
    setError(null);
    setShared(false);
    try {
      const pkg = exportIssuedCredential(credential.id);
      setPackageJson(pkg);
      credentialQrDataUrl(pkg)
        .then(setQr)
        .catch((qrError) => setError(qrError instanceof Error ? qrError.message : String(qrError)));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : String(exportError));
    }
  }, [open, credential]);

  const copyPackage = async () => {
    if (!packageJson) return;
    await navigator.clipboard?.writeText(packageJson);
    toast('Credential package copied', {
      description:
        'Paste it into the holder\'s "Receive credential" → "Paste credential package". It is private — do not post it publicly.',
      tone: 'success',
    });
  };

  const shareInSession = () => {
    if (!credential || !packageJson) return;
    publish({
      credentialId: credential.id,
      issuerName: credential.disclosure.issuerName,
      schemaName: credential.disclosure.schemaName,
      packageJson,
      sharedAt: Date.now(),
    });
    setShared(true);
    toast('Shared with holders on this device', {
      description: 'Open the Holder console → "Receive credential" → "Shared in this browser".',
      tone: 'success',
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share credential"
      description={credential ? `${credential.disclosure.issuerName} · ${payloadSummary(credential)}` : undefined}
      className="max-w-md"
    >
      <div className="space-y-4">
        {error && (
          <p className="break-words rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 font-mono text-[11px] text-rose-300">
            {error}
          </p>
        )}

        {!error && (
          <>
            <div className="flex items-center justify-center rounded-2xl border border-white/8 bg-white p-4">
              {qr ? (
                <img src={qr} alt="Credential package QR code" className="h-64 w-64 object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 py-16 text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-300" aria-hidden />
                  <span className="text-xs">Preparing share QR…</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => void copyPackage()}>
                <Copy className="h-4 w-4" aria-hidden />
                Copy credential package
              </Button>
              <Button size="sm" onClick={shareInSession} disabled={shared}>
                {shared ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                ) : (
                  <Share2 className="h-4 w-4" aria-hidden />
                )}
                {shared ? 'Shared on this device' : 'Share on this device'}
              </Button>
            </div>
          </>
        )}

        <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-[11px] leading-relaxed text-amber-200/90">
          This package contains the holder&apos;s private credential material (their marks, date of
          birth and the issuing salt) plus the on-chain commitment. Deliver it in person — scan the
          QR directly from this screen or hand over the copied package. Never post it online, put it
          on a public URL, or photograph it.
        </div>

        <Button fullWidth variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

function payloadSummary(credential: IssuedCredentialView): string {
  return `${CREDENTIAL_TYPE_LABELS[credential.credentialType]} credential · ${credential.disclosure.id}`;
}