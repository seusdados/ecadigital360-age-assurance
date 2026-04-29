'use client';

// Client Component justification:
//   - Toggles expansion of a row's diff_json on click.
//   - Concatenates additional pages fetched via the loadMoreAuditAction
//     Server Action without re-navigating the whole page.

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatDateTime, shortId } from '@/lib/utils';
import type { AuditEventItem } from '@/lib/agekey/client';
import { loadMoreAuditAction } from './actions';

interface AuditFeedProps {
  initialItems: AuditEventItem[];
  initialCursor: string | null;
  initialHasMore: boolean;
  filters: {
    action: string;
    resource_type: string;
    actor_type: string;
    from: string;
    to: string;
  };
}

export function AuditFeed({
  initialItems,
  initialCursor,
  initialHasMore,
  filters,
}: AuditFeedProps) {
  const [items, setItems] = useState<AuditEventItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleLoadMore() {
    if (!cursor) return;
    const formData = new FormData();
    formData.set('cursor', cursor);
    if (filters.action) formData.set('action', filters.action);
    if (filters.resource_type)
      formData.set('resource_type', filters.resource_type);
    if (filters.actor_type) formData.set('actor_type', filters.actor_type);
    if (filters.from) formData.set('from', filters.from);
    if (filters.to) formData.set('to', filters.to);

    startTransition(async () => {
      const result = await loadMoreAuditAction(
        {
          items: [],
          next_cursor: null,
          has_more: false,
          error: null,
        },
        formData,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      // De-duplicate just in case the cursor edge overlaps.
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...result.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(result.next_cursor);
      setHasMore(result.has_more);
      setError(null);
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <p className="text-sm">Nenhum evento de auditoria.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Eventos aparecem aqui à medida que recursos são criados, alterados
          ou removidos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-accent/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-8 px-2 py-2 font-normal">
                <span className="sr-only">Expandir detalhes</span>
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Quando
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Ator
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Ação
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Recurso
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                ID
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                IP
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((event) => {
              const isOpen = expanded.has(event.id);
              const detailsId = `audit-details-${event.id}`;
              return (
                <tr
                  key={event.id}
                  className="border-t border-border align-middle transition hover:bg-accent/20"
                >
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(event.id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-expanded={isOpen}
                      aria-controls={detailsId}
                      aria-label={
                        isOpen
                          ? 'Ocultar detalhes do evento'
                          : 'Mostrar detalhes do evento'
                      }
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <ActorBadge actor={event.actor_type} />
                  </td>
                  <td className="px-3 py-2">
                    <code className="font-mono text-xs">{event.action}</code>
                  </td>
                  <td className="px-3 py-2 text-xs">{event.resource_type}</td>
                  <td className="px-3 py-2">
                    {event.resource_id ? (
                      <code
                        className="font-mono text-xs text-muted-foreground"
                        title={event.resource_id}
                      >
                        {shortId(event.resource_id)}
                      </code>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                    {event.client_ip ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Detail rows — rendered as full-width sections in their own tbody-like
            block so columns don't have to align with the header. */}
        <div className="divide-y divide-border border-t border-border">
          {items
            .filter((event) => expanded.has(event.id))
            .map((event) => (
              <section
                key={`details-${event.id}`}
                id={`audit-details-${event.id}`}
                className="bg-accent/10 px-4 py-3"
                aria-label={`Detalhes do evento ${event.action}`}
              >
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  diff_json — {event.action}
                </p>
                <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed">
                  {formatJson(event.diff_json)}
                </pre>
              </section>
            ))}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Carregando…
              </>
            ) : (
              'Carregar mais'
            )}
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Fim do feed.
        </p>
      )}
    </div>
  );
}

function ActorBadge({ actor }: { actor: AuditEventItem['actor_type'] }) {
  const tone =
    actor === 'user'
      ? 'bg-primary/15 text-primary'
      : actor === 'api_key'
        ? 'bg-success/15 text-success'
        : actor === 'cron'
          ? 'bg-warning/15 text-warning'
          : 'bg-muted text-muted-foreground';
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-[11px] uppercase tracking-wide',
        tone,
      )}
    >
      {actor}
    </span>
  );
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
