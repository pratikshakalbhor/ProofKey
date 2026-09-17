import { type HTMLMotionProps, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SlideUpProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  once?: boolean;
}

export function SlideUp({
  children,
  delay = 0,
  distance = 24,
  once = true,
  className,
  ...props
}: SlideUpProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-80px' }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}