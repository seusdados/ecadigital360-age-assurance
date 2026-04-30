'use client';

// Client component: drives the two-step flow (form → secrets reveal),
// uses React Hook Form + Zod resolver for live validation, and the
// Web Clipboard API for one-time copy of api_key / webhook_secret.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Copy, Loader2 } from 'lucide-react';
import {
  TenantBootstrapRequestSchema,
  type TenantBootstrapRequest,
  type TenantBootstrapResponse,
} from '@agekey/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { bootstrapTenantAction } from './actions';

interface OnboardingFormProps {
  userEmail: string;
}

const DEFAULT_VALUES: TenantBootstrapRequest = {
  tenant: {
    name: '',
    slug: '',
    jurisdiction_code: 'BR',
  },
  application: {
    name: '',
    slug: '',
  },
};

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function OnboardingForm({ userEmail }: OnboardingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<TenantBootstrapResponse | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TenantBootstrapRequest>({
    resolver: zodResolver(TenantBootstrapRequestSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
  });

  // Auto-suggest tenant.slug as the user types tenant.name (only while the
  // field hasn't been manually edited).
  const [tenantSlugDirty, setTenantSlugDirty] = useState(false);
  const [appSlugDirty, setAppSlugDirty] = useState(false);
  const tenantName = watch('tenant.name');
  const appName = watch('application.name');

  useEffect(() => {
    if (!tenantSlugDirty) {
      setValue('tenant.slug', slugify(tenantName ?? ''), {
        shouldValidate: false,
      });
    }
  }, [tenantName, tenantSlugDirty, setValue]);

  useEffect(() => {
    if (!appSlugDirty) {
      setValue('application.slug', slugify(appName ?? ''), {
        shouldValidate: false,
      });
    }
  }, [appName, appSlugDirty, setValue]);

  const onSubmit = (values: TenantBootstrapRequest) => {
    setServerError(null);
    startTransition(async () => {
      const result = await bootstrapTenantAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [path, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) {
              setError(path as never, { message: messages[0] });
            }
          }
        }
        setServerError(result.error);
        return;
      }
      setSecrets(result.data);
    });
  };

  if (secrets) {
    return (
      <SecretsStep
        secrets={secrets}
        onContinue={() => {
          router.replace('/dashboard');
          router.refresh();
        }}
      />
    );
  }

  const submitting = isSubmitting || isPending;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 rounded-lg border border-border bg-card p-6"
      noValidate
    >
      <fieldset className="space-y-4">
        <legend className="text-xs uppercase tracking-widest text-muted-foreground">
          Sua organização
        </legend>

        <Field
          id="tenant-name"
          label="Nome do tenant"
          error={errors.tenant?.name?.message}
        >
          <Input
            id="tenant-name"
            autoComplete="organization"
            aria-invalid={Boolean(errors.tenant?.name)}
            {...register('tenant.name')}
          />
        </Field>

        <Field
          id="tenant-slug"
          label="Slug do tenant"
          hint="Identificador kebab-case usado em URLs internas. Sugerido a partir do nome."
          error={errors.tenant?.slug?.message}
        >
          <Input
            id="tenant-slug"
            autoComplete="off"
            aria-invalid={Boolean(errors.tenant?.slug)}
            {...register('tenant.slug', {
              onChange: () => setTenantSlugDirty(true),
            })}
          />
        </Field>

        <Field
          id="tenant-jurisdiction"
          label="Jurisdição"
          hint="Define padrões regulatórios aplicáveis (LGPD/GDPR)."
          error={errors.tenant?.jurisdiction_code?.message}
        >
          <Controller
            control={control}
            name="tenant.jurisdiction_code"
            render={({ field }) => (
              <select
                id="tenant-jurisdiction"
                {...field}
                value={field.value ?? 'BR'}
                aria-invalid={Boolean(errors.tenant?.jurisdiction_code)}
                className={cn(
                  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                )}
              >
                <option value="BR">Brasil (LGPD)</option>
                <option value="EU">União Europeia (GDPR)</option>
              </select>
            )}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs uppercase tracking-widest text-muted-foreground">
          Sua primeira aplicação
        </legend>

        <Field
          id="app-name"
          label="Nome da aplicação"
          error={errors.application?.name?.message}
        >
          <Input
            id="app-name"
            autoComplete="off"
            aria-invalid={Boolean(errors.application?.name)}
            {...register('application.name')}
          />
        </Field>

        <Field
          id="app-slug"
          label="Slug da aplicação"
          hint="Identificador exibido em integrações e relatórios."
          error={errors.application?.slug?.message}
        >
          <Input
            id="app-slug"
            autoComplete="off"
            aria-invalid={Boolean(errors.application?.slug)}
            {...register('application.slug', {
              onChange: () => setAppSlugDirty(true),
            })}
          />
        </Field>
      </fieldset>

      {serverError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Logado como <span className="font-mono">{userEmail}</span>
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Criando…
            </>
          ) : (
            'Criar tenant'
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SecretsStep({
  secrets,
  onContinue,
}: {
  secrets: TenantBootstrapResponse;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Tudo pronto
        </p>
        <h1 className="text-md font-thin">Guarde suas credenciais</h1>
        <p className="text-sm text-muted-foreground">
          Tenant <code className="font-mono">{secrets.tenant_slug}</code> e
          aplicação <code className="font-mono">{secrets.application_slug}</code>{' '}
          criados com sucesso.
        </p>
      </header>

      <div
        role="alert"
        className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm text-warning"
      >
        <strong className="block font-normal">Exposição única.</strong>
        <span className="text-warning/90">
          Estes valores não serão mostrados novamente. Copie e armazene em local
          seguro (cofre/secret manager) antes de continuar.
        </span>
      </div>

      <div className="space-y-4">
        <SecretField label="API key" value={secrets.api_key} />
        <SecretField label="Webhook secret" value={secrets.webhook_secret} />
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue}>Continuar</Button>
      </div>
    </div>
  );
}

function SecretField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-stretch gap-2">
        <code
          className={cn(
            'flex min-w-0 flex-1 items-center break-all rounded-md border border-border',
            'bg-background px-3 py-2 font-mono text-xs',
          )}
        >
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          onClick={onCopy}
          aria-label={`Copiar ${label}`}
        >
          {copied ? (
            <>
              <Check aria-hidden="true" />
              Copiado
            </>
          ) : (
            <>
              <Copy aria-hidden="true" />
              Copiar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
