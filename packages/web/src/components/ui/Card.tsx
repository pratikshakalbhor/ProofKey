import { useMemo, type HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type CardVariant = 'default' | 'glass' | 'verified' | 'revoked' | 'pending';

type MotionDivProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'
>;

interface CardProps extends MotionDivProps {
  variant?: CardVariant;
  interactive?: boolean;
  glow?: boolean;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-base-100 border border-white/8 rounded-xl',
  glass: 'glass glass-interactive rounded-2xl',
  verified:
    'glass glass-interactive rounded-2xl border-cyan-400/30 shadow-[0_0_30px_rgba(34,211,238,0.08)]',
  revoked:
    'glass glass-interactive rounded-2xl border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.08)]',
  pending:
    'glass glass-interactive rounded-2xl border-amber-400/30 shadow-[0_0_30px_rgba(251,191,36,0.08)]',
};

export function Card({
  className,
  variant = 'default',
  interactive = false,
  glow = false,
  children,
  ...props
}: CardProps) {
  const glowStyle = useMemo(
    () =>
      glow
        ? {
            boxShadow:
              '0 0 40px rgba(139, 92, 246, 0.12), 0 8px 32px rgba(0, 0, 0, 0.4)',
          }
        : undefined,
    [glow],
  );

  return (
    <motion.div
      initial={interactive ? { y: 0 } : undefined}
      whileHover={interactive ? { y: -4 } : undefined}
      className={cn(variantClasses[variant], interactive && 'cursor-pointer', className)}
      style={glowStyle}
      {...props}
    >
      {children}
    </motion.div>
  );
}