import type { Metadata } from 'next';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section, SectionHeader } from '@/components/ui/Section';
import { FeatureCard, StepCard } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import {
  FourStepVerificationFlow,
  MethodRouterDiagram,
  TokenAnatomyDiagram,
  TrustModelDiagram,
} from '@/components/illustrations';

export const metadata: Metadata = {
  title: 'Como funciona o AgeKey | Verificação Etária sem KYC',
  description:
    'Entenda como o AgeKey cria sessões de verificação, aplica políticas etárias e retorna decisões mínimas, assinadas e auditáveis.',
};

export default function HowItWorksPage() {
  const c = siteCopy.howItWorks;
  return (
    <>
      <PageHero
        eyebrow="Como funciona"
        title={c.hero.title}
        subtitle={c.hero.subtitle}
        primaryCta={c.hero.cta}
      />

      <Section>
        <SectionHeader title={c.flow.title} />
        <div className="mb-10">
          <FourStepVerificationFlow />
        </div>
        <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {c.flow.steps.map((s) => (
            <li key={s.n} className="list-none">
              <StepCard n={s.n} title={s.title} body={s.body} />
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <SectionHeader title={c.response.title} lead={c.response.lead} />
            <p className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
              {c.response.reinforce}
            </p>
          </div>
          <div className="space-y-6">
            <TokenAnatomyDiagram />
            <CodeBlock
              language="json"
              caption="Payload público"
              code={c.response.snippet}
            />
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader title={c.methods.title} lead={c.methods.lead} />
        <div className="mb-10">
          <MethodRouterDiagram />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {c.methods.items.map((m) => (
            <FeatureCard key={m.title} title={m.title} body={m.body} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader title="Modelo de confiança" />
        <TrustModelDiagram />
      </Section>
    </>
  );
}
