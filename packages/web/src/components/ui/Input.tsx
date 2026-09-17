import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type FieldWrapperProps = {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

function FieldWrapper({ label, hint, error, className = '', children }: FieldWrapperProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </span>
      )}
      {children}
      {(hint || error) && (
        <span className={cn('text-xs', error ? 'text-rose-400' : 'text-slate-500')}>
          {error ?? hint}
        </span>
      )}
    </label>
  );
}

const inputBaseClasses =
  'w-full rounded-xl border bg-base-100/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:outline-none focus-ring';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leftIcon, ...props }, ref) => (
    <FieldWrapper label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            inputBaseClasses,
            leftIcon && 'pl-10',
            error ? 'border-rose-500/40' : 'border-white/8 hover:border-white/15',
            'focus:border-indigo-400/50',
          )}
          {...props}
        />
      </div>
    </FieldWrapper>
  ),
);
Input.displayName = 'Input';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hint, error, children, ...props }, ref) => (
    <FieldWrapper label={label} hint={hint} error={error} className={className}>
      <select
        ref={ref}
        className={cn(
          inputBaseClasses,
          'appearance-none cursor-pointer',
          error ? 'border-rose-500/40' : 'border-white/8 hover:border-white/15',
          'focus:border-indigo-400/50',
        )}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  ),
);
Select.displayName = 'Select';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, ...props }, ref) => (
    <FieldWrapper label={label} hint={hint} error={error} className={className}>
      <textarea
        ref={ref}
        className={cn(
          inputBaseClasses,
          'min-h-[90px] resize-y',
          error ? 'border-rose-500/40' : 'border-white/8 hover:border-white/15',
          'focus:border-indigo-400/50',
        )}
        {...props}
      />
    </FieldWrapper>
  ),
);
Textarea.displayName = 'Textarea';