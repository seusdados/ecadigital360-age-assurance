import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function Section({
  children,
  className,
  id,
  bleed,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  bleed?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        'py-16 md:py-24',
        bleed ? '' : 'border-b border-border/60',
        className,
      )}
    >
      <div className="container">{children}</div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div
      className={cn(
        'max-w-3xl mb-10 md:mb-14',
        align === 'center' && 'mx-auto text-center',
      )}
    >
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-xl md:text-2xl font-semibold tracking-tight text-balance">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-base text-muted-foreground">
          {lead}
        </p>
      ) : null}
    </div>
  );
}
