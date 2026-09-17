import type { HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BadgeStatus = 'verified' | 'revoked' | 'pending' | 'neutral';

type MotionSpanProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'
>;

interface BadgeProps extends MotionSpanProps {
  status?: BadgeStatus;
  icon?: React.ReactNode;
  pulse?: boolean;
}

const statusConfig: Record<
  BadgeStatus,
  { classes: string; Icon: typeof Circle; dot: string }
> = {
  verified: {
    classes:
      'bg-cyan-400/10 text-cyan-300 border-cyan-400/20',
    Icon: CheckCircle2,
    dot: 'bg-cyan-400',
  },
  revoked: {
    classes: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    Icon: XCircle,
    dot: 'bg-rose-500',
  },
  pending: {
    classes: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
    Icon: Clock,
    dot: 'bg-amber-400',
  },
  neutral: {
    classes: 'bg-white/5 text-slate-300 border-white/10',
    Icon: Circle,
    dot: 'bg-slate-400',
  },
};

export function Badge({
  className,
  status = 'neutral',
  icon,
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  const config = statusConfig[status];
  const { Icon } = config;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-xs font-medium',
        config.classes,
        className,
      )}
      {...props}
    >
      {icon ?? (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <motion.span
              className={cn('absolute inline-flex h-full w-full rounded-full opacity-75', config.dot)}
              animate={{ scale: [1, 2.2], opacity: [0.75, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', config.dot)} />
        </span>
      )}
      {children}
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </motion.span>
  );
}