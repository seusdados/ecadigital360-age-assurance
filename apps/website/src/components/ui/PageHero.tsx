import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/Button';

export function PageHero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  children?: ReactNode;
}) {
  return (
    <section className="gradient-soft border-b border-border/60">
      <div className="container py-16 md:py-24">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-5 text-base text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
          {primaryCta || secondaryCta ? (
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {primaryCta ? (
                <ButtonLink href={primaryCta.href} size="lg">
                  {primaryCta.label}
                </ButtonLink>
              ) : null}
              {secondaryCta ? (
                <ButtonLink href={secondaryCta.href} variant="secondary" size="lg">
                  {secondaryCta.label}
                </ButtonLink>
              ) : null}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
