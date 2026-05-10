import type { Metadata } from 'next';
import { siteCopy } from '@/content/site';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { ContactForm } from '@/components/forms/ContactForm';
import { IllustrationFrame, SafeContactIllustration } from '@/components/illustrations';

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
        <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <ContactForm source="contato" />
          <div className="hidden lg:block">
            <IllustrationFrame size="sm">
              <SafeContactIllustration />
            </IllustrationFrame>
          </div>
        </div>
      </Section>
    </>
  );
}
