import { type HTMLMotionProps, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StaggerChildrenProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  stagger?: number;
  delayChildren?: number;
  className?: string;
}

export function StaggerChildren({
  children,
  stagger = 0.08,
  delayChildren = 0.05,
  className,
  ...props
}: StaggerChildrenProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={{
        hidden: {},
        visible: reduceMotion
          ? {}
          : { transition: { staggerChildren: stagger, delayChildren } },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
}

const directionOffset: Record<NonNullable<StaggerItemProps['direction']>, { x: number; y: number }> = {
  up: { x: 0, y: 24 },
  down: { x: 0, y: -24 },
  left: { x: 24, y: 0 },
  right: { x: -24, y: 0 },
};

export function StaggerItem({ children, direction = 'up', className, ...props }: StaggerItemProps) {
  const reduceMotion = useReducedMotion();
  const offset = reduceMotion ? { x: 0, y: 0 } : directionOffset[direction];
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, ...offset },
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
          transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}