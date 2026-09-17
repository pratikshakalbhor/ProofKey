import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Wallet,
  Fingerprint,
  Eye,
  EyeOff,
  ArrowRight,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import type { Claim, ProofArtifact } from '@verishield/shared';
import { PortalShell } from '@/components/layout/PortalShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/motion';
import { useProofStore } from '@/stores/proofStore';
import {
  claimOptionsFor,
  describeClaim,
  withClaimDefaults,
} from '@/lib/midnight/claims';
import type { HolderCredentialView } from '@/lib/midnight/demo';
import { cn } from '@/lib/utils';

export function HolderPortal() {
  return (
    <PortalShell
      role="holder"
      title="Holder Wallet"
      description="Your credentials live here — privately. Generate zero-knowledge proofs of a single claim without revealing the rest."
      accent="violet"
    >
      <HolderWallet />
    </PortalShell>
  );
}

function HolderWallet() {
  const { toast } = useToast();
  const status = useProofStore((s) => s.status);
  const bootError = useProofStore((s) => s.error);
  const credentials = useProofStore((s) => s.credentials);
  const boot = useProofStore((s) => s.boot);
  const generateProof = useProofStore((s) => s.generateProof);

  const [proving, setProving] = useState<HolderCredentialView | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [artifact, setArtifact] = useState<ProofArtifact | null>(null);
  const [busy, setBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  const openProof = (credential: HolderCredentialView) => {
    setProving(credential);
    setClaim(credential.suggestedClaim);
    setArtifact(null);
    setProofError(null);
  };

  const closeProof = () => {
    setProving(null);
    setClaim(null);
    setArtifact(null);
    setProofError(null);
  };

  const runProof = async () => {
    if (!proving || !claim) return;
    setBusy(true);
    setProofError(null);
    try {
      const resolved = withClaimDefaults(claim, proving.headline);
      const result = await generateProof(proving.disclosure.id, resolved);
      setArtifact(result);
      if (result.proofValid) {
        toast('Proof generated', {
          description: `Claim proven in ${result.timings.totalMs.toFixed(0)} ms · circuit simulator`,
          tone: 'success',
        });
      } else {
        toast('Claim not proven', {
          description: result.failureReason ?? 'The circuit rejected this claim.',
          tone: 'error',
        });
      }
    } catch (error) {
      setProofError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <WalletConnect />
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Wallet className="h-5 w-5 text-violet-300" aria-hidden />
              Your credential vault
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Private payloads stay in your browser. Only a proof leaves the wallet.
            </p>
          </div>
          <Badge status={status === 'ready' ? 'verified' : 'neutral'} pulse={status === 'booting'}>
            {status === 'ready'
              ? `${credentials.length} credential${credentials.length === 1 ? '' : 's'}`
              : status === 'booting'
                ? 'Booting runtime…'
                : status === 'error'
                  ? 'Runtime error'
                  : 'Idle'}
          </Badge>
        </div>
      </FadeIn>

      {status === 'error' && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Could not start the circuit simulator: {bootError}</span>
        </div>
      )}

      {status === 'booting' || status === 'idle' ? (
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} variant="glass" className="h-52 animate-pulse bg-white/[0.03]" />
          ))}
        </div>
      ) : (
        <StaggerChildren stagger={0.1}>
          <div className="grid gap-5 md:grid-cols-2">
            {credentials.map((credential) => (
              <StaggerItem key={credential.disclosure.id}>
                <CredentialCard credential={credential} onProve={() => openProof(credential)} />
              </StaggerItem>
            ))}
          </div>
        </StaggerChildren>
      )}

      <Modal
        open={Boolean(proving)}
        onClose={closeProof}
        title="Generate zero-knowledge proof"
        description={proving ? `${proving.headline} · ${proving.credentialType}` : ''}
      >
        {proving && (
          <div className="space-y-5">
            {!artifact && (
              <>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                    Choose a claim
                  </p>
                  <div className="space-y-2">
                    {claimOptionsFor(proving.credentialType).map((option) => {
                      const selected = claim?.kind === option.kind;
                      return (
                        <button
                          key={option.kind}
                          onClick={() => setClaim(option)}
                          disabled={busy}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                            selected
                              ? 'border-violet-400/40 bg-violet-400/5'
                              : 'border-white/8 hover:border-white/15',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border',
                              selected ? 'border-violet-300 bg-violet-400' : 'border-slate-600',
                            )}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-200">
                              {describeClaim(option)}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-slate-500">
                              {option.kind}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    What the verifier receives
                  </p>
                  <p className="hash-block text-xs text-cyan-300">{'{ proofValid: boolean }'}</p>
                  <div className="mt-2 space-y-1">
                    {['Name', 'Degree', 'CGPA', 'Date of birth'].map((item) => (
                      <div key={item} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-500">
                          <EyeOff className="h-3 w-3" aria-hidden /> {item}
                        </span>
                        <span className="hash-block text-slate-600">[PRIVATE]</span>
                      </div>
                    ))}
                  </div>
                </div>

                {proofError && (
                  <p className="text-xs text-rose-400">{proofError}</p>
                )}
              </>
            )}

            {artifact && (
              <ProofResult artifact={artifact} />
            )}

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={closeProof}>
                {artifact ? 'Close' : 'Cancel'}
              </Button>
              {!artifact ? (
                <Button size="sm" loading={busy} disabled={!claim} onClick={() => void runProof()}>
                  <Fingerprint className="h-4 w-4" aria-hidden />
                  Prove in circuit
                </Button>
              ) : (
                <Link to="/verifier">
                  <Button size="sm" variant="secondary">
                    Verify it
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ProofResult({ artifact }: { artifact: ProofArtifact }) {
  return (
    <div className="space-y-4">
      <div
        className={cn(
          'rounded-xl border p-4 text-center',
          artifact.proofValid
            ? 'border-cyan-400/30 bg-cyan-400/5'
            : 'border-rose-500/30 bg-rose-500/5',
        )}
      >
        <ShieldCheck
          className={cn(
            'mx-auto mb-2 h-7 w-7',
            artifact.proofValid ? 'text-cyan-300' : 'text-rose-400',
          )}
          aria-hidden
        />
        <p className="hash-block text-sm text-white">
          {'{ proofValid: '}
          <span className={artifact.proofValid ? 'text-cyan-300' : 'text-rose-400'}>
            {String(artifact.proofValid)}
          </span>
          {' }'}
        </p>
        {!artifact.proofValid && artifact.failureReason && (
          <p className="mt-2 text-xs text-rose-300">{artifact.failureReason}</p>
        )}
      </div>

      <div className="space-y-1.5 rounded-xl border border-white/6 bg-white/[0.02] p-3">
        <MetaRow label="claim">{artifact.claim}</MetaRow>
        <MetaRow label="engine">
          <span className="hash-block text-amber-300">{artifact.engine}</span>
        </MetaRow>
        <MetaRow label="zk-proven">
          <span className={artifact.zkProven ? 'text-cyan-300' : 'text-slate-400'}>
            {String(artifact.zkProven)}
          </span>
        </MetaRow>
        <MetaRow label="circuit">
          <span className="hash-block text-slate-300">{artifact.timings.totalMs.toFixed(1)} ms</span>
        </MetaRow>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-slate-500">binding</span>
          <CopyableHash value={artifact.binding} length="short" />
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-500">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        Only this public boolean is shared. The payload, salt and issuer signature never left
        the browser.
      </p>
    </div>
  );
}

function CredentialCard({
  credential,
  onProve,
}: {
  credential: HolderCredentialView;
  onProve: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const typeIcon = credential.credentialType === 'id' ? '🪪' : credential.credentialType === 'license' ? '📜' : '🎓';

  return (
    <Card variant="glass" interactive className="overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500/50 via-fuchsia-500/30 to-transparent" />
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/6 text-xl"
              aria-hidden
            >
              {typeIcon}
            </span>
            <div>
              <p className="font-semibold text-white">{credential.holderName}</p>
              <p className="text-xs capitalize text-slate-400">
                {credential.credentialType} credential
              </p>
            </div>
          </div>
          <Badge status={credential.revoked ? 'revoked' : 'verified'}>
            {credential.revoked ? 'Revoked' : 'Active'}
          </Badge>
        </div>

        <div className="space-y-2 rounded-xl border border-white/6 bg-white/[0.02] p-3">
          <Row label="Credential">{credential.headline}</Row>
          <Row label="Grade">
            <span className="flex items-center gap-1.5">
              {showDetails ? credential.grade : '••••'}
              <button
                onClick={() => setShowDetails((v) => !v)}
                aria-label={showDetails ? 'Hide details' : 'Show details'}
                className="text-slate-500 transition-colors hover:text-slate-300"
              >
                {showDetails ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </span>
          </Row>
          <Row label="Issued">
            <span className="text-slate-400">
              {new Date(credential.issuedAt * 1000).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </Row>
        </div>

        <div className="flex items-center justify-between">
          <CopyableHash value={credential.disclosure.id} length="short" />
          <Button size="sm" onClick={onProve} disabled={credential.revoked}>
            <Fingerprint className="h-4 w-4" aria-hidden />
            Generate proof
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-sm text-slate-200">{children}</span>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-300">{children}</span>
    </div>
  );
}
