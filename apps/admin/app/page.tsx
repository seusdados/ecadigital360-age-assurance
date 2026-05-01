import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-8 px-6 py-24"
    >
      <div className="space-y-4 animate-fade-in">
        <p className="text-sm text-muted-foreground tracking-widest uppercase">
          AgeKey · Age Assurance
        </p>
        <h1 className="text-2xl font-thin tracking-tight">
          Prova de elegibilidade etária com preservação de privacidade.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Motor multi-tenant white-label, com quatro modos de verificação
          (ZKP, Verifiable Credentials, Gateway, Fallback) e trilhas de
          auditoria minimizadas conforme LGPD/GDPR.
        </p>
      </div>

      <Link
        href="/login"
        className="group inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-normal text-primary-foreground transition hover:opacity-90"
      >
        Entrar no painel
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <footer className="mt-auto pt-16 text-xs text-muted-foreground">
        © 2026 ECA Digital · {' '}
        <Link href="/faq" className="underline-offset-4 hover:underline">
          FAQ
        </Link>
        {' · '}
        <a href="/legal/privacy" className="underline-offset-4 hover:underline">
          Política de Privacidade
        </a>
        {' · '}
        <a href="/legal/terms" className="underline-offset-4 hover:underline">
          Termos de uso
        </a>
      </footer>
    </main>
  );
}
