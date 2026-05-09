import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function Card({
  children,
  className,
  highlighted,
}: {
  children: ReactNode;
  className?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-6 md:p-7 transition-shadow',
        highlighted &&
          'border-accent/50 ring-1 ring-accent/40 shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.35)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FeatureCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Card className="h-full">
      <h3 className="text-base md:text-md font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm md:text-base text-muted-foreground">{body}</p>
    </Card>
  );
}

export function StepCard({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <Card className="h-full">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-semibold"
        >
          {n}
        </span>
        <div>
          <h3 className="text-base md:text-md font-semibold text-foreground">
            {title}
          </h3>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            {body}
          </p>
        </div>
      </div>
    </Card>
  );
}
