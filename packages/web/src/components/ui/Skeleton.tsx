import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  rows?: number;
  variant?: 'text' | 'block' | 'circle';
}

export function Skeleton({ className, rows = 3, variant = 'block' }: SkeletonProps) {
  if (variant === 'circle') {
    return <div className={cn('animate-pulse rounded-full bg-white/6', className)} />;
  }

  if (variant === 'text') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded bg-white/6"
            style={{ width: `${100 - i * 15}%`, height: 8 }}
          />
        ))}
      </div>
    );
  }

  return <div className={cn('animate-pulse rounded-xl bg-white/6', className)} />;
}