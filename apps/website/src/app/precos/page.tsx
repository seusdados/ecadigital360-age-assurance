import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { IllustrationFrame, PricingMaturityDiagram } from '@/components/illustrations';

export const metadata: Metadata = {
  title: 'Preços AgeKey | Planos de Verificação Etária para Empresas',
  description:
    'Planos AgeKey: Sandbox para testes, Growth para operação e Enterprise para escala, white-label e compliance avançado.',
};

export default function PricingPage() {
  const c = siteCopy.pricing;
  return (
    <>
      <PageHero
        eyebrow="Preços"
        title={c.hero.title}
        subtitle={c.hero.subtitle}
        primaryCta={c.hero.cta}
      />

      <Section>
        <div className="mb-12">
          <IllustrationFrame size="md">
            <PricingMaturityDiagram />
          </IllustrationFrame>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {c.plans.map((plan) => (
            <Card key={plan.name} highlighted={'highlighted' in plan && plan.highlighted} className="flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {plan.name}
              </p>
              <p className="mt-3 text-md font-semibold text-foreground">
                {plan.price}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{plan.tagline}</p>
              <ul className="mt-6 space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <ButtonLink
                  href={plan.cta.href}
                  variant={'highlighted' in plan && plan.highlighted ? 'primary' : 'secondary'}
                  className="w-full"
                >
                  {plan.cta.label}
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-sm text-muted-foreground">{c.note}</p>
      </Section>
    </>
  );
}
