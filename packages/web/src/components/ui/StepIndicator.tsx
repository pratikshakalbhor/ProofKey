import { Fragment } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  current: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function StepIndicator({ steps, current, onStepClick, className }: StepIndicatorProps) {
  return (
    <ol
      className={cn('flex items-center gap-2', className)}
      aria-label="Progress"
    >
      {steps.map((step, index) => {
        const completed = index < current;
        const active = index === current;
        return (
          <Fragment key={step.id}>
            {index > 0 && (
              <motion.div
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-colors',
                  completed ? 'bg-indigo-400' : 'bg-white/8',
                )}
                animate={{ backgroundColor: completed ? '#818cf8' : 'rgba(255,255,255,0.08)' }}
              />
            )}
            <motion.button
              type="button"
              onClick={() => onStepClick?.(index)}
              disabled={!onStepClick}
              className="group flex flex-col items-center gap-2"
              whileHover={{ y: -2 }}
            >
              <motion.span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  active && 'border-indigo-400 bg-indigo-500/20 text-indigo-300',
                  completed && 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300',
                  !active && !completed && 'border-white/10 text-slate-500 group-hover:border-white/20',
                )}
                animate={
                  active
                    ? { scale: [1, 1.12, 1] }
                    : completed
                      ? { backgroundColor: 'rgba(34,211,238,0.1)' }
                      : undefined
                }
                transition={{ duration: 0.4 }}
              >
                {completed ? '✓' : index + 1}
              </motion.span>
              <span
                className={cn(
                  'text-xs',
                  active ? 'font-medium text-indigo-300' : 'text-slate-500',
                  completed && 'text-cyan-300/80',
                )}
              >
                {step.label}
              </span>
            </motion.button>
          </Fragment>
        );
      })}
    </ol>
  );
}