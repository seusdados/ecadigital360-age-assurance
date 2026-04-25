import type { Metadata } from 'next';
import { agekey, AgeKeyApiError } from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Políticas',
};

export default async function PoliciesPage() {
  await requireTenantContext();

  let policies: Awaited<ReturnType<typeof agekey.policies.list>>['items'] = [];
  let loadError: string | null = null;

  try {
    const result = await agekey.policies.list({ include_templates: true });
    policies = result.items;
  } catch (err) {
    loadError =
      err instanceof AgeKeyApiError
        ? `Falha ao carregar políticas (${err.reasonCode}).`
        : 'Falha ao carregar políticas.';
  }

  const ofTenant = policies.filter((p) => !p.is_template);
  const templates = policies.filter((p) => p.is_template);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-md font-thin">Políticas</h1>
          <p className="text-sm text-muted-foreground">
            Regras de elegibilidade etária aplicáveis às suas aplicações.
            Templates globais podem ser clonados para o seu tenant.
          </p>
        </div>
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </p>
      ) : null}

      <section aria-labelledby="tenant-policies-heading" className="space-y-3">
        <h2
          id="tenant-policies-heading"
          className="text-sm uppercase tracking-widest text-muted-foreground"
        >
          Suas políticas
        </h2>

        {ofTenant.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <p className="text-sm">Nenhuma política criada ainda.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Clone um dos templates abaixo para começar.
            </p>
          </div>
        ) : (
          <PolicyTable policies={ofTenant} />
        )}
      </section>

      {templates.length > 0 ? (
        <section aria-labelledby="templates-heading" className="space-y-3">
          <h2
            id="templates-heading"
            className="text-sm uppercase tracking-widest text-muted-foreground"
          >
            Templates globais
          </h2>
          <PolicyTable policies={templates} />
        </section>
      ) : null}
    </div>
  );
}

function PolicyTable({
  policies,
}: {
  policies: Awaited<ReturnType<typeof agekey.policies.list>>['items'];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-accent/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <Th>Slug</Th>
            <Th>Nome</Th>
            <Th>Idade mínima</Th>
            <Th>Jurisdição</Th>
            <Th>Assurance</Th>
            <Th>Versão</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr
              key={p.id}
              className="border-t border-border transition hover:bg-accent/20"
            >
              <Td>
                <code className="font-mono text-xs">{p.slug}</code>
              </Td>
              <Td>{p.name}</Td>
              <Td>{p.age_threshold}+</Td>
              <Td className="text-muted-foreground">
                {p.jurisdiction_code ?? '—'}
              </Td>
              <Td>
                <AssuranceBadge level={p.required_assurance_level} />
              </Td>
              <Td className="font-mono text-xs">v{p.current_version}</Td>
              <Td>
                <StatusBadge status={p.status} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-normal">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn('px-3 py-2 align-middle', className)}>{children}</td>;
}

function AssuranceBadge({
  level,
}: {
  level: 'low' | 'substantial' | 'high';
}) {
  const tone =
    level === 'high'
      ? 'bg-success/15 text-success'
      : level === 'substantial'
        ? 'bg-primary/15 text-primary'
        : 'bg-muted text-muted-foreground';
  const label =
    level === 'high' ? 'Alto' : level === 'substantial' ? 'Substantial' : 'Baixo';
  return (
    <span
      className={cn('rounded px-2 py-0.5 text-[11px] uppercase tracking-wide', tone)}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded bg-accent px-2 py-0.5 text-[11px] uppercase tracking-wide">
      {status}
    </span>
  );
}
