import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'API' };

export default function ApiSettingsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-md font-thin">API</h1>
        <p className="text-sm text-muted-foreground">
          Documentação dos endpoints, playground e rotação de chaves.
          Em construção.
        </p>
      </header>
    </div>
  );
}
