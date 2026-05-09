import type { Metadata } from 'next';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section, SectionHeader } from '@/components/ui/Section';
import { Card, FeatureCard } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';

export const metadata: Metadata = {
  title: 'AgeKey para Desenvolvedores | API, Widget e SDK de Age Assurance',
  description:
    'Integre age assurance ao seu produto com APIs, tokens assinados, webhooks, SDK JavaScript e widget web.',
};

export default function DevelopersPage() {
  const c = siteCopy.developers;
  return (
    <>
      <PageHero
        eyebrow="Desenvolvedores"
        title={c.hero.title}
        subtitle={c.hero.subtitle}
        primaryCta={c.hero.primaryCta}
        secondaryCta={c.hero.secondaryCta}
      />

      <Section>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <SectionHeader title={c.integration.title} />
            <p className="text-base text-muted-foreground">
              {c.integration.footer}
            </p>
          </div>
          <CodeBlock language="ts" code={c.integration.snippet} caption="SDK JS" />
        </div>
      </Section>

      <Section>
        <SectionHeader title={c.endpoints.title} />
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium text-foreground">
                  Método
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-foreground">
                  Endpoint
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-foreground">
                  Descrição
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {c.endpoints.items.map((ep) => (
                <tr key={ep.method + ep.path}>
                  <td className="px-4 py-3 font-mono text-xs text-accent">
                    {ep.method}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    {ep.path}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ep.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <SectionHeader title={c.webhooks.title} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {c.webhooks.items.map((w) => (
            <FeatureCard key={w.name} title={w.name} body={w.body} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader title={c.security.title} />
        <Card>
          <p className="text-base text-muted-foreground">{c.security.body}</p>
        </Card>
      </Section>
    </>
  );
}
