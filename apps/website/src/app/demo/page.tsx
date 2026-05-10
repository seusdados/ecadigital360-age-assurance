import type { Metadata } from 'next';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { ContactForm } from '@/components/forms/ContactForm';
import { IllustrationFrame, SafeContactIllustration } from '@/components/illustrations';

export const metadata: Metadata = {
  title: 'Solicitar Demo | AgeKey',
  description:
    'Agende uma demonstração do AgeKey. Veja como integrar age assurance privacy-first ao seu produto digital.',
};

export default function DemoPage() {
  const c = siteCopy.contact;
  return (
    <>
      <PageHero
        eyebrow="Demonstração"
        title="Veja o AgeKey em ação"
        subtitle="Conte sobre seu produto, política etária e volume esperado. O time AgeKey monta uma demo focada no seu cenário."
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <ContactForm source="demo" />
          <div className="hidden lg:block">
            <IllustrationFrame size="sm">
              <SafeContactIllustration />
            </IllustrationFrame>
          </div>
        </div>
      </Section>
      <Section className="border-b-0">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {c.success.replace('Recebemos sua solicitação. ', '')}
        </p>
      </Section>
    </>
  );
}
