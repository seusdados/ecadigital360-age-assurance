import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verificações',
};

export default function VerificationsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Verificações</h1>
        <p className="text-sm text-muted-foreground">
          Listagem e detalhe de sessões processadas.
        </p>
      </header>

      <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <p className="text-sm">Em construção (slice 2 da Fase 3).</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Consume <code className="font-mono">verifications-session-get</code>{' '}
          via Server Action e tabela paginada.
        </p>
      </div>
    </div>
  );
}
