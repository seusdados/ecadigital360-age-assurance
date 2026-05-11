import Link from 'next/link';
import { requireTenantContext } from '@/lib/agekey/tenant';

const subnav = [
  { href: '/safety', label: 'Visão geral' },
  { href: '/safety/events', label: 'Eventos' },
  { href: '/safety/alerts', label: 'Alertas' },
  { href: '/safety/rules', label: 'Regras' },
  { href: '/safety/subjects', label: 'Sujeitos' },
  { href: '/safety/interactions', label: 'Interações' },
  { href: '/safety/evidence', label: 'Evidência' },
  { href: '/safety/retention', label: 'Retenção' },
  { href: '/safety/reports', label: 'Relatórios' },
  { href: '/safety/integration', label: 'Integração' },
  { href: '/safety/settings', label: 'Configurações' },
];

export default async function SafetyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await requireTenantContext();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-medium">Safety Signals</h1>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs"
            title="Escopo de tenant aplicado a todas as consultas desta seção (RLS)."
          >
            <span className="text-muted-foreground">Tenant:</span>
            <span className="font-medium">{tenant.tenantName}</span>
            <span className="font-mono text-muted-foreground">
              ({tenant.tenantSlug})
            </span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Sinais de risco proporcionais e auditáveis. Metadata-only no MVP —
          sem conteúdo bruto, sem reconhecimento facial, sem score universal
          cross-tenant.
        </p>
      </header>
      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {subnav.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-md px-3 py-1 text-sm hover:bg-accent"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}
