'use client';

import { Activity, Loader2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  WebhookDeliveryItem,
  WebhookDeliveryStatus,
} from '@/lib/agekey/client';
import { cn, formatDateTime } from '@/lib/utils';
import { listDeliveriesAction } from './actions';

interface DeliveriesModalProps {
  webhookId: string;
  webhookName: string;
}

const STATUS_FILTERS: ReadonlyArray<{
  value: WebhookDeliveryStatus | 'all';
  label: string;
}> = [
  { value: 'all', label: 'Todos' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'failed', label: 'Falhas' },
  { value: 'dead_letter', label: 'Dead-letter' },
];

export function DeliveriesModal({
  webhookId,
  webhookName,
}: DeliveriesModalProps) {
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    WebhookDeliveryStatus | 'all'
  >('all');
  const [items, setItems] = useState<WebhookDeliveryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = (filter: WebhookDeliveryStatus | 'all') => {
    setError(null);
    startTransition(async () => {
      const result = await listDeliveriesAction({
        endpoint_id: webhookId,
        ...(filter !== 'all' ? { status: filter } : {}),
        limit: 50,
      });
      if (result.ok) {
        setItems(result.data.items);
      } else {
        setError(result.error);
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setItems([]);
      setExpandedId(null);
      setStatusFilter('all');
      setError(null);
      return;
    }
    refresh('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, webhookId]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        <Activity aria-hidden="true" />
        Entregas
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Entregas — {webhookName}</DialogTitle>
            <DialogDescription>
              Últimas 50 entregas. Filtre por status para inspecionar falhas
              (incluindo dead-letter).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value;
              return (
                <Button
                  key={f.value}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  onClick={() => {
                    setStatusFilter(f.value);
                    refresh(f.value);
                  }}
                  disabled={isPending}
                >
                  {f.label}
                </Button>
              );
            })}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
            {isPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Carregando…
              </div>
            ) : items.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma entrega encontrada.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-accent/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-normal">Status</th>
                    <th className="px-3 py-2 font-normal">Evento</th>
                    <th className="px-3 py-2 font-normal">Tentativas</th>
                    <th className="px-3 py-2 font-normal">Resposta</th>
                    <th className="px-3 py-2 font-normal">Quando</th>
                    <th className="px-3 py-2 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isExpanded = expandedId === item.id;
                    return (
                      <tr
                        key={item.id}
                        className="border-t border-border align-top"
                      >
                        <td className="px-3 py-2">
                          <DeliveryStatusBadge status={item.status} />
                        </td>
                        <td className="px-3 py-2 font-mono">{item.event_type}</td>
                        <td className="px-3 py-2">{item.attempts}</td>
                        <td className="px-3 py-2 font-mono">
                          {item.last_response_code ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDateTime(item.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : item.id)
                            }
                          >
                            {isExpanded ? 'Esconder' : 'Detalhes'}
                          </Button>
                          {isExpanded ? (
                            <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2">
                              {item.last_error ? (
                                <p className="font-mono text-[11px] text-destructive">
                                  Erro: {item.last_error}
                                </p>
                              ) : null}
                              <p className="text-[11px] text-muted-foreground">
                                Idempotency-Key:{' '}
                                <span className="font-mono">
                                  {item.idempotency_key}
                                </span>
                              </p>
                              <pre className="max-h-48 overflow-auto rounded bg-background p-2 font-mono text-[11px]">
                                {JSON.stringify(item.payload_json, null, 2)}
                              </pre>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => refresh(statusFilter)}
              disabled={isPending}
            >
              Atualizar
            </Button>
            <Button onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeliveryStatusBadge({ status }: { status: WebhookDeliveryStatus }) {
  const tone =
    status === 'delivered'
      ? 'bg-success/15 text-success'
      : status === 'pending'
        ? 'bg-muted text-muted-foreground'
        : status === 'failed'
          ? 'bg-warning/15 text-warning'
          : 'bg-destructive/15 text-destructive';
  const label =
    status === 'delivered'
      ? 'Entregue'
      : status === 'pending'
        ? 'Pendente'
        : status === 'failed'
          ? 'Falha'
          : 'Dead-letter';
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
