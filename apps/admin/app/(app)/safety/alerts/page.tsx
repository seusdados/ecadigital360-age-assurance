import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { formatDateTime, shortId } from '@/lib/utils';
import {
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildAlertFilterQueryString,
  parseAlertFilters,
} from '@agekey/shared';

export const metadata: Metadata = { title: 'Safety · Alertas' };

interface AlertRow {
  id: string;
  status: string;
  severity: string;
  rule_code: string;
  risk_category: string;
  reason_codes: string[];
  created_at: string;
  resolved_at: string | null;
}

const SEVERITY_TONE: Record<string, string> = {
  info: 'bg-stone-100 text-stone-700',
  low: 'bg-emerald-100 text-emerald-900',
  medium: 'bg-amber-100 text-amber-900',
  high: 'bg-orange-100 text-orange-900',
  critical: 'bg-rose-100 text-rose-900',
};

const STATUS_TONE: Record<string, string> = {
  open: 'bg-rose-100 text-rose-900',
  acknowledged: 'bg-amber-100 text-amber-900',
  escalated: 'bg-orange-100 text-orange-900',
  resolved: 'bg-emerald-100 text-emerald-900',
  dismissed: 'bg-stone-100 text-stone-700',
};

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function AlertsPage({ searchParams }: PageProps) {
  await requireTenantContext();
  const filters = parseAlertFilters(searchParams ?? {});

  const supabase = await createClient();
  let q = supabase
    .from('safety_alerts' as never)
    .select(
      'id, status, severity, rule_code, risk_category, reason_codes, created_at, resolved_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.pageSize - 1);

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.severity) q = q.eq('severity', filters.severity);
  if (filters.ruleCode) q = q.eq('rule_code', filters.ruleCode);
  if (filters.since) q = q.gte('created_at', filters.since);

  const { data, count } = await q;
  const items = (data as unknown as AlertRow[] | null) ?? [];
  const total = count ?? items.length;

  const prevQs =
    filters.offset > 0
      ? buildAlertFilterQueryString(filters, {
          offset: Math.max(0, filters.offset - filters.pageSize),
        })
      : null;
  const hasMore = filters.offset + items.length < total;
  const nextQs = hasMore
    ? buildAlertFilterQueryString(filters, {
        offset: filters.offset + filters.pageSize,
      })
    : null;

  return (
    <div className="space-y-4">
      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3"
      >
        <label className="flex flex-col text-xs text-muted-foreground">
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ''}
            className="mt-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">(todos)</option>
            {ALERT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          Severidade
          <select
            name="severity"
            defaultValue={filters.severity ?? ''}
            className="mt-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">(todas)</option>
            {ALERT_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          Rule code
          <input
            type="text"
            name="rule_code"
            defaultValue={filters.ruleCode ?? ''}
            placeholder="UNKNOWN_TO_MINOR_..."
            pattern="[A-Z][A-Z0-9_]{2,63}"
            className="mt-1 w-56 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
          />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          Desde (ISO-8601)
          <input
            type="text"
            name="since"
            defaultValue={filters.since ?? ''}
            placeholder="2026-05-01T00:00:00Z"
            className="mt-1 w-56 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          Por página
          <input
            type="number"
            name="page_size"
            min={1}
            max={MAX_PAGE_SIZE}
            defaultValue={filters.pageSize}
            className="mt-1 w-20 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
        >
          Filtrar
        </button>
        <Link
          href="/safety/alerts"
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent"
        >
          Limpar
        </Link>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Severidade</th>
              <th className="px-3 py-2">Regra</th>
              <th className="px-3 py-2">Categoria de risco</th>
              <th className="px-3 py-2">Reason codes</th>
              <th className="px-3 py-2">Criado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Nenhum alerta com os filtros atuais.
                </td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link
                      href={`/safety/alerts/${a.id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {shortId(a.id)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        STATUS_TONE[a.status] ?? 'bg-muted'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        SEVERITY_TONE[a.severity] ?? 'bg-muted'
                      }`}
                    >
                      {a.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{a.rule_code}</td>
                  <td className="px-3 py-2 text-xs">{a.risk_category}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {a.reason_codes.join(', ')}
                  </td>
                  <td className="px-3 py-2">{formatDateTime(a.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {items.length === 0
            ? 'Nenhum resultado'
            : `Mostrando ${filters.offset + 1}–${
                filters.offset + items.length
              } de ${total}`}
          {filters.pageSize !== DEFAULT_PAGE_SIZE
            ? ` (página de ${filters.pageSize})`
            : ''}
        </span>
        <div className="flex gap-2">
          {prevQs !== null ? (
            <Link
              href={`/safety/alerts${prevQs}`}
              className="rounded-md border border-border px-3 py-1 hover:bg-accent"
            >
              ← Anterior
            </Link>
          ) : (
            <span className="rounded-md border border-border px-3 py-1 opacity-50">
              ← Anterior
            </span>
          )}
          {nextQs !== null ? (
            <Link
              href={`/safety/alerts${nextQs}`}
              className="rounded-md border border-border px-3 py-1 hover:bg-accent"
            >
              Próxima →
            </Link>
          ) : (
            <span className="rounded-md border border-border px-3 py-1 opacity-50">
              Próxima →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
