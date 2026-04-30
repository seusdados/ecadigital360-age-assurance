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

function pickString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isValidIso(value: string | undefined): value is string {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
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

export default async function AuditPage({ searchParams }: PageProps) {
  await requireTenantContext();

  const action = pickString(searchParams.action);
  const resourceType = pickString(searchParams.resource_type);
  const actorType = pickActorType(searchParams.actor_type);
  const fromRaw = pickString(searchParams.from);
  const toRaw = pickString(searchParams.to);

  const from = isValidIso(fromRaw) ? fromRaw : undefined;
  const to = isValidIso(toRaw) ? toRaw : undefined;

  const params: AuditListParams = {
    action: action && action.trim().length > 0 ? action.trim() : undefined,
    resource_type:
      resourceType && resourceType.trim().length > 0
        ? resourceType.trim()
        : undefined,
    actor_type: actorType,
    from,
    to,
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
    actor_type: params.actor_type ?? '',
    from: params.from ?? '',
    to: params.to ?? '',
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-md font-thin">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Feed de <code className="font-mono">audit_events</code> filtrável por
          recurso, ator e período. Eventos são append-only e particionados por
          mês.
        </p>
      </header>

      <FilterBar defaults={filterValues} />

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
          filters={filterValues}
        />
      )}
    </div>
  );
}
