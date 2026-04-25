import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Auditoria' };

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Feed de <code className="font-mono">audit_events</code> filtrável por
          recurso, ator e período. Em construção.
        </p>
      </header>
    </div>
  );
}
