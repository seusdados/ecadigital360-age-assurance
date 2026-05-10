import {
  ComplianceWithoutIdentityDiagram,
  DeveloperIntegrationFlow,
  EvidenceAuditDiagram,
  ForbiddenClaimsDiagram,
  FourStepVerificationFlow,
  HeroAgeEligibilityIllustration,
  MethodRouterDiagram,
  NotKycComparisonDiagram,
  OvercollectionProblemDiagram,
  PlatformArchitectureDiagram,
  PolicyEngineDiagram,
  PricingMaturityDiagram,
  PrivacyArchitectureDiagram,
  SafeContactIllustration,
  TokenAnatomyDiagram,
  TrustModelDiagram,
  UseCasesNetworkIllustration,
  WebhookEventsFlow,
  WidgetJourneyFlow,
} from '@/components/illustrations';

const illustrations = [
  ['HeroAgeEligibilityIllustration', HeroAgeEligibilityIllustration],
  ['OvercollectionProblemDiagram', OvercollectionProblemDiagram],
  ['NotKycComparisonDiagram', NotKycComparisonDiagram],
  ['FourStepVerificationFlow', FourStepVerificationFlow],
  ['MethodRouterDiagram', MethodRouterDiagram],
  ['PrivacyArchitectureDiagram', PrivacyArchitectureDiagram],
  ['DeveloperIntegrationFlow', DeveloperIntegrationFlow],
  ['TokenAnatomyDiagram', TokenAnatomyDiagram],
  ['TrustModelDiagram', TrustModelDiagram],
  ['EvidenceAuditDiagram', EvidenceAuditDiagram],
  ['PolicyEngineDiagram', PolicyEngineDiagram],
  ['WidgetJourneyFlow', WidgetJourneyFlow],
  ['UseCasesNetworkIllustration', UseCasesNetworkIllustration],
  ['PlatformArchitectureDiagram', PlatformArchitectureDiagram],
  ['WebhookEventsFlow', WebhookEventsFlow],
  ['ForbiddenClaimsDiagram', ForbiddenClaimsDiagram],
  ['ComplianceWithoutIdentityDiagram', ComplianceWithoutIdentityDiagram],
  ['PricingMaturityDiagram', PricingMaturityDiagram],
  ['SafeContactIllustration', SafeContactIllustration],
] as const;

export const metadata = {
  title: 'Biblioteca visual AgeKey',
  robots: { index: false, follow: false },
};

export default function AgeKeyIllustrationsDemoPage() {
  return (
    <main className="bg-background text-foreground">
      <section className="container py-16 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Biblioteca visual AgeKey
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
          Ilustrações com motion effects no padrão visual do site público
        </h1>
        <p className="mt-5 max-w-3xl text-base text-muted-foreground md:text-md">
          Componentes React/SVG inline, sem dependências novas, usando variáveis do tema do AgeKey e respeitando prefers-reduced-motion.
        </p>

        <div className="mt-14 space-y-20">
          {illustrations.map(([name, Illustration]) => (
            <article key={name}>
              <div className="mb-4 flex items-baseline gap-3 border-b border-border pb-3">
                <h2 className="font-mono text-sm font-medium text-foreground">{name}</h2>
              </div>
              <div className="mx-auto w-full max-w-5xl">
                <Illustration />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
