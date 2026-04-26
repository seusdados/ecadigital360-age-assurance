import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Aplicações' };

export default function ApplicationsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Aplicações</h1>
        <p className="text-sm text-muted-foreground">
          API keys e webhooks por aplicação. Em construção.
        </p>
      </header>
    </div>
  );
}
