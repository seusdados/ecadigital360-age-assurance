import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Equipe' };

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Membros do tenant e seus papéis. Em construção.
        </p>
      </header>
    </div>
  );
}
