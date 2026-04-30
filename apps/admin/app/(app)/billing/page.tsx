import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { cn, formatNumber } from '@/lib/utils';
import type { UsageCounterRow } from '@/types/database';

export const metadata: Metadata = { title: 'Faturamento' };

interface UsageRow extends UsageCounterRow {
  applications: { id: string; slug: string; name: string } | null;
}

interface MonthlyAppKey {
  applicationId: string;
  applicationSlug: string;
  applicationName: string;
  monthKey: string; // YYYY-MM
}

interface MonthlyAppAggregate extends MonthlyAppKey {
  verifications_created: number;
  verifications_approved: number;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});

function startOfMonthIso(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function monthKey(day: string): string {
  // day is YYYY-MM-DD; take YYYY-MM.
  return day.slice(0, 7);
}

function formatMonthLabel(key: string): string {
  const [yearStr, monthStr] = key.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;
  const label = MONTH_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface MonthKpis {
  created: number;
  approved: number;
  denied: number;
  tokens: number;
  webhooks: number;
}

function approvalRateLabel(created: number, approved: number): string {
  if (created === 0) return '—';
  return `${Math.round((approved / created) * 100)}%`;
}

async function fetchUsageRows(
  tenantId: string,
  sinceIso: string,
): Promise<{ rows: UsageRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('usage_counters')
    .select(
      'tenant_id, application_id, day, verifications_created, verifications_approved, verifications_denied, tokens_issued, webhooks_delivered, applications:application_id ( id, slug, name )',
    )
    .eq('tenant_id', tenantId)
    .gte('day', sinceIso)
    .order('day', { ascending: false });

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as unknown as UsageRow[], error: null };
}

export default async function BillingPage() {
  const ctx = await requireTenantContext();

  // Current month KPI window: from day-1 of current month, UTC.
  const now = new Date();
  const currentMonthStart = startOfMonthIso(now);

  // Last 6 months window for the table (inclusive of current month).
  const sixMonthsAgo = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  );
  const sinceIso = startOfMonthIso(sixMonthsAgo);

  const { rows, error: fetchError } = await fetchUsageRows(
    ctx.tenantId,
    sinceIso,
  );

  // Aggregate the current-month KPIs.
  const currentMonthKpis = rows
    .filter((row) => row.day >= currentMonthStart)
    .reduce<MonthKpis>(
      (acc, row) => ({
        created: acc.created + row.verifications_created,
        approved: acc.approved + row.verifications_approved,
        denied: acc.denied + row.verifications_denied,
        tokens: acc.tokens + row.tokens_issued,
        webhooks: acc.webhooks + row.webhooks_delivered,
      }),
      { created: 0, approved: 0, denied: 0, tokens: 0, webhooks: 0 },
    );

  // Aggregate by (application, month).
  const aggregates = new Map<string, MonthlyAppAggregate>();
  for (const row of rows) {
    const app = row.applications;
    const key = `${row.application_id}|${monthKey(row.day)}`;
    const existing = aggregates.get(key);
    if (existing) {
      existing.verifications_created += row.verifications_created;
      existing.verifications_approved += row.verifications_approved;
    } else {
      aggregates.set(key, {
        applicationId: row.application_id,
        applicationSlug: app?.slug ?? '—',
        applicationName: app?.name ?? row.application_id,
        monthKey: monthKey(row.day),
        verifications_created: row.verifications_created,
        verifications_approved: row.verifications_approved,
      });
    }
  }

  const tableRows = Array.from(aggregates.values()).sort((a, b) => {
    if (a.monthKey !== b.monthKey) return b.monthKey.localeCompare(a.monthKey);
    return a.applicationSlug.localeCompare(b.applicationSlug);
  });

  const isEmpty = rows.length === 0 && !fetchError;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Faturamento</h1>
        <p className="text-sm text-muted-foreground">
          Uso agregado do mês corrente e histórico por aplicação.
        </p>
      </header>

      {fetchError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Falha ao carregar contadores de uso: {fetchError}
        </p>
      ) : null}

      <section
        aria-labelledby="kpi-heading"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <h2 id="kpi-heading" className="sr-only">
          Indicadores do mês corrente
        </h2>
        <Kpi
          label="Verificações criadas"
          value={formatNumber(currentMonthKpis.created)}
        />
        <Kpi
          label="Aprovadas"
          value={formatNumber(currentMonthKpis.approved)}
          hint={approvalRateLabel(
            currentMonthKpis.created,
            currentMonthKpis.approved,
          )}
        />
        <Kpi
          label="Negadas"
          value={formatNumber(currentMonthKpis.denied)}
          tone={currentMonthKpis.denied > 0 ? 'warning' : 'default'}
        />
        <Kpi
          label="Tokens emitidos"
          value={formatNumber(currentMonthKpis.tokens)}
        />
        <Kpi
          label="Webhooks entregues"
          value={formatNumber(currentMonthKpis.webhooks)}
        />
      </section>

      <section aria-labelledby="by-app-heading" className="space-y-3">
        <h2
          id="by-app-heading"
          className="text-sm uppercase tracking-widest text-muted-foreground"
        >
          Por aplicação · últimos 6 meses
        </h2>

        {isEmpty ? (
          <EmptyState
            title="Sem uso registrado"
            description="Quando suas aplicações começarem a criar sessões, os contadores aparecem aqui agregados por dia e por aplicação."
          />
        ) : tableRows.length === 0 ? (
          <EmptyState
            title="Sem dados nos últimos 6 meses"
            description="Não há registros de uso para o período. Os contadores são atualizados pelo trigger em billing_events."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-accent/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-normal">
                    Aplicação
                  </th>
                  <th scope="col" className="px-3 py-2 font-normal">
                    Mês
                  </th>
                  <th scope="col" className="px-3 py-2 font-normal">
                    Verificações
                  </th>
                  <th scope="col" className="px-3 py-2 font-normal">
                    Taxa de aprovação
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr
                    key={`${row.applicationId}-${row.monthKey}`}
                    className="border-t border-border transition hover:bg-accent/20"
                  >
                    <td className="px-3 py-2">
                      <div className="font-normal">{row.applicationName}</div>
                      <code className="font-mono text-xs text-muted-foreground">
                        {row.applicationSlug}
                      </code>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatMonthLabel(row.monthKey)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {formatNumber(row.verifications_created)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {approvalRateLabel(
                        row.verifications_created,
                        row.verifications_approved,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
        className={cn(
          'mt-2 text-md font-thin',
          tone === 'warning' && 'text-warning',
        )}
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
      <h3 className="text-base font-normal">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
