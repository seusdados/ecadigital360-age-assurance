import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

/* Width caps after the round of "um pouco maior" feedback. The bumps keep
 * internal SVG text comfortably above the 11px effective render mark while
 * giving illustrations more visual presence in their sections.
 *
 * sm = 42rem  = 672px (side-by-side columns: hero, contact, etc.)
 * md = 60rem  = 960px (default for full-width inserts)
 * lg = 72rem  = 1152px (wide horizontal flow diagrams)
 */
const widths: Record<Size, string> = {
  sm: 'max-w-2xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
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
