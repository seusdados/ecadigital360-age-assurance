import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

/* Width caps chosen so the rendered SVG keeps internal text legible:
 * - the source viewBoxes are ~960-1120px wide, with body fontSize 13-15.
 * - rendering smaller than ~60% of viewBox compresses text below 9px.
 * sm  = 36rem  = 576px (used inside narrower side-by-side columns)
 * md  = 56rem  = 896px (default for full-width inserts)
 * lg  = 64rem  = 1024px (wide horizontal flow diagrams)
 */
const widths: Record<Size, string> = {
  sm: 'max-w-xl',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
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
