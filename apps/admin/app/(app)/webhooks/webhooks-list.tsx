'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
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
  ApplicationListItem,
  WebhookDeliveryStatus,
  WebhookEndpointItem,
} from '@/lib/agekey/client';
import { cn, formatDateTime } from '@/lib/utils';
import { deleteWebhookAction } from './actions';
import { DeliveriesModal } from './deliveries-modal';
import { RotateSecretModal } from './rotate-secret-modal';
import {
  EditWebhookButton,
  type WebhookFormInitial,
} from './webhook-form';

interface WebhooksListProps {
  webhooks: WebhookEndpointItem[];
  applications: ApplicationListItem[];
}

export function WebhooksList({ webhooks, applications }: WebhooksListProps) {
  const appNameById = new Map(applications.map((a) => [a.id, a.name]));

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-accent/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <Th>Nome</Th>
            <Th>Aplicação</Th>
            <Th>URL</Th>
            <Th>Status</Th>
            <Th>Última entrega</Th>
            <Th>Eventos</Th>
            <Th>Criado em</Th>
            <Th>
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {webhooks.map((webhook) => {
            const initial: WebhookFormInitial = {
              id: webhook.id,
              application_id: webhook.application_id,
              name: webhook.name,
              url: webhook.url,
              event_types: webhook.event_types,
              active: webhook.status === 'active',
            };
            return (
              <tr
                key={webhook.id}
                className="border-t border-border transition hover:bg-accent/20"
              >
                <Td>{webhook.name}</Td>
                <Td className="text-muted-foreground">
                  {appNameById.get(webhook.application_id) ??
                    webhook.application_id.slice(0, 8)}
                </Td>
                <Td className="max-w-[260px]">
                  <a
                    href={webhook.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={webhook.url}
                    className="block truncate text-primary underline-offset-4 hover:underline"
                  >
                    {webhook.url}
                  </a>
                </Td>
                <Td>
                  <StatusBadge status={webhook.status} />
                </Td>
                <Td>
                  <DeliveryRollupBadge
                    status={webhook.last_delivery_status}
                    at={webhook.last_delivery_at}
                  />
                </Td>
                <Td className="text-xs text-muted-foreground">
                  {webhook.event_types.length === 0
                    ? 'todos'
                    : `${webhook.event_types.length}`}
                </Td>
                <Td className="text-muted-foreground">
                  {formatDateTime(webhook.created_at)}
                </Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1">
                    <EditWebhookButton
                      webhook={initial}
                      applications={applications}
                    />
                    <RotateSecretModal
                      webhookId={webhook.id}
                      webhookName={webhook.name}
                    />
                    <DeliveriesModal
                      webhookId={webhook.id}
                      webhookName={webhook.name}
                    />
                    <DeleteWebhookButton
                      webhookId={webhook.id}
                      applicationId={webhook.application_id}
                      webhookName={webhook.name}
                    />
                  </div>
                </Td>
              </tr>
            );
          })}
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
  status: 'active' | 'inactive' | 'suspended';
}) {
  const tone =
    status === 'active'
      ? 'bg-success/15 text-success'
      : status === 'suspended'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-muted text-muted-foreground';
  const label =
    status === 'active'
      ? 'Ativo'
      : status === 'suspended'
        ? 'Suspenso'
        : 'Inativo';
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

function DeliveryRollupBadge({
  status,
  at,
}: {
  status: WebhookDeliveryStatus | null | undefined;
  at: string | null | undefined;
}) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
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
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          'inline-block rounded px-2 py-0.5 text-[11px] uppercase tracking-wide',
          tone,
        )}
      >
        {label}
      </span>
      {at ? (
        <span className="text-[11px] text-muted-foreground">
          {formatDateTime(at)}
        </span>
      ) : null}
    </div>
  );
}

function DeleteWebhookButton({
  webhookId,
  applicationId,
  webhookName,
}: {
  webhookId: string;
  applicationId: string;
  webhookName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteWebhookAction(webhookId, applicationId);
      if (result.ok) {
        setOpen(false);
        return;
      }
      setError(result.error);
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden="true" />
        Remover
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) return;
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Remover webhook {webhookName}?
            </DialogTitle>
            <DialogDescription>
              O endpoint deixa de receber eventos imediatamente. Histórico de
              entregas é preservado para auditoria. Operação reversível apenas
              recriando o webhook (com novo secret).
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Removendo…
                </>
              ) : (
                'Confirmar remoção'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
