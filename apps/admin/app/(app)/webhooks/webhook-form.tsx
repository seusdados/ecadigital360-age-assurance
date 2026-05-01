'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Check, Copy, Loader2, Plus } from 'lucide-react';
import { useEffect, useId, useState, useTransition } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  WEBHOOK_EVENT_TYPES,
  WebhookEndpointWriteRequestSchema,
  type WebhookEventType,
  type WebhookFormValues,
} from '@/lib/validations/webhooks';
import type { ApplicationListItem } from '@/lib/agekey/client';
import {
  createWebhookAction,
  updateWebhookAction,
} from './actions';

export interface WebhookFormInitial {
  id: string;
  application_id: string;
  name: string;
  url: string;
  event_types: string[];
  active: boolean;
}

interface WebhookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: WebhookFormInitial | null;
  applications: ApplicationListItem[];
}

type FieldName = 'application_id' | 'name' | 'url' | 'event_types' | 'active';

const EVENT_LABELS: Record<WebhookEventType, string> = {
  'verification.created': 'Verificação criada',
  'verification.completed': 'Verificação concluída',
  'verification.expired': 'Verificação expirada',
  'verification.cancelled': 'Verificação cancelada',
  'token.revoked': 'Token revogado',
  'policy.updated': 'Política atualizada',
  'application.suspended': 'Aplicação suspensa',
};

export function WebhookForm({
  open,
  onOpenChange,
  initial,
  applications,
}: WebhookFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultApplicationId =
    initial?.application_id ?? applications[0]?.id ?? '';

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<WebhookFormValues>({
    resolver: zodResolver(WebhookEndpointWriteRequestSchema),
    defaultValues: {
      application_id: defaultApplicationId,
      name: '',
      url: '',
      event_types: ['verification.completed'],
      active: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      reset({
        id: initial.id,
        application_id: initial.application_id,
        name: initial.name,
        url: initial.url,
        event_types: (initial.event_types as WebhookEventType[]) ?? [
          'verification.completed',
        ],
        active: initial.active,
      });
    } else {
      reset({
        application_id: defaultApplicationId,
        name: '',
        url: '',
        event_types: ['verification.completed'],
        active: true,
      });
    }
    setServerError(null);
  }, [open, initial, reset, defaultApplicationId]);

  const isEdit = Boolean(initial);

  const onSubmit: SubmitHandler<WebhookFormValues> = (values) => {
    setServerError(null);
    const formData = new FormData();
    if (values.id) formData.set('id', values.id);
    formData.set('application_id', values.application_id);
    formData.set('name', values.name);
    formData.set('url', values.url);
    formData.set('event_types', JSON.stringify(values.event_types));
    formData.set('active', values.active ? 'true' : 'false');

    startTransition(async () => {
      if (isEdit) {
        const result = await updateWebhookAction(formData);
        if (result.ok) {
          onOpenChange(false);
          return;
        }
        if (result.fieldErrors) {
          for (const [key, messages] of Object.entries(result.fieldErrors)) {
            const firstMessage = messages?.[0];
            if (firstMessage) {
              setError(key as FieldName, { message: firstMessage });
            }
          }
        }
        if (result.error) setServerError(result.error);
        return;
      }

      const result = await createWebhookAction(formData);
      if (result.ok) {
        setRevealSecret(result.raw_secret);
        return;
      }
      if (result.fieldErrors) {
        for (const [key, messages] of Object.entries(result.fieldErrors)) {
          const firstMessage = messages?.[0];
          if (firstMessage) {
            setError(key as FieldName, { message: firstMessage });
          }
        }
      }
      if (result.error) setServerError(result.error);
    });
  };

  if (revealSecret) {
    return (
      <RevealSecretDialog
        rawSecret={revealSecret}
        onAcknowledge={() => {
          setRevealSecret(null);
          onOpenChange(false);
        }}
      />
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-xl"
        onInteractOutside={(event) => {
          if (isPending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar webhook' : 'Novo webhook'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Atualize URL, nome e eventos. O secret de assinatura não muda — use "Rotacionar secret".'
              : 'Cadastre um endpoint que receberá eventos do AgeKey. O secret de assinatura HMAC será exibido UMA ÚNICA VEZ.'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <input type="hidden" {...register('id')} />

          <div className="space-y-2">
            <Label htmlFor="webhook-app">Aplicação</Label>
            <select
              id="webhook-app"
              disabled={isEdit}
              aria-invalid={Boolean(errors.application_id)}
              aria-describedby={
                errors.application_id ? 'webhook-app-error' : undefined
              }
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              {...register('application_id')}
            >
              <option value="">Selecione…</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.slug})
                </option>
              ))}
            </select>
            {errors.application_id ? (
              <p
                id="webhook-app-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.application_id.message}
              </p>
            ) : isEdit ? (
              <p className="text-xs text-muted-foreground">
                A aplicação não pode ser alterada depois de criar o webhook.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-name">Nome</Label>
            <Input
              id="webhook-name"
              autoComplete="off"
              placeholder="Backend principal"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'webhook-name-error' : undefined}
              {...register('name')}
            />
            {errors.name ? (
              <p
                id="webhook-name-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL</Label>
            <Input
              id="webhook-url"
              type="url"
              inputMode="url"
              placeholder="https://api.cliente.com/webhooks/agekey"
              autoComplete="off"
              aria-invalid={Boolean(errors.url)}
              aria-describedby={errors.url ? 'webhook-url-error' : 'webhook-url-help'}
              {...register('url')}
            />
            {errors.url ? (
              <p
                id="webhook-url-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.url.message}
              </p>
            ) : (
              <p
                id="webhook-url-help"
                className="text-xs text-muted-foreground"
              >
                Apenas https. Hosts internos (10.x, 192.168.x, localhost…) são
                bloqueados.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Eventos subscritos</Label>
            <Controller
              control={control}
              name="event_types"
              render={({ field }) => (
                <div className="grid gap-2 rounded-md border border-input bg-background p-3 sm:grid-cols-2">
                  {WEBHOOK_EVENT_TYPES.map((eventType) => {
                    const checked = field.value.includes(eventType);
                    return (
                      <label
                        key={eventType}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onChange={(event) => {
                            const isChecked = event.currentTarget.checked;
                            const next = isChecked
                              ? [...new Set([...field.value, eventType])]
                              : field.value.filter((v) => v !== eventType);
                            field.onChange(next);
                          }}
                        />
                        <span className="font-mono text-xs">{eventType}</span>
                        <span className="text-muted-foreground">
                          — {EVENT_LABELS[eventType]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.event_types ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.event_types.message ?? 'Selecione ao menos um evento.'}
              </p>
            ) : null}
          </div>

          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
                <span>Ativo (entregas habilitadas)</span>
              </label>
            )}
          />

          {serverError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {serverError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Salvando…
                </>
              ) : isEdit ? (
                'Salvar alterações'
              ) : (
                'Criar webhook'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevealSecretDialog({
  rawSecret,
  onAcknowledge,
}: {
  rawSecret: string;
  onAcknowledge: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) return;
      }}
    >
      <DialogContent
        className="max-w-lg"
        hideCloseButton
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Guarde este secret agora
          </DialogTitle>
          <DialogDescription className="text-foreground/90">
            Este secret aparece{' '}
            <strong className="font-semibold">APENAS UMA VEZ</strong>.
            Configure-o no seu backend para verificar a assinatura
            HMAC-SHA256 dos eventos. Se você fechar sem copiar, será
            necessário rotacionar.
          </DialogDescription>
        </DialogHeader>

        <SecretField label="Webhook secret" value={rawSecret} />

        <DialogFooter>
          <Button onClick={onAcknowledge}>Já guardei</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SecretField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  const fieldId = useId();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={fieldId}>{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCopy}
          aria-live="polite"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copiar
            </>
          )}
        </Button>
      </div>
      <Input
        id={fieldId}
        readOnly
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className="font-mono text-xs"
      />
    </div>
  );
}

export function NewWebhookButton({
  applications,
}: {
  applications: ApplicationListItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus aria-hidden="true" />
        Novo webhook
      </Button>
      <WebhookForm
        open={open}
        onOpenChange={setOpen}
        initial={null}
        applications={applications}
      />
    </>
  );
}

export function EditWebhookButton({
  webhook,
  applications,
}: {
  webhook: WebhookFormInitial;
  applications: ApplicationListItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        Editar
      </Button>
      <WebhookForm
        open={open}
        onOpenChange={setOpen}
        initial={webhook}
        applications={applications}
      />
    </>
  );
}
