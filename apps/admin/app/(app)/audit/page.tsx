import type { Metadata } from 'next';
import {
  agekey,
  AgeKeyApiError,
  type AuditActorType,
  type AuditEventItem,
  type AuditListParams,
} from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { FilterBar } from './filter-bar';
import { AuditFeed } from './audit-feed';

export const metadata: Metadata = { title: 'Auditoria' };

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const ACTOR_TYPES: readonly AuditActorType[] = [
  'user',
  'api_key',
  'system',
  'cron',
] as const;

// Known resource_type values emitted by the audit triggers across the
// platform. Kept as a curated list (not derived) so the UI dropdown is
// stable even when a future migration introduces a new type — admins can
// fall back to the free-text input via the URL.
const KNOWN_RESOURCE_TYPES: readonly string[] = [
  'tenant',
  'application',
  'policy',
  'issuer',
  'crypto_key',
  'webhook_endpoint',
  'verification_session',
  'verification_result',
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Date-only ISO (YYYY-MM-DD). The server side combines this with T00:00:00Z.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pickString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function pickActorType(
  value: string | string[] | undefined,
): AuditActorType | undefined {
  const v = pickString(value);
  if (!v) return undefined;
  return (ACTOR_TYPES as readonly string[]).includes(v)
    ? (v as AuditActorType)
    : undefined;
}

function pickUuid(value: string | string[] | undefined): string | undefined {
  const v = pickString(value);
  if (!v) return undefined;
  return UUID_RE.test(v) ? v : undefined;
}

/**
 * Normalize a YYYY-MM-DD input to its UTC start-of-day ISO timestamp.
 * Returns undefined when the input is missing or not a plain date.
 */
function dateToFromIso(value: string | undefined): string | undefined {
  if (!value || !DATE_RE.test(value)) return undefined;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

/**
 * Normalize a YYYY-MM-DD input to the *next* day at 00:00 UTC, used as
 * the exclusive upper bound. This makes the "to" filter inclusive on the
 * day the user picked.
 */
function dateToToIso(value: string | undefined): string | undefined {
  if (!value || !DATE_RE.test(value)) return undefined;
  const t = new Date(`${value}T00:00:00.000Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString();
}

function defaultFromDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AuditPage({ searchParams }: PageProps) {
  await requireTenantContext();

  const action = pickString(searchParams.action);
  const resourceType = pickString(searchParams.resource_type);
  const resourceId = pickUuid(searchParams.resource_id);
  const actorType = pickActorType(searchParams.actor_type);
  const actorId = pickUuid(searchParams.actor_id);

  // Default last-7-days window so the page never tries to scan the whole
  // partition tree on first load.
  const fromDate = pickString(searchParams.from_date) ?? defaultFromDate();
  const toDate = pickString(searchParams.to_date) ?? defaultToDate();

  const fromIso = dateToFromIso(fromDate);
  const toIso = dateToToIso(toDate);

  const pageSizeRaw = pickString(searchParams.page_size);
  const pageSize = (() => {
    const n = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : NaN;
    if (n === 50 || n === 100 || n === 500) return n;
    return 100;
  })();

  const params: AuditListParams = {
    action: action && action.trim().length > 0 ? action.trim() : undefined,
    resource_type:
      resourceType && resourceType.trim().length > 0
        ? resourceType.trim()
        : undefined,
    resource_id: resourceId,
    actor_type: actorType,
    actor_id: actorId,
    from: fromIso,
    to: toIso,
    limit: pageSize,
  };

  let items: AuditEventItem[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;
  let loadError: string | null = null;

  try {
    const result = await agekey.audit.list(params);
    items = result.items;
    nextCursor = result.next_cursor;
    hasMore = result.has_more;
  } catch (err) {
    loadError =
      err instanceof AgeKeyApiError
        ? `Falha ao carregar auditoria (${err.reasonCode}).`
        : 'Falha ao carregar auditoria.';
  }

  const filterValues = {
    action: params.action ?? '',
    resource_type: params.resource_type ?? '',
    resource_id: params.resource_id ?? '',
    actor_type: params.actor_type ?? '',
    actor_id: params.actor_id ?? '',
    from_date: fromDate,
    to_date: toDate,
    page_size: String(pageSize),
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Feed de <code className="font-mono">audit_events</code> filtrável
          por ator, recurso e período. Eventos são append-only e
          particionados por mês. Export CSV limitado a 10.000 linhas por
          requisição.
        </p>
      </header>

      <FilterBar
        defaults={filterValues}
        knownResourceTypes={KNOWN_RESOURCE_TYPES}
      />

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </p>
      ) : (
        <AuditFeed
          initialItems={items}
          initialCursor={nextCursor}
          initialHasMore={hasMore}
          filters={{
            action: filterValues.action,
            resource_type: filterValues.resource_type,
            resource_id: filterValues.resource_id,
            actor_type: filterValues.actor_type,
            actor_id: filterValues.actor_id,
            from: fromIso ?? '',
            to: toIso ?? '',
            page_size: filterValues.page_size,
          }}
        />
      )}
    </div>
  );
}
