import type { Metadata } from 'next';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section, SectionHeader } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Compliance AgeKey | Auditoria e Privacy by Design',
  description:
    'Documentação de apoio para governança, retenção, auditoria, segurança e privacy by design em fluxos de verificação etária.',
};

export default function CompliancePage() {
  const c = siteCopy.compliance;
  return (
    <>
      <PageHero
        eyebrow="Compliance"
        title={c.hero.title}
        subtitle={c.hero.subtitle}
        primaryCta={c.hero.cta}
      />

      <Section>
        <SectionHeader title={c.governance.title} />
        <Card>
          <ul className="space-y-3">
            {c.governance.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 text-sm md:text-base"
              >
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                />
                <span className="text-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </Card>
        <p className="mt-6 max-w-3xl rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
          {c.governance.footer}
        </p>
      </Section>

      <Section>
        <SectionHeader title={c.docs.title} lead={c.docs.body} />
        <p className="max-w-3xl rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {c.docs.note}
        </p>
      </Section>
    </>
  );
}
