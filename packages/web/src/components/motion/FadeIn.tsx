import { type HTMLMotionProps, motion } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface FadeInProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
}

export function FadeIn({ children, delay = 0, duration = 0.5, y = 16, ...props }: FadeInProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}