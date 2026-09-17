import { useEffect, useState } from 'react';
import { ScanSearch, Lock, ShieldCheck, Clock, ArrowLeft, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ProofArtifact } from '@verishield/shared';
import { PortalShell } from '@/components/layout/PortalShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CopyableHash } from '@/components/ui/CopyableHash';
import { useToast } from '@/components/ui/Toast';
import { useProofStore } from '@/stores/proofStore';
import { describeClaim } from '@/lib/midnight/claims';
import type { VerifyProofResult } from '@verishield/shared/sdk';
import { cn } from '@/lib/utils';

type VerifyPhase = 'idle' | 'verifying' | 'complete';

interface VerifyLogEntry {
  message: string;
  detail?: string;
  tone: 'info' | 'success' | 'error';
}

const sharedRows = ['Full name', 'Roll number', 'Marks / CGPA', 'Date of birth', 'Issuer details'];

export function VerifierPortal() {
  return (
    <PortalShell
      role="verifier"
      title="Verifier Console"
      description="Submit a proof and get exactly one boolean back. No personal data is ever transmitted."
      accent="cyan"
    >
      <VerifierPanel />
    </PortalShell>
  );
}

function VerifierPanel() {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const artifacts = useProofStore((s) => s.artifacts);
  const ledger = useProofStore((s) => s.ledger);
  const verifyProof = useProofStore((s) => s.verifyProof);
  const boot = useProofStore((s) => s.boot);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<VerifyPhase>('idle');
  const [log, setLog] = useState<VerifyLogEntry[]>([]);
  const [result, setResult] = useState<VerifyProofResult | null>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  const selected = selectedIndex === null ? null : artifacts[selectedIndex] ?? null;

  const runVerification = async () => {
    if (!selected) {
      toast('Select a proof', { description: 'No proof artifact selected.', tone: 'error' });
      return;
    }
    const artifact: ProofArtifact = selected;
    setPhase('verifying');
    setLog([]);
    setResult(null);

    const verified = await verifyProof(artifact, { claim: artifact.claim });

    const steps: VerifyLogEntry[] = [
      { message: 'Parsing proof artifact', detail: `artifact v${artifact.version} · ${artifact.claim}`, tone: 'info' },
      { message: 'Recomputing binding digest', detail: `binding ${artifact.binding.slice(0, 12)}…`, tone: 'info' },
      { message: 'Verifying ZK proof against issuer key', detail: `engine: ${artifact.engine}`, tone: 'info' },
      {
        message: verified.valid ? 'Proof accepted' : 'Proof rejected',
        detail: verified.reason ?? 'structural checks passed',
        tone: verified.valid ? 'success' : 'error',
      },
      { message: 'Public output extracted', detail: 'single field: proofValid', tone: 'success' },
    ];

    steps.forEach((entry, i) => {
      window.setTimeout(
        () => {
          setLog((prev) => [...prev, entry]);
          if (i === steps.length - 1) {
            setResult(verified);
            setPhase('complete');
          }
        },
        250 + i * 420,
      );
    });

    toast('Verification started', {
      description: `Checking ${artifact.claim} proof`,
      tone: 'info',
    });
  };

  const resetPanel = () => {
    setPhase('idle');
    setLog([]);
    setResult(null);
    setSelectedIndex(null);
  };

  return (
    <div className="space-y-8">
      <FadeInMaybe>
        <Card variant="glass" className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Proof artifact
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    aria-hidden
                  />
                  <select
                    value={selectedIndex ?? ''}
                    onChange={(e) => setSelectedIndex(e.target.value === '' ? null : Number(e.target.value))}
                    disabled={artifacts.length === 0}
                    className="w-full appearance-none rounded-xl border border-white/8 bg-base-100/60 py-3 pl-10 pr-3 text-sm text-white focus:border-cyan-400/40 focus:outline-none focus-ring disabled:opacity-50"
                    aria-label="Select proof artifact to verify"
                  >
                    <option value="" disabled>
                      {artifacts.length === 0 ? 'No proofs available…' : 'Select a proof to verify…'}
                    </option>
                    {artifacts.map((artifact, index) => (
                      <option key={`${artifact.binding}-${index}`} value={index}>
                        {describeClaim({ kind: artifact.claim })} · {artifact.claim} ·{' '}
                        {artifact.proofValid ? 'valid' : 'invalid'}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={() => void runVerification()}
                  disabled={!selected || phase === 'verifying'}
                  loading={phase === 'verifying'}
                >
                  <ScanSearch className="h-4 w-4" aria-hidden />
                  Verify
                </Button>
              </div>
              {artifacts.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Generate a proof in the Holder portal — it appears here automatically.
                </p>
              )}
            </div>
            {phase === 'complete' && (
              <Button variant="ghost" size="sm" onClick={resetPanel} className="shrink-0">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                New verification
              </Button>
            )}
          </div>
        </Card>
      </FadeInMaybe>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Result reveal — THE DEMO MOMENT */}
        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/8 bg-base-100/40">
          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div
                key="idle"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 p-8 text-center"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/5 bg-white/[0.03]">
                  <ShieldCheck className="h-9 w-9 text-slate-600" aria-hidden />
                </div>
                <div>
                  <p className="text-base font-medium text-slate-300">Awaiting a proof</p>
                  <p className="mt-1 max-w-xs text-sm text-slate-500">
                    Select a proof above. The result will reveal exactly one value — nothing more.
                  </p>
                </div>
              </motion.div>
            )}

            {phase === 'verifying' && (
              <motion.div
                key="verifying"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                className="flex h-full min-h-[420px] flex-col items-center justify-center gap-5 p-8"
              >
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-cyan-400/20 border-t-cyan-400"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                  />
                  <ScanSearch className="h-7 w-7 text-cyan-300" aria-hidden />
                </div>
                <div className="text-center">
                  <p className="hash-block text-sm text-cyan-200">verifying…</p>
                  <p className="mt-1 text-xs text-slate-500">
                    The artifact is checked against the issuer's registered verifying key.
                  </p>
                </div>
              </motion.div>
            )}

            {phase === 'complete' && result && (
              <motion.div
                key="complete"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                className="flex h-full flex-col p-8"
              >
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <motion.div
                    initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 170 }}
                    className={cn(
                      'relative rounded-2xl border px-8 py-6',
                      result.valid
                        ? 'border-cyan-400/30 bg-cyan-400/5 shadow-[0_0_60px_rgba(34,211,238,0.15)]'
                        : 'border-rose-500/30 bg-rose-500/5 shadow-[0_0_60px_rgba(244,63,94,0.12)]',
                    )}
                  >
                    <motion.span
                      className={cn(
                        'mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full',
                        result.valid ? 'bg-cyan-400/15 text-cyan-300' : 'bg-rose-500/15 text-rose-400',
                      )}
                      animate={result.valid ? { scale: [1, 1.12, 1] } : undefined}
                      transition={
                        result.valid ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : undefined
                      }
                    >
                      <ShieldCheck className="h-7 w-7" aria-hidden />
                    </motion.span>
                    <p className="hash-block text-lg text-white">
                      {'{ '}proofValid:{' '}
                      <span className={result.valid ? 'text-cyan-300' : 'text-rose-400'}>
                        {String(result.valid)}
                      </span>
                      {' }'}
                    </p>
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className={cn(
                        'mt-3 text-xs uppercase tracking-[0.2em]',
                        result.valid ? 'text-cyan-400/80' : 'text-rose-400/80',
                      )}
                    >
                      {result.valid ? 'Claim verified' : result.reason ?? 'Claim rejected'}
                    </motion.p>
                  </motion.div>

                  {selected && (
                    <div className="mt-8 w-full max-w-sm rounded-xl border border-white/6 bg-white/[0.02] p-3 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Verified proof metadata
                      </p>
                      <div className="mt-2 space-y-1.5">
                        <MetaRow label="claim">{selected.claim}</MetaRow>
                        <MetaRow label="engine">
                          <span className="hash-block text-amber-300">{selected.engine}</span>
                        </MetaRow>
                        <MetaRow label="zk-proven">{String(selected.zkProven)}</MetaRow>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-slate-500">binding</span>
                          <CopyableHash value={selected.binding} length="short" />
                        </div>
                      </div>
                    </div>
                  )}

                  {!selected?.zkProven && (
                    <p className="mt-4 flex items-center gap-1.5 text-xs text-amber-300/80">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      Circuit-simulator transcript. A proof server is required for a real SNARK.
                    </p>
                  )}

                  <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="h-3 w-3" aria-hidden />
                    That&apos;s the entire payload — one boolean.
                  </p>
                </div>

                {result.valid && (
                  <div className="mt-8 overflow-hidden rounded-xl border border-white/6">
                    <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-3 py-2 text-xs font-medium text-slate-300">
                      <Lock className="h-3 w-3 text-slate-500" aria-hidden />
                      Not transmitted
                    </div>
                    <div className="grid gap-px sm:grid-cols-2">
                      {sharedRows.map((row, i) => (
                        <motion.div
                          key={row}
                          initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.9 + i * 0.12 }}
                          className="flex items-center justify-between bg-base px-3 py-2 text-xs"
                        >
                          <span className="text-slate-500">{row}</span>
                          <span className="hash-block text-slate-600">[REDACTED]</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Verification log */}
        <div className="flex flex-col gap-4">
          <Card variant="glass" className="flex-1 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Verification log
              </span>
            </div>
            <div className="hash-block max-h-[420px] space-y-0 p-4">
              {log.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-600">
                  No verification has been run yet.
                </p>
              ) : (
                log.map((entry, i) => (
                  <motion.div
                    key={i}
                    initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-3 border-b border-white/[0.03] py-2.5 last:border-0"
                  >
                    <span
                      className={cn(
                        'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                        entry.tone === 'success' && 'bg-cyan-400',
                        entry.tone === 'error' && 'bg-rose-500',
                        entry.tone === 'info' && 'bg-slate-500',
                      )}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-xs',
                          entry.tone === 'success' && 'text-emerald-300',
                          entry.tone === 'error' && 'text-rose-300',
                          entry.tone === 'info' && 'text-slate-300',
                        )}
                      >
                        {entry.message}
                      </p>
                      {entry.detail && (
                        <p className="mt-0.5 text-[10px] text-slate-500">{entry.detail}</p>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>

          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
              <div>
                <p className="text-sm font-medium text-cyan-200">Zero-knowledge guarantee</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  This console proves a claim without access to name, roll number, marks, or date
                  of birth. The only field returned by the verifier contract is{' '}
                  <span className="hash-block text-cyan-300">proofValid</span>.
                </p>
                {ledger && (
                  <p className="mt-2 text-[10px] text-slate-500">
                    simulator ledger · verifications: {ledger.verificationCount} · last:{' '}
                    {String(ledger.lastProofValid)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FadeInMaybe({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
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
