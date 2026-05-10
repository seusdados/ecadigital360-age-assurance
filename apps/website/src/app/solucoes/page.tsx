import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section, SectionHeader } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { IllustrationFrame, UseCasesNetworkIllustration } from '@/components/illustrations';

export const metadata: Metadata = {
  title: 'Soluções AgeKey | Verificação Etária para Plataformas Digitais',
  description:
    'Age assurance para edtechs, marketplaces, publishers, jogos, comunidades e plataformas digitais.',
};

export default function SolutionsPage() {
  const c = siteCopy.solutions;
  return (
    <>
      <PageHero
        eyebrow="Soluções"
        title={c.hero.title}
        subtitle={c.hero.subtitle}
        primaryCta={c.hero.cta}
      />

      <Section>
        <IllustrationFrame size="md">
          <UseCasesNetworkIllustration />
        </IllustrationFrame>
      </Section>

      <Section>
        <SectionHeader title="Encontre o caminho para seu produto" />
        <div className="grid gap-5 md:grid-cols-2">
          {c.items.map((item) => (
            <Card key={item.slug} className="flex flex-col">
              <h3 className="text-md md:text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-base text-foreground">{item.lead}</p>
              <p className="mt-3 text-sm text-muted-foreground">{item.body}</p>
              <Link
                href={`/solucoes/${item.slug}`}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                Ver solução
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
