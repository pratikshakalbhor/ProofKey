import { useEffect, useState } from 'react';
import { GraduationCap, FilePlus2, ShieldAlert, ScrollText, AlertTriangle, Ban } from 'lucide-react';
import type { CredentialType } from '@verishield/shared';
import { PortalShell } from '@/components/layout/PortalShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/motion';
import { OnChainPanel } from '@/components/onchain/OnChainPanel';
import { ProvisioningPanel } from '@/components/onchain/ProvisioningPanel';
import { useProofStore } from '@/stores/proofStore';
import type { HolderCredentialView, NewCredentialInput } from '@/lib/midnight/demo';

export function IssuerPortal() {
  return (
    <PortalShell
      role="issuer"
      title="Issuer Console"
      description="Anchor credentials, manage revocation, and keep a trusted registry — all on Midnight."
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

function IssuerDashboard() {
  const { toast } = useToast();
  const status = useProofStore((s) => s.status);
  const bootError = useProofStore((s) => s.error);
  const issuer = useProofStore((s) => s.issuer);
  const credentials = useProofStore((s) => s.credentials);
  const ledger = useProofStore((s) => s.ledger);
  const boot = useProofStore((s) => s.boot);
  const issue = useProofStore((s) => s.issue);
  const revoke = useProofStore((s) => s.revoke);

  const [showForm, setShowForm] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issuingError, setIssuingError] = useState<string | null>(null);
  const [created, setCreated] = useState<HolderCredentialView | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  const handleIssue = async (input: NewCredentialInput) => {
    setShowForm(false);
    setIssuing(true);
    setIssuingError(null);
    try {
      const credential = await issue(input);
      setCreated(credential);
      toast('Credential issued', {
        description: 'Commitment anchored in the circuit runtime.',
        tone: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setIssuingError(message);
      toast('Issuance failed', { description: message, tone: 'error' });
    } finally {
      setIssuing(false);
    }
  };

  const handleRevoke = async (credential: HolderCredentialView) => {
    setRevokingId(credential.disclosure.id);
    try {
      await revoke(credential.disclosure.id);
      toast('Credential revoked', {
        description: 'Revocation set updated on-chain. Proofs will now fail.',
        tone: 'success',
      });
    } catch (error) {
      toast('Revocation failed', {
        description: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <WalletConnect />
      </FadeIn>

      <FadeIn delay={0.05}>
        <OnChainPanel />
      </FadeIn>

      <FadeIn delay={0.1}>
        <ProvisioningPanel />
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <GraduationCap className="h-5 w-5 text-indigo-300" aria-hidden />
              Issuer Registry
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {issuer ? (
                <>
                  Operating as <span className="font-medium text-slate-200">{issuer.name}</span>
                </>
              ) : (
                'Booting the issuer runtime…'
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge status={status === 'ready' ? 'verified' : 'neutral'}>
              {status === 'ready' ? 'Runtime ready' : status}
            </Badge>
            <Button onClick={() => setShowForm(true)} size="sm" disabled={status !== 'ready'}>
              <FilePlus2 className="h-4 w-4" aria-hidden />
              Issue credential
            </Button>
          </div>
        </div>
      </FadeIn>

      {status === 'error' && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Could not start the circuit simulator: {bootError}</span>
        </div>
      )}

      {issuer && (
        <FadeIn delay={0.1}>
          <Card variant="glass" className="p-5">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500">Issuer ID</span>
                <div className="mt-1">
                  <CopyableHash value={issuer.issuerId} length="medium" />
                </div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500">Verifying key</span>
                <div className="mt-1">
                  <CopyableHash value={`${issuer.verifyingKey.x}${issuer.verifyingKey.y}`} length="medium" />
                </div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500">Credentials</span>
                <div className="mt-1 font-mono text-lg font-semibold text-white">
                  {credentials.length}
                </div>
              </div>
              {ledger && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-500">
                    Verifications
                  </span>
                  <div className="mt-1 font-mono text-lg font-semibold text-white">
                    {ledger.verificationCount}
                  </div>
                </div>
              )}
            </div>
            {ledger && (
              <p className="mt-4 border-t border-white/5 pt-3 text-[11px] text-slate-500">
                contract <span className="hash-block">{ledger.contractAddress.slice(0, 24)}…</span> ·
                issuers {ledger.issuerCount}
              </p>
            )}
          </Card>
        </FadeIn>
      )}

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <ScrollText className="h-4 w-4" aria-hidden />
          Issued credentials
        </h3>
        {status === 'booting' || status === 'idle' ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((i) => (
              <Card key={i} variant="glass" className="h-32 animate-pulse bg-white/[0.03]" />
            ))}
          </div>
        ) : (
          <StaggerChildren stagger={0.07}>
            <div className="grid gap-4 md:grid-cols-2">
              {credentials.map((credential) => (
                <StaggerItem key={credential.disclosure.id}>
                  <CredentialRow
                    credential={credential}
                    revoking={revokingId === credential.disclosure.id}
                    onRevoke={() => void handleRevoke(credential)}
                  />
                </StaggerItem>
              ))}
            </div>
          </StaggerChildren>
        )}
      </div>

      <IssueModal
        open={showForm}
        onClose={() => setShowForm(false)}
        issuerName={issuer?.name ?? ''}
        onSubmit={(input) => void handleIssue(input)}
      />

      <Modal
        open={issuing}
        onClose={() => setIssuing(false)}
        title="Anchoring on chain"
        description="Computing commitment and executing anchorCredential in-circuit"
        className="max-w-sm"
        closeOnBackdrop={false}
      >
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
          <p className="text-xs text-slate-400">
            persistentCommit(payload, salt) then leaf = H(tag ∥ issuerId ∥ commitment)…
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        title="Credential issued"
        description="The commitment is now anchored in the registry"
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
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-300">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
              The holder&apos;s name, marks and DOB were never included in this transaction.
            </div>
            <Button fullWidth onClick={() => setCreated(null)}>
              Done
            </Button>
          </div>
        )}
      </Modal>

      {issuingError && !issuing && (
        <p className="text-xs text-rose-400">Last issuance error: {issuingError}</p>
      )}
    </div>
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
  onSubmit: (input: NewCredentialInput) => void;
}) {
  const [holderName, setHolderName] = useState('Anjali Verma');
  const [credentialType, setCredentialType] = useState<CredentialType>('degree');
  const [level, setLevel] = useState('bachelor');
  const [field, setField] = useState('Computer Science');
  const [cgpa, setCgpa] = useState('8.5');
  const [dob, setDob] = useState('2002-08-19');
  const [licenseNumber, setLicenseNumber] = useState('LIC-2026-000123');

  const submit = () => {
    const degree =
      credentialType === 'degree'
        ? `${LEVEL_LABELS[level] ?? 'Bachelor'} in ${field}`.slice(0, 32)
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
          label="Holder full name"
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
              <Select label="Degree level" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="bachelor">Bachelor</option>
                <option value="master">Master</option>
                <option value="phd">Doctorate</option>
                <option value="diploma">Diploma</option>
              </Select>
              <Input
                label="Field of study"
                value={field}
                maxLength={16}
                onChange={(e) => setField(e.target.value)}
              />
            </div>
            <Input
              label="Grade / CGPA"
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
        <Input
          label="Date of birth"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">
            Only the commitment hash is anchored on-chain.
          </span>
          <Button type="submit">Issue</Button>
        </div>
      </form>
    </Modal>
  );
}

function CredentialRow({
  credential,
  revoking,
  onRevoke,
}: {
  credential: HolderCredentialView;
  revoking: boolean;
  onRevoke: () => void;
}) {
  return (
    <div className="glass glass-interactive group rounded-xl p-4 transition-shadow hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{credential.holderName}</p>
          <p className="mt-0.5 truncate text-sm text-slate-400">{credential.headline}</p>
        </div>
        <Badge status={credential.revoked ? 'revoked' : 'verified'}>
          {credential.revoked ? 'Revoked' : 'Active'}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <CopyableHash value={credential.disclosure.id} length="short" />
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
  );
}
