import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section, SectionHeader } from '@/components/ui/Section';
import { FeatureCard } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return siteCopy.solutions.items.map((i) => ({ slug: i.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const item = siteCopy.solutions.items.find((i) => i.slug === params.slug);
  if (!item) return { title: 'Solução não encontrada' };
  return {
    title: `${item.title} | Soluções AgeKey`,
    description: item.body,
  };
}

export default function SolutionDetailPage({ params }: { params: Params }) {
  const item = siteCopy.solutions.items.find((i) => i.slug === params.slug);
  if (!item) notFound();

  return (
    <>
      <PageHero
        eyebrow="Solução"
        title={item.title}
        subtitle={item.lead}
        primaryCta={{ label: 'Solicitar demonstração', href: '/demo' }}
        secondaryCta={{ label: 'Falar com vendas', href: '/contato' }}
      />

      <Section>
        <SectionHeader title="Como o AgeKey ajuda" lead={item.body} />
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            title="Política proporcional"
            body="Configure o requisito etário adequado ao contexto: 13+, 16+, 18+, 21+ ou faixa etária."
          />
          <FeatureCard
            title="Integração rápida"
            body="API, widget e SDK para encaixar a verificação na jornada existente."
          />
          <FeatureCard
            title="Decisão minimizada"
            body="Sua plataforma recebe apenas aprovado, negado ou precisa de revisão — sem identidade civil."
          />
        </div>
        <div className="mt-12">
          <ButtonLink href="/solucoes" variant="secondary">
            Ver todas as soluções
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
