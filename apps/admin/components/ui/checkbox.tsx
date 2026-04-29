import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Native checkbox wrapper. Native chosen over @radix-ui/react-checkbox
 * to avoid adding a runtime dependency for this slice; Radix can be
 * swapped in later if richer state visuals are needed.
 */
export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'h-4 w-4 shrink-0 cursor-pointer rounded border border-input bg-background text-primary',
          'transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
