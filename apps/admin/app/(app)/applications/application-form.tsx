'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Plus,
  X as XIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useState,
  useTransition,
  type KeyboardEvent,
} from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import {
  ApplicationWriteRequestSchema,
  type ApplicationWriteRequest,
} from '@/lib/validations/applications';
import {
  createApplicationAction,
  updateApplicationAction,
} from './actions';

export interface ApplicationFormInitial {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  callback_url: string | null;
  webhook_url: string | null;
  allowed_origins: string[];
}

interface ApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ApplicationFormInitial | null;
}

interface RevealValues {
  api_key: string;
  webhook_secret: string;
}

type FieldName =
  | 'name'
  | 'slug'
  | 'description'
  | 'callback_url'
  | 'webhook_url'
  | 'allowed_origins';

const EMPTY_DEFAULTS: ApplicationWriteRequest = {
  name: '',
  slug: '',
  description: undefined,
  callback_url: undefined,
  webhook_url: undefined,
  allowed_origins: [],
};

export function ApplicationForm({
  open,
  onOpenChange,
  initial,
}: ApplicationFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<RevealValues | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ApplicationWriteRequest>({
    resolver: zodResolver(ApplicationWriteRequestSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  // Re-sync defaults whenever the dialog opens or `initial` changes.
  useEffect(() => {
    if (!open) return;
    if (initial) {
      reset({
        id: initial.id,
        name: initial.name,
        slug: initial.slug,
        description: initial.description ?? undefined,
        callback_url: initial.callback_url ?? undefined,
        webhook_url: initial.webhook_url ?? undefined,
        allowed_origins: initial.allowed_origins,
      });
    } else {
      reset(EMPTY_DEFAULTS);
    }
    setServerError(null);
  }, [open, initial, reset]);

  const isEdit = Boolean(initial);

  const onSubmit: SubmitHandler<ApplicationWriteRequest> = (values) => {
    setServerError(null);
    const formData = new FormData();
    if (values.id) formData.set('id', values.id);
    formData.set('name', values.name);
    formData.set('slug', values.slug);
    if (values.description) formData.set('description', values.description);
    if (values.callback_url) formData.set('callback_url', values.callback_url);
    if (values.webhook_url) formData.set('webhook_url', values.webhook_url);
    formData.set('allowed_origins', JSON.stringify(values.allowed_origins));

    startTransition(async () => {
      if (isEdit) {
        const result = await updateApplicationAction(formData);
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

      const result = await createApplicationAction(formData);
      if (result.ok) {
        // Switch to the reveal step. Do NOT close the form dialog yet —
        // we close it explicitly after user confirms they saved the values.
        setReveal({
          api_key: result.api_key,
          webhook_secret: result.webhook_secret,
        });
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

  // Reveal dialog uses a separate Dialog instance so closing it cannot be
  // triggered by an outside click on the form; user must click "Já guardei".
  if (reveal) {
    return (
      <RevealDialog
        values={reveal}
        onAcknowledge={() => {
          setReveal(null);
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
          // Block accidental close while submitting.
          if (isPending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar aplicação' : 'Nova aplicação'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Atualize os dados da aplicação. A api_key e o webhook_secret não podem ser alterados aqui — use "Rotacionar chave".'
              : 'Cadastre uma nova aplicação. Após criar, você verá a api_key e o webhook_secret UMA ÚNICA VEZ.'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <input type="hidden" {...register('id')} />

          <div className="space-y-2">
            <Label htmlFor="app-name">Nome</Label>
            <Input
              id="app-name"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'app-name-error' : undefined}
              {...register('name')}
            />
            {errors.name ? (
              <p
                id="app-name-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-slug">Slug</Label>
            <Input
              id="app-slug"
              autoComplete="off"
              placeholder="loja-xyz"
              aria-invalid={Boolean(errors.slug)}
              aria-describedby={errors.slug ? 'app-slug-error' : undefined}
              {...register('slug')}
            />
            {errors.slug ? (
              <p
                id="app-slug-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.slug.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Apenas letras minúsculas, números e hífen.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-description">Descrição</Label>
            <Textarea
              id="app-description"
              rows={3}
              autoComplete="off"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? 'app-description-error' : undefined
              }
              {...register('description')}
            />
            {errors.description ? (
              <p
                id="app-description-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="app-callback-url">Callback URL</Label>
              <Input
                id="app-callback-url"
                type="url"
                inputMode="url"
                placeholder="https://app.cliente.com/return"
                autoComplete="off"
                aria-invalid={Boolean(errors.callback_url)}
                aria-describedby={
                  errors.callback_url ? 'app-callback-url-error' : undefined
                }
                {...register('callback_url')}
              />
              {errors.callback_url ? (
                <p
                  id="app-callback-url-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {errors.callback_url.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-webhook-url">Webhook URL</Label>
              <Input
                id="app-webhook-url"
                type="url"
                inputMode="url"
                placeholder="https://api.cliente.com/webhooks/agekey"
                autoComplete="off"
                aria-invalid={Boolean(errors.webhook_url)}
                aria-describedby={
                  errors.webhook_url ? 'app-webhook-url-error' : undefined
                }
                {...register('webhook_url')}
              />
              {errors.webhook_url ? (
                <p
                  id="app-webhook-url-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {errors.webhook_url.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-allowed-origins">Origens permitidas (CORS)</Label>
            <Controller
              control={control}
              name="allowed_origins"
              render={({ field }) => (
                <ChipsInput
                  id="app-allowed-origins"
                  values={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.allowed_origins)}
                  describedBy={
                    errors.allowed_origins
                      ? 'app-allowed-origins-error'
                      : 'app-allowed-origins-help'
                  }
                />
              )}
            />
            {errors.allowed_origins ? (
              <p
                id="app-allowed-origins-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.allowed_origins.message ??
                  'Cada origem precisa ser uma URL válida.'}
              </p>
            ) : (
              <p
                id="app-allowed-origins-help"
                className="text-xs text-muted-foreground"
              >
                Pressione Enter ou vírgula para adicionar. Até 50 origens.
              </p>
            )}
          </div>

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
                'Criar aplicação'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ChipsInputProps {
  id: string;
  values: string[];
  onChange: (next: string[]) => void;
  invalid: boolean;
  describedBy: string;
}

function ChipsInput({
  id,
  values,
  onChange,
  invalid,
  describedBy,
}: ChipsInputProps) {
  const [draft, setDraft] = useState('');

  const commit = useCallback(() => {
    const trimmed = draft.trim().replace(/,$/, '').trim();
    if (!trimmed) {
      setDraft('');
      return;
    }
    if (values.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...values, trimmed]);
    setDraft('');
  }, [draft, values, onChange]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === 'Backspace' && draft.length === 0 && values.length > 0) {
      event.preventDefault();
      onChange(values.slice(0, -1));
    }
  };

  const remove = (origin: string) => {
    onChange(values.filter((v) => v !== origin));
  };

  return (
    <div
      className="flex flex-wrap gap-2 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1"
      aria-invalid={invalid}
    >
      {values.map((origin) => (
        <span
          key={origin}
          className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-xs"
        >
          <span className="font-mono">{origin}</span>
          <button
            type="button"
            onClick={() => remove(origin)}
            aria-label={`Remover ${origin}`}
            className="rounded p-0.5 transition-colors hover:bg-destructive/20 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <XIcon className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        type="url"
        inputMode="url"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={
          values.length === 0 ? 'https://app.cliente.com' : 'Adicionar mais…'
        }
        className="flex-1 min-w-[160px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        aria-describedby={describedBy}
      />
    </div>
  );
}

interface RevealDialogProps {
  values: RevealValues;
  onAcknowledge: () => void;
}

function RevealDialog({ values, onAcknowledge }: RevealDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Ignore programmatic close attempts; user must click "Já guardei".
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
            Guarde estes valores agora
          </DialogTitle>
          <DialogDescription className="text-foreground/90">
            Estes valores aparecem{' '}
            <strong className="font-semibold">APENAS UMA VEZ</strong>. Guarde-os
            em local seguro AGORA. Se você fechar esta janela sem copiar, será
            necessário rotacionar a chave.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <SecretField label="API key" value={values.api_key} />
          <SecretField label="Webhook secret" value={values.webhook_secret} />
        </div>

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

export function NewApplicationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus aria-hidden="true" />
        Nova aplicação
      </Button>
      <ApplicationForm open={open} onOpenChange={setOpen} initial={null} />
    </>
  );
}

export function EditApplicationButton({
  application,
}: {
  application: ApplicationFormInitial;
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
      <ApplicationForm
        open={open}
        onOpenChange={setOpen}
        initial={application}
      />
    </>
  );
}
