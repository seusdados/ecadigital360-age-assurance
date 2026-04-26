import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Entrar',
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          AgeKey Admin
        </p>
        <h1 className="text-md font-thin">Entrar</h1>
        <p className="text-sm text-muted-foreground">
          Acesse seu painel multi-tenant.
        </p>
      </header>

      <LoginForm {...(next ? { next } : {})} />

      <p className="text-xs text-muted-foreground">
        Ao continuar você concorda com os{' '}
        <a href="/legal/terms" className="underline-offset-4 hover:underline">
          Termos de uso
        </a>{' '}
        e a{' '}
        <a href="/legal/privacy" className="underline-offset-4 hover:underline">
          Política de Privacidade
        </a>
        .
      </p>
    </div>
  );
}
