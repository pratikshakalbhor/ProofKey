import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (title: string, options?: { description?: string; tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneConfig: Record<
  ToastTone,
  { icon: React.ReactNode; classes: string; bar: string }
> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-cyan-400" />,
    classes: 'border-cyan-400/20',
    bar: 'bg-cyan-400',
  },
  error: {
    icon: <XCircle className="h-5 w-5 text-rose-400" />,
    classes: 'border-rose-500/20',
    bar: 'bg-rose-500',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
    classes: 'border-amber-400/20',
    bar: 'bg-amber-400',
  },
  info: {
    icon: <Info className="h-5 w-5 text-indigo-400" />,
    classes: 'border-indigo-400/20',
    bar: 'bg-indigo-400',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue['toast']>(
    (title, options) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, title, description: options?.description, tone: options?.tone ?? 'info' }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[360px] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const config = toneConfig[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                className={cn(
                  'glass relative pointer-events-auto overflow-hidden rounded-xl p-4 pr-10',
                  config.classes,
                )}
                role="status"
              >
                <div className={cn('absolute left-0 top-0 h-full w-0.5', config.bar)} />
                <div className="flex gap-3">
                  <span className="mt-0.5 shrink-0">{config.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{t.title}</p>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-slate-400">{t.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="absolute right-2.5 top-2.5 rounded-md p-1 text-slate-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}