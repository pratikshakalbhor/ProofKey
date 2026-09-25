import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import { Lock, GraduationCap, ShieldCheck, ScanSearch, Menu, ChevronDown, ArrowLeft, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useRoleStore, type Role } from '@/stores/roleStore';
import { useNetworkStore } from '@/stores/networkStore';
import { NETWORK_LABELS } from '@verishield/shared';

interface PortalShellProps {
  role: Role;
  title: string;
  description: string;
  accent: 'indigo' | 'violet' | 'cyan';
  children: ReactNode;
}

const roleConfig: Record<
  Role,
  {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    textColor: string;
    ring: string;
  }
> = {
  issuer: {
    label: 'Issuer',
    path: '/issuer',
    icon: GraduationCap,
    color: 'from-indigo-500 to-violet-600',
    textColor: 'text-indigo-300',
    ring: 'ring-indigo-500/30',
  },
  holder: {
    label: 'Holder',
    path: '/holder',
    icon: ShieldCheck,
    color: 'from-violet-500 to-fuchsia-600',
    textColor: 'text-violet-300',
    ring: 'ring-violet-500/30',
  },
  verifier: {
    label: 'Verifier',
    path: '/verifier',
    icon: ScanSearch,
    color: 'from-cyan-500 to-teal-600',
    textColor: 'text-cyan-300',
    ring: 'ring-cyan-500/30',
  },
};

const accentClasses: Record<PortalShellProps['accent'], string> = {
  indigo: 'border-indigo-500/20',
  violet: 'border-violet-500/20',
  cyan: 'border-cyan-500/20',
};

const accentBar: Record<PortalShellProps['accent'], string> = {
  indigo: 'from-indigo-500/60',
  violet: 'from-violet-500/60',
  cyan: 'from-cyan-500/60',
};

export function PortalShell({ role, title, description, accent, children }: PortalShellProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const roleStore = useRoleStore();

  const config = roleConfig[role];

  const portals: Role[] = ['issuer', 'holder', 'verifier'];

  const switchRole = (next: Role) => {
    roleStore.setRole(next);
    navigate(roleConfig[next].path);
    setMenuOpen(false);
  };

  return (
    <div className="mesh-gradient min-h-screen">
      <div className="relative">
        {/* Top accent bar */}
        <div className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r via-transparent', accentBar[accent])} />

        {/* Top nav */}
        <header className="border-b border-white/5">
          <div className={cn('mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4', accentClasses[accent])}>
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-white/5"
                aria-label="Back to home"
              >
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white', config.color)}>
                  <Lock className="h-4 w-4" />
                </span>
                <span className="hidden text-sm font-bold text-white sm:block">
                  Veri<span className="text-gradient-primary">Shield</span>
                </span>
              </Link>

              <span className="hidden h-5 w-px bg-white/10 sm:block" />

              <div className="hidden items-center gap-1 sm:flex">
                {portals.map((p) => {
                  const pc = roleConfig[p];
                  const active = p === role;
                  return (
                    <button
                      key={p}
                      onClick={() => switchRole(p)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        active
                          ? cn('bg-white/8 text-white ring-1', pc.ring)
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                      )}
                    >
                      <pc.icon className="h-3.5 w-3.5" aria-hidden />
                      {pc.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NetworkIndicator />
              <div className="relative sm:hidden">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                  aria-label="Toggle role menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="glass absolute right-0 top-full z-50 mt-2 w-44 rounded-xl p-1.5 shadow-2xl"
                    >
                      {portals.map((p) => {
                        const pc = roleConfig[p];
                        return (
                          <button
                            key={p}
                            onClick={() => switchRole(p)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5"
                          >
                            <pc.icon className="h-4 w-4 text-slate-400" aria-hidden />
                            {pc.label}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Portal header */}
        <div className="mx-auto max-w-6xl px-6 pt-10">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              to="/"
              className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back to home
            </Link>
            <div className="flex items-start gap-4">
              <motion.span
                initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', damping: 16 }}
                className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-xl',
                  config.color,
                )}
              >
                <config.icon className="h-7 w-7" aria-hidden />
              </motion.span>
              <div>
                <h1 className="text-2xl font-bold text-white sm:text-3xl">
                  {title}
                </h1>
                <p className="mt-1 max-w-xl text-sm text-slate-400">{description}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Content */}
        <main className="mx-auto max-w-6xl px-6 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={role}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mx-auto max-w-6xl px-6 pb-8 pt-4">
          <div className="flex items-center justify-between border-t border-white/5 pt-6 text-xs text-slate-500">
            <span>VeriShield — Zero-knowledge credentials demo</span>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          </div>
        </footer>
      </div>
    </div>
  );
}

function NetworkIndicator() {
  const { network, connect } = useNetworkStore();
  const status = network.status;
  return (
    <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
      <button
        onClick={status === 'disconnected' ? connect : undefined}
        className="flex items-center gap-2 text-xs font-medium text-slate-300"
        title={`${network.name} · live Preprod indexer`}
      >
        <span className="relative flex h-1.5 w-1.5">
          {status === 'connecting' && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          )}
          <span
            className={cn(
              'relative inline-flex h-1.5 w-1.5 rounded-full',
              status === 'connected' && 'bg-cyan-400',
              status === 'connecting' && 'bg-amber-400',
              status === 'disconnected' && 'bg-slate-500',
            )}
          />
        </span>
        {network.name in NETWORK_LABELS
          ? NETWORK_LABELS[network.name as keyof typeof NETWORK_LABELS]
          : network.label}
        <ChevronDown className="h-3 w-3 text-slate-500" aria-hidden />
      </button>
    </div>
  );
}