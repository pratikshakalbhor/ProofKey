import { type HTMLMotionProps, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScaleOnHoverProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}

export function ScaleOnHover({
  children,
  scale = 1.03,
  className,
  ...props
}: ScaleOnHoverProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { scale, y: -4 }}
      whileTap={reduceMotion ? undefined : { scale: scale - 0.01 }}
      transition={{ type: 'spring', damping: 22, stiffness: 340 }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}