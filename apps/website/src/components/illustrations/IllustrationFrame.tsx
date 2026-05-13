import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

/* Width caps tuned so the illustration carries proportional visual weight
 * against headlines and copy alongside it.
 *
 * sm = 48rem  = 768px (side-by-side: hero, contact)
 * md = 72rem  = 1152px (default full-width inserts)
 * lg = 88rem  = 1408px (wide horizontal flow diagrams)
 */
const widths: Record<Size, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-6xl',
  lg: 'max-w-[88rem]',
};

export function IllustrationFrame({
  children,
  size = 'md',
  className,
}: {
  children: ReactNode;
  size?: Size;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full', widths[size], className)}>
      {children}
    </div>
  );
}
