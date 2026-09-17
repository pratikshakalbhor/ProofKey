import { Link } from 'react-router-dom';
import {
  GraduationCap,
  ShieldCheck,
  ScanSearch,
  Lock,
  ArrowRight,
  Fingerprint,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { StaggerChildren, StaggerItem, FadeIn, SlideUp } from '@/components/motion';
import { Card } from '@/components/ui/Card';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const roleCards = [
  {
    title: "I'm an Issuer",
    description:
      'Universities, regulators, and agencies sign credentials and anchor them on-chain. Grant, revoke, and audit — all while keeping full records.',
    icon: GraduationCap,
    path: '/issuer',
    gradient: 'from-indigo-500/20 to-violet-500/10',
    accent: 'text-indigo-300 group-hover:shadow-indigo-500/20',
    badge: 'PUBLISH CREDENTIALS',
  },
  {
    title: "I'm a Holder",
    description:
      'Students and professionals hold their credentials privately in their wallet. Generate zero-knowledge proofs of individual claims — without sharing everything.',
    icon: ShieldCheck,
    path: '/holder',
    gradient: 'from-violet-500/20 to-fuchsia-500/10',
    accent: 'text-violet-300 group-hover:shadow-violet-500/20',
    badge: 'PROVE CLAIMS',
  },
  {
    title: "I'm a Verifier",
    description:
      'Employers, banks, and visa officers check a proof on-chain. They receive one thing and one thing only: a boolean. Nothing else.',
    icon: ScanSearch,
    path: '/verifier',
    gradient: 'from-cyan-500/20 to-teal-500/10',
    accent: 'text-cyan-300 group-hover:shadow-cyan-500/20',
    badge: 'VERIFY TRUST',
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'Issuer anchors',
    description:
      'The university signs a credential and anchors its public key and commitment on the Midnight ledger.',
    icon: GraduationCap,
  },
  {
    step: '02',
    title: 'Holder proves',
    description:
      'In the wallet, the student generates a ZK proof of a single claim — "I hold a bachelor\u2019s degree." The math shows it, the data stays hidden.',
    icon: Fingerprint,
  },
  {
    step: '03',
    title: 'Verifier checks',
    description:
      'The employer submits the proof to a verifier contract. It returns { proofValid: true } — and nothing else.',
    icon: ScanSearch,
  },
];

export function LandingPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mesh-gradient relative min-h-screen overflow-hidden">
      {/* Ambient floating orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-[15%] top-[12%] h-40 w-40 rounded-full bg-indigo-600/20 blur-3xl animate-glow-pulse" />
        <div className="absolute right-[22%] top-[20%] h-32 w-32 rounded-full bg-violet-600/20 blur-3xl animate-glow-pulse animation-delay-200" />
        <div className="absolute bottom-[15%] left-[30%] h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl animate-glow-pulse animation-delay-400" />
        <div className="absolute bottom-[5%] right-[10%] h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl animate-glow-pulse animation-delay-300" />
      </div>

      {/* Floating particles */}
      {!reduceMotion && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-indigo-400/40"
              style={{
                left: `${(i * 37) % 100}%`,
                top: `${(i * 23) % 100}%`,
              }}
              animate={{ y: [0, -18, 0], opacity: [0.2, 0.7, 0.2] }}
              transition={{
                duration: 5 + (i % 5),
                repeat: Infinity,
                delay: i * 0.4,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        {/* Header */}
        <FadeIn y={-8}>
          <header className="flex items-center justify-between py-6">
            <Link to="/" className="group flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/50 transition-transform group-hover:scale-105">
                <Lock className="h-5 w-5 text-white" />
              </span>
              <span className="text-lg font-bold tracking-tight text-white">
                Veri<span className="text-gradient-primary">Shield</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
              <a href="#how" className="transition-colors hover:text-white">
                How it works
              </a>
              <a href="#roles" className="transition-colors hover:text-white">
                Choose a role
              </a>
            </nav>
            <Sparkles className="h-4 w-4 text-slate-500" aria-hidden />
          </header>
        </FadeIn>

        {/* Hero */}
        <section className="flex flex-1 flex-col items-center justify-center pt-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-indigo-300"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
            Zero-knowledge credentials on Midnight
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl text-5xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            Prove it.{' '}
            <span className="text-gradient-primary">Don&apos;t show it.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg"
          >
            Today, proving a credential means handing over your entire
            degree — name, marks, everything. VeriShield lets you prove a
            single fact with a{' '}
            <span className="text-slate-200">zero-knowledge proof</span>.
            The verifier sees one boolean. Nothing else.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.34 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <a
              href="#roles"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-sm font-semibold text-white shadow-xl shadow-indigo-950/50 transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-900/50"
            >
              Enter the demo
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#how"
              className="glass glass-interactive inline-flex h-12 items-center gap-2 rounded-xl px-6 text-sm font-medium text-slate-200"
            >
              How it works
            </a>
          </motion.div>

          {/* Animated proof snippet */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-14 w-full max-w-md"
          >
            <div className="glass overflow-hidden rounded-xl">
              <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                <span className="ml-2 text-xs text-slate-500">verifier_console</span>
              </div>
              <div className="px-4 py-3 text-left">
                {reduceMotion ? (
                  <>
                    <p className="hash-block text-xs text-slate-400">
                      &gt; verify_proof(cred_bsc_2025)
                    </p>
                    <p className="mt-1 hash-block text-xs text-cyan-400">
                      {'{ proofValid: true }'}
                    </p>
                  </>
                ) : (
                  <>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.9 }}
                      className="hash-block text-xs text-slate-400"
                    >
                      &gt; verify_proof(cred_bsc_2025)
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.3 }}
                      className="mt-1 hash-block text-xs text-cyan-400"
                    >
                      {'{ '}proofValid:{' '}
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.7 }}
                      >
                        true
                      </motion.span>
                      {' }'}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 2.1 }}
                      className="mt-1 hash-block text-[10px] text-slate-600"
                    >
                      # name, marks, DOB: not transmitted
                    </motion.p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </section>
      </div>

      {/* How it works */}
      <section id="how" className="relative z-10 border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SlideUp>
            <div className="mb-12 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400">
                The flow
              </span>
              <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                Three actors. One boolean.
              </h2>
            </div>
          </SlideUp>
          <StaggerChildren stagger={0.15}>
            <div className="grid gap-6 md:grid-cols-3">
              {howItWorks.map((item) => (
                <StaggerItem key={item.step}>
                  <div className="group relative flex h-full flex-col rounded-2xl border border-white/6 bg-white/[0.02] p-6 transition-colors hover:border-indigo-400/25">
                    <span className="hash-block text-xs text-slate-600">
                      {item.step}
                    </span>
                    <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/4 text-slate-500 transition-colors group-hover:bg-indigo-500/15 group-hover:text-indigo-300">
                      <item.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {item.description}
                    </p>
                    <div className="mt-auto pt-4">
                      <div className="h-1 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400/30 transition-all duration-300 group-hover:w-16 group-hover:to-indigo-400" />
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </div>
          </StaggerChildren>
        </div>
      </section>

      {/* Role cards */}
      <section id="roles" className="relative z-10 pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <SlideUp>
            <div className="mb-12 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400">
                Get started
              </span>
              <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                Choose your role
              </h2>
            </div>
          </SlideUp>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={containerVariants}
            className="grid gap-6 md:grid-cols-3"
          >
            {roleCards.map((role) => (
              <motion.div key={role.title} variants={itemVariants}>
                <Link to={role.path} className="block h-full">
                  <Card
                    interactive
                    className={`group relative flex h-full flex-col overflow-hidden bg-gradient-to-br p-7 ${role.gradient}`}
                  >
                    {/* hover glow */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                    />
                    <div className="flex items-start justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-slate-300 transition-colors group-hover:text-white">
                        <role.icon className="h-6 w-6" aria-hidden />
                      </span>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition-colors group-hover:border-indigo-400/30 group-hover:text-indigo-300">
                        {role.badge}
                      </span>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-white transition-colors group-hover:text-indigo-200">
                      {role.title}
                    </h3>
                    <p className="mt-2.5 flex-1 text-sm leading-relaxed text-slate-400">
                      {role.description}
                    </p>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors group-hover:text-indigo-300">
                      Enter portal
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            VeriShield — a zero-knowledge credential demo
          </div>
          <div className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-slate-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
            </span>
            Built on Midnight
          </div>
        </div>
      </footer>
    </div>
  );
}