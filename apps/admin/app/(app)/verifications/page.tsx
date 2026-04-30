import type { Metadata } from 'next';
import Link from 'next/link';
import {
  SessionStatusSchema,
  VerificationDecisionSchema,
  VerificationMethodSchema,
  type VerificationListItem,
  type VerificationsListQuery,
} from '@agekey/shared';
import { agekey, AgeKeyApiError } from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { cn, formatDateTime, shortId } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Verificações',
};

interface VerificationsPageProps {
  searchParams: Promise<{
    status?: string;
    decision?: string;
    method?: string;
    from?: string;
    to?: string;
    cursor?: string;
  }>;
}

const STATUS_OPTIONS = SessionStatusSchema.options;
const DECISION_OPTIONS = VerificationDecisionSchema.options;
const METHOD_OPTIONS = VerificationMethodSchema.options;

function pickEnum<T extends string>(
  value: string | undefined,
  options: readonly T[],
): T | undefined {
  if (!value) return undefined;
  return (options as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function pickIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // Datetime-local inputs emit "YYYY-MM-DDTHH:mm"; coerce to ISO with Z.
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export default async function VerificationsPage({
  searchParams,
}: VerificationsPageProps) {
  await requireTenantContext();
  const params = await searchParams;

  const filters: Partial<VerificationsListQuery> = {
    status: pickEnum(params.status, STATUS_OPTIONS),
    decision: pickEnum(params.decision, DECISION_OPTIONS),
    method: pickEnum(params.method, METHOD_OPTIONS),
    from: pickIsoDate(params.from),
    to: pickIsoDate(params.to),
    cursor: params.cursor && /^[0-9a-f-]{36}$/i.test(params.cursor)
      ? params.cursor
      : undefined,
  };

  let items: VerificationListItem[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;
  let loadError: string | null = null;

  try {
    const result = await agekey.verifications.list(filters);
    items = result.items;
    nextCursor = result.next_cursor;
    hasMore = result.has_more;
  } catch (err) {
    loadError =
      err instanceof AgeKeyApiError
        ? `Falha ao carregar verificações (${err.reasonCode}).`
        : 'Falha ao carregar verificações.';
  }

  // For "Carregar mais": preserve current filter params and append cursor.
  const baseQuery = new URLSearchParams();
  if (params.status) baseQuery.set('status', params.status);
  if (params.decision) baseQuery.set('decision', params.decision);
  if (params.method) baseQuery.set('method', params.method);
  if (params.from) baseQuery.set('from', params.from);
  if (params.to) baseQuery.set('to', params.to);

  const loadMoreHref =
    hasMore && nextCursor
      ? `/verifications?${(() => {
          const q = new URLSearchParams(baseQuery);
          q.set('cursor', nextCursor);
          return q.toString();
        })()}`
      : null;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Verificações</h1>
        <p className="text-sm text-muted-foreground">
          Sessões de verificação processadas no seu tenant. Filtre por status,
          decisão, método ou janela temporal.
        </p>
      </header>

      <FilterBar params={params} />

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm">Nenhuma verificação encontrada.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste os filtros ou aguarde novas sessões da sua aplicação.
          </p>
        </div>
      ) : (
        <VerificationTable items={items} />
      )}

      {loadMoreHref ? (
        <div className="flex justify-center">
          <Link
            href={loadMoreHref}
            className={cn(
              'inline-flex h-9 items-center justify-center rounded-md border border-border',
              'bg-background px-4 text-sm transition-colors hover:bg-accent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            Carregar mais
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function FilterBar({
  params,
}: {
  params: Awaited<VerificationsPageProps['searchParams']>;
}) {
  return (
    <form
      method="get"
      action="/verifications"
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      aria-label="Filtros de verificações"
    >
      <FilterSelect
        name="status"
        label="Status"
        value={params.status ?? ''}
        options={STATUS_OPTIONS}
      />
      <FilterSelect
        name="decision"
        label="Decisão"
        value={params.decision ?? ''}
        options={DECISION_OPTIONS}
      />
      <FilterSelect
        name="method"
        label="Método"
        value={params.method ?? ''}
        options={METHOD_OPTIONS}
      />
      <FilterDate name="from" label="De" value={params.from ?? ''} />
      <FilterDate name="to" label="Até" value={params.to ?? ''} />

      <div className="sm:col-span-2 lg:col-span-5 flex justify-end gap-2">
        <Link
          href="/verifications"
          className={cn(
            'inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm',
            'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          Limpar
        </Link>
        <button
          type="submit"
          className={cn(
            'inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground',
            'transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          Filtrar
        </button>
      </div>
    </form>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly string[];
}) {
  const id = `filter-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value}
        className={cn(
          'h-9 rounded-md border border-input bg-background px-3 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        )}
      >
        <option value="">Todos</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterDate({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: string;
}) {
  const id = `filter-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="datetime-local"
        defaultValue={value}
        className={cn(
          'h-9 rounded-md border border-input bg-background px-3 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        )}
      />
    </div>
  );
}

function VerificationTable({ items }: { items: VerificationListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-accent/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <Th>Status</Th>
            <Th>Método</Th>
            <Th>Política</Th>
            <Th>Aplicação</Th>
            <Th>Decisão</Th>
            <Th>Reason</Th>
            <Th>Criada em</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.session_id}
              className="border-t border-border transition hover:bg-accent/20"
            >
              <Td>
                <Link
                  href={`/verifications/${item.session_id}`}
                  className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <StatusBadge status={item.status} />
                </Link>
              </Td>
              <Td className="font-mono text-xs uppercase tracking-wide">
                {item.method ?? '—'}
              </Td>
              <Td>
                <code className="font-mono text-xs">{item.policy.slug}</code>
                <span className="ml-1 text-xs text-muted-foreground">
                  v{item.policy.version}
                </span>
              </Td>
              <Td>
                <code className="font-mono text-xs">
                  {item.application.slug}
                </code>
              </Td>
              <Td>
                <DecisionBadge decision={item.decision} />
              </Td>
              <Td>
                <code className="font-mono text-xs text-muted-foreground">
                  {item.reason_code ?? '—'}
                </code>
              </Td>
              <Td className="text-muted-foreground">
                <Link
                  href={`/verifications/${item.session_id}`}
                  className="rounded underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={item.session_id}
                >
                  {formatDateTime(item.created_at)}
                  <span className="ml-2 font-mono text-[10px]">
                    {shortId(item.session_id)}
                  </span>
                </Link>
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

function StatusBadge({
  status,
}: {
  status: VerificationListItem['status'];
}) {
  const tone =
    status === 'completed'
      ? 'bg-success/15 text-success'
      : status === 'in_progress' || status === 'pending'
        ? 'bg-primary/15 text-primary'
        : status === 'expired' || status === 'cancelled'
          ? 'bg-destructive/15 text-destructive'
          : 'bg-muted text-muted-foreground';
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-[11px] uppercase tracking-wide',
        tone,
      )}
    >
      {status}
    </span>
  );
}

function DecisionBadge({
  decision,
}: {
  decision: VerificationListItem['decision'];
}) {
  if (!decision) {
    return <span className="text-muted-foreground">—</span>;
  }
  const tone =
    decision === 'approved'
      ? 'bg-success/15 text-success'
      : decision === 'denied'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-warning/15 text-warning';
  const label =
    decision === 'approved'
      ? 'Aprovado'
      : decision === 'denied'
        ? 'Negado'
        : 'Revisão';
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-[11px] uppercase tracking-wide',
        tone,
      )}
    >
      {label}
    </span>
  );
}
