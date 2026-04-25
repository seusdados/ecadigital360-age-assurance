import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import type { UsageCounterRow } from '@/types/database';
import { formatNumber } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Visão geral',
};

interface AggregatedKpi {
  created: number;
  approved: number;
  denied: number;
  tokens: number;
  webhooks: number;
}

async function fetchKpisLast30Days(tenantId: string): Promise<AggregatedKpi> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from('usage_counters')
    .select(
      'verifications_created, verifications_approved, verifications_denied, tokens_issued, webhooks_delivered',
    )
    .eq('tenant_id', tenantId)
    .gte('day', since);

  if (error) throw error;

  const rows = (data ?? []) as Pick<
    UsageCounterRow,
    | 'verifications_created'
    | 'verifications_approved'
    | 'verifications_denied'
    | 'tokens_issued'
    | 'webhooks_delivered'
  >[];

  return rows.reduce<AggregatedKpi>(
    (acc, row) => ({
      created: acc.created + row.verifications_created,
      approved: acc.approved + row.verifications_approved,
      denied: acc.denied + row.verifications_denied,
      tokens: acc.tokens + row.tokens_issued,
      webhooks: acc.webhooks + row.webhooks_delivered,
    }),
    { created: 0, approved: 0, denied: 0, tokens: 0, webhooks: 0 },
  );
}

function approvalRate(kpis: AggregatedKpi): string {
  if (kpis.created === 0) return '—';
  return `${Math.round((kpis.approved / kpis.created) * 100)}%`;
}

export default async function DashboardPage() {
  const ctx = await requireTenantContext();
  const kpis = await fetchKpisLast30Days(ctx.tenantId);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          Métricas dos últimos 30 dias.
        </p>
      </header>

      <section
        aria-labelledby="kpi-heading"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <h2 id="kpi-heading" className="sr-only">
          Indicadores
        </h2>

        <Kpi label="Verificações" value={formatNumber(kpis.created)} />
        <Kpi
          label="Aprovação"
          value={approvalRate(kpis)}
          hint={`${formatNumber(kpis.approved)} aprovadas`}
        />
        <Kpi
          label="Negadas"
          value={formatNumber(kpis.denied)}
          tone={kpis.denied > 0 ? 'warning' : 'default'}
        />
        <Kpi label="Tokens emitidos" value={formatNumber(kpis.tokens)} />
        <Kpi
          label="Webhooks entregues"
          value={formatNumber(kpis.webhooks)}
        />
      </section>

      {kpis.created === 0 ? (
        <EmptyState
          title="Nenhuma verificação nos últimos 30 dias"
          description="Assim que as primeiras sessões forem criadas pela sua aplicação, os indicadores aparecem aqui em tempo (quase) real."
        />
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          'mt-2 text-md font-thin' + (tone === 'warning' ? ' text-warning' : '')
        }
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <h2 className="text-base font-normal">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
