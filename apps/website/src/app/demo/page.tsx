import type { Metadata } from 'next';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { ContactForm } from '@/components/forms/ContactForm';

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
        <ContactForm source="demo" />
      </Section>
      <Section className="border-b-0">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {c.success.replace('Recebemos sua solicitação. ', '')}
        </p>
      </Section>
    </>
  );
}
