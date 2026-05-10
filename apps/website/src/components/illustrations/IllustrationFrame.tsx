import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

const widths: Record<Size, string> = {
  // sm: side-by-side in 2-col layouts (column already constrains; cap to keep readable)
  sm: 'max-w-md',
  // md: full-width inserts inside a Section; default for most diagrams
  md: 'max-w-2xl',
  // lg: wide diagrams (PlatformArchitecture, FourStepFlow) where horizontal flow needs room
  lg: 'max-w-3xl',
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
