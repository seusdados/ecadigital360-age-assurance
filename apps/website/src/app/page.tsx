import { ArrowRight, ShieldCheck, Lock, Zap } from 'lucide-react';
import { siteCopy } from '@/content/site';
import { ButtonLink } from '@/components/ui/Button';
import { Section, SectionHeader } from '@/components/ui/Section';
import { Card, FeatureCard, StepCard } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { FAQ } from '@/components/ui/FAQ';
import {
  DeveloperIntegrationFlow,
  FourStepVerificationFlow,
  HeroAgeEligibilityIllustration,
  IllustrationFrame,
  MethodRouterDiagram,
  NotKycComparisonDiagram,
  OvercollectionProblemDiagram,
  PolicyEngineDiagram,
  PrivacyArchitectureDiagram,
  UseCasesNetworkIllustration,
} from '@/components/illustrations';

export default function HomePage() {
  const c = siteCopy.home;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden gradient-soft border-b border-border/60">
        <div className="container py-20 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                {c.hero.eyebrow}
              </p>
              <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-balance">
                {c.hero.title}
              </h1>
              <p className="mt-6 text-base md:text-md text-muted-foreground">
                {c.hero.subtitle}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <ButtonLink href={c.hero.primaryCta.href} size="lg">
                  {c.hero.primaryCta.label}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </ButtonLink>
                <ButtonLink href={c.hero.secondaryCta.href} variant="secondary" size="lg">
                  {c.hero.secondaryCta.label}
                </ButtonLink>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">{c.hero.microcopy}</p>
            </div>
            <div className="lg:pl-4">
              <IllustrationFrame size="sm">
                <HeroAgeEligibilityIllustration />
              </IllustrationFrame>
            </div>
          </div>

          {/* Trust bar */}
          <div className="mt-16 grid gap-4 md:grid-cols-3">
            <TrustItem
              icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
              title="Não é KYC"
              body="Decisão etária mínima, sem identidade civil no payload público."
            />
            <TrustItem
              icon={<Lock className="h-5 w-5" aria-hidden />}
              title="Minimização por design"
              body="Sem documento, selfie, biometria ou data de nascimento exigidos no fluxo principal."
            />
            <TrustItem
              icon={<Zap className="h-5 w-5" aria-hidden />}
              title="Integração rápida"
              body="API, widget e SDK com contratos públicos e tokens assinados."
            />
          </div>
        </div>
      </section>

      {/* Problem */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeader title={c.problem.title} lead={c.problem.body} />
            <p className="text-base md:text-md text-foreground">
              {c.problem.footer}
            </p>
          </div>
          <IllustrationFrame size="sm">
            <OvercollectionProblemDiagram />
          </IllustrationFrame>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {c.problem.cards.map((card) => (
            <FeatureCard key={card.title} title={card.title} body={card.body} />
          ))}
        </div>
      </Section>

      {/* Definition */}
      <Section>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <SectionHeader title={c.definition.title} />
            <p className="text-base md:text-md text-foreground font-medium">
              {c.definition.lead}
            </p>
            <p className="mt-4 text-base text-muted-foreground">
              {c.definition.body}
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-2">
              {c.definition.bullets.map((b) => (
                <li
                  key={b}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                >
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <Card highlighted className="md:mt-16">
            <p className="text-md md:text-lg font-semibold leading-snug">
              {c.definition.highlight}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              O AgeKey concentra a complexidade técnica de age assurance numa
              camada especializada — para que sua aplicação trabalhe apenas com
              uma decisão final e auditável.
            </p>
          </Card>
        </div>
        <div className="mt-12">
          <IllustrationFrame size="md">
            <NotKycComparisonDiagram />
          </IllustrationFrame>
        </div>
      </Section>

      {/* Steps */}
      <Section>
        <SectionHeader eyebrow="Fluxo" title={c.steps.title} />
        <div className="mb-10">
          <IllustrationFrame size="lg">
            <FourStepVerificationFlow />
          </IllustrationFrame>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {c.steps.items.map((s) => (
            <StepCard key={s.n} n={s.n} title={s.title} body={s.body} />
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-base text-muted-foreground">
          {c.steps.footer}
        </p>
      </Section>

      {/* Features */}
      <Section>
        <SectionHeader eyebrow="Plataforma" title={c.features.title} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {c.features.items.map((f) => (
            <FeatureCard key={f.title} title={f.title} body={f.body} />
          ))}
        </div>
        <div className="mt-12">
          <IllustrationFrame size="md">
            <PolicyEngineDiagram />
          </IllustrationFrame>
        </div>
      </Section>

      {/* Modes */}
      <Section>
        <SectionHeader
          eyebrow="Arquitetura"
          title={c.modes.title}
          lead={c.modes.lead}
        />
        <div className="mb-10">
          <IllustrationFrame size="md">
            <MethodRouterDiagram />
          </IllustrationFrame>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {c.modes.items.map((m) => (
            <FeatureCard key={m.title} title={m.title} body={m.body} />
          ))}
        </div>
        <p className="mt-8 max-w-3xl rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {c.modes.note}
        </p>
      </Section>

      {/* Why */}
      <Section>
        <SectionHeader title={c.why.title} lead={c.why.lead} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {c.why.cards.map((card) => (
            <FeatureCard key={card.title} title={card.title} body={card.body} />
          ))}
        </div>
      </Section>

      {/* Privacy */}
      <Section>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <SectionHeader title={c.privacy.title} />
            <p className="text-base md:text-md text-muted-foreground">
              {c.privacy.body}
            </p>
            <div className="mt-6">
              <ButtonLink href={c.privacy.cta.href} variant="secondary">
                {c.privacy.cta.label}
              </ButtonLink>
            </div>
          </div>
          <div className="space-y-6">
            <IllustrationFrame size="sm">
              <PrivacyArchitectureDiagram />
            </IllustrationFrame>
            <ul className="space-y-3">
              {c.privacy.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent"
                  />
                  <span className="text-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Developers */}
      <Section>
        <div className="mb-10">
          <IllustrationFrame size="lg">
            <DeveloperIntegrationFlow />
          </IllustrationFrame>
        </div>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <SectionHeader eyebrow="Desenvolvedores" title={c.devSection.title} />
            <p className="text-base md:text-md text-muted-foreground">
              {c.devSection.body}
            </p>
            <p className="mt-6 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
              {c.devSection.note}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <ButtonLink href={c.devSection.primaryCta.href}>
                {c.devSection.primaryCta.label}
              </ButtonLink>
              <ButtonLink href={c.devSection.secondaryCta.href} variant="secondary">
                {c.devSection.secondaryCta.label}
              </ButtonLink>
            </div>
          </div>
          <div className="space-y-4">
            <CodeBlock
              caption="Criar sessão"
              language="ts"
              code={c.devSection.requestSnippet}
            />
            <CodeBlock
              caption="Resposta mínima"
              language="json"
              code={c.devSection.responseSnippet}
            />
          </div>
        </div>
      </Section>

      {/* Use cases */}
      <Section>
        <SectionHeader eyebrow="Casos de uso" title={c.useCases.title} />
        <div className="mb-10">
          <IllustrationFrame size="md">
            <UseCasesNetworkIllustration />
          </IllustrationFrame>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {c.useCases.items.map((u) => (
            <FeatureCard key={u.title} title={u.title} body={u.body} />
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <SectionHeader title={siteCopy.faq.title} />
        <FAQ items={siteCopy.faq.items} />
      </Section>

      {/* Final CTA */}
      <section className="border-b border-border/60 bg-primary text-primary-foreground">
        <div className="container py-16 md:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {c.finalCta.title}
            </h2>
            <p className="mt-4 text-base md:text-md text-primary-foreground/80">
              {c.finalCta.body}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <ButtonLink
                href={c.finalCta.primaryCta.href}
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {c.finalCta.primaryCta.label}
              </ButtonLink>
              <ButtonLink
                href={c.finalCta.secondaryCta.href}
                variant="secondary"
                size="lg"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                {c.finalCta.secondaryCta.label}
              </ButtonLink>
            </div>
            <p className="mt-5 text-sm text-primary-foreground/70">
              {c.finalCta.microcopy}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function TrustItem({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-foreground">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
