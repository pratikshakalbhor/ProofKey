import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ShimmerBorderProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  color?: string;
  active?: boolean;
}

export function ShimmerBorder({
  children,
  color = 'rgba(139, 92, 246, 0.5)',
  active = false,
  className,
  ...props
}: ShimmerBorderProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)} {...props}>
      {active && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(115deg, transparent 30%, ${color} 50%, transparent 70%)`,
            backgroundSize: '300% 100%',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            padding: 1,
            animation: 'shimmer 2.5s linear infinite',
          }}
        />
      )}
      {children}
    </div>
  );
}