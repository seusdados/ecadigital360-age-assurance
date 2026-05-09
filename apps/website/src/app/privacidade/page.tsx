import type { Metadata } from 'next';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section, SectionHeader } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Privacidade no AgeKey | Prova Etária com Minimização de Dados',
  description:
    'Modelo privacy-first do AgeKey: minimização de dados, sem idade exata, documento, selfie ou data de nascimento em payloads públicos.',
};

export default function PrivacyPage() {
  const c = siteCopy.privacy;
  return (
    <>
      <PageHero title={c.hero.title} subtitle={c.hero.subtitle} primaryCta={c.hero.cta} />

      <Section id="nao-e-kyc">
        <SectionHeader title={c.notKyc.title} lead={c.notKyc.body} />
        <div className="grid gap-5 md:grid-cols-2">
          {c.notKyc.compare.map((col) => (
            <Card
              key={col.title}
              highlighted={'highlighted' in col ? col.highlighted : false}
            >
              <h3 className="text-md font-semibold">{col.title}</h3>
              <ul className="mt-4 space-y-2">
                {col.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader title={c.forbidden.title} lead={c.forbidden.lead} />
        <div className="rounded-xl border border-border bg-card p-6">
          <ul className="flex flex-wrap gap-2">
            {c.forbidden.fields.map((f) => (
              <li
                key={f}
                className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground"
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
          {c.forbidden.footer}
        </p>
      </Section>

      <Section>
        <SectionHeader title={c.storable.title} lead={c.storable.body} />
      </Section>
    </>
  );
}
