import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FAQ_ITEMS } from '@/lib/faq/data';
import { FaqExplorer } from './faq-explorer';

export const metadata: Metadata = {
  title: 'FAQ | AgeKey',
  description:
    'Perguntas frequentes sobre como o AgeKey verifica elegibilidade etária com privacidade, segurança e minimização de dados.',
  alternates: { canonical: '/faq' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'FAQ | AgeKey',
    description:
      'Perguntas frequentes sobre como o AgeKey verifica elegibilidade etária com privacidade, segurança e minimização de dados.',
    url: '/faq',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary',
    title: 'FAQ | AgeKey',
    description:
      'Perguntas frequentes sobre como o AgeKey verifica elegibilidade etária com privacidade, segurança e minimização de dados.',
  },
};

function buildJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'pt-BR',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export default function FaqPage() {
  const jsonLd = buildJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-rendered JSON-LD — safe to inline.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main id="main" className="min-h-screen">
        <header className="border-b border-border/60 bg-card/40">
          <div className="mx-auto w-full max-w-4xl px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
            <Link
              href="/"
              className="text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              AgeKey · Age Assurance
            </Link>
            <div className="mt-6 max-w-3xl space-y-5 animate-fade-in">
              <h1 className="text-2xl font-thin tracking-tight sm:text-3xl">
                Perguntas frequentes sobre o AgeKey
              </h1>
              <p className="text-base text-muted-foreground sm:max-w-2xl">
                Entenda como o AgeKey ajuda plataformas digitais a verificar
                elegibilidade etária com privacidade, segurança e minimização
                de dados.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/contato">
                  Solicitar demonstração
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/docs">
                  <BookOpen className="h-4 w-4" />
                  Ver documentação
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-4xl px-6 pt-10 sm:pt-14">
          <FaqExplorer />
        </div>

        <section
          aria-labelledby="faq-cta-heading"
          className="border-t border-border/60 bg-card/30"
        >
          <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-20">
            <div className="max-w-2xl space-y-4">
              <h2
                id="faq-cta-heading"
                className="text-xl font-thin tracking-tight sm:text-2xl"
              >
                Pronto para integrar verificação etária com privacidade?
              </h2>
              <p className="text-base text-muted-foreground">
                O AgeKey ajuda plataformas digitais a aplicar políticas etárias
                com menos exposição de dados pessoais, melhor experiência para
                o usuário e evidências técnicas para auditoria.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/contato">
                  Solicitar demonstração
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/docs">
                  <BookOpen className="h-4 w-4" />
                  Ver documentação
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <footer className="border-t border-border/60">
          <div className="mx-auto w-full max-w-4xl px-6 py-8 text-xs text-muted-foreground">
            © 2026 ECA Digital ·{' '}
            <Link href="/" className="underline-offset-4 hover:underline">
              Início
            </Link>
            {' · '}
            <Link
              href="/legal/privacy"
              className="underline-offset-4 hover:underline"
            >
              Política de Privacidade
            </Link>
            {' · '}
            <Link
              href="/legal/terms"
              className="underline-offset-4 hover:underline"
            >
              Termos de uso
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
