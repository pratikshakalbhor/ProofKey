import { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn, truncateMiddle } from '@/lib/utils';

interface CopyableHashProps {
  value: string;
  length?: 'full' | 'medium' | 'short';
  label?: string;
  mono?: boolean;
  className?: string;
}

const truncation: Record<NonNullable<CopyableHashProps['length']>, number> = {
  full: 0,
  medium: 12,
  short: 5,
};

export function CopyableHash({
  value,
  length = 'medium',
  label,
  mono = true,
  className,
}: CopyableHashProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [value]);

  const display = truncation[length] > 0 ? truncateMiddle(value, truncation[length], 8) : value;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-base-100/60 px-2 py-1',
        mono && 'hash-block text-xs text-slate-300',
        className,
      )}
    >
      {label && <span className="text-slate-500">{label}</span>}
      <span className="select-all">{display}</span>
      <button
        onClick={handleCopy}
        className="rounded p-0.5 text-slate-500 transition-colors hover:text-cyan-300"
        aria-label="Copy to clipboard"
        title="Copy to clipboard"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}