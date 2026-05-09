import type { Metadata } from 'next';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { ContactForm } from '@/components/forms/ContactForm';

export const metadata: Metadata = {
  title: 'Contato | AgeKey',
  description:
    'Fale com o AgeKey sobre integração, política etária e volume esperado. Não envie documentos pessoais.',
};

export default function ContactPage() {
  const c = siteCopy.contact;
  return (
    <>
      <PageHero
        eyebrow="Contato"
        title={c.hero.title}
        subtitle={c.hero.subtitle}
      />
      <Section>
        <ContactForm source="contato" />
      </Section>
    </>
  );
}
