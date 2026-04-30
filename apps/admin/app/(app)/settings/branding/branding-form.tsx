'use client';

// Client Component justification: react-hook-form-style controlled fields
// would be heavy here; we use useFormState + useFormStatus to surface
// validation/persistence feedback and a synced range+number input pair.

import { useFormState, useFormStatus } from 'react-dom';
import { useState, type ChangeEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  updateBrandingAction,
  type BrandingActionState,
} from './actions';

interface BrandingFormProps {
  defaults: {
    primary_color: string;
    logo_url: string;
    support_email: string;
    retention_days: number;
  };
  canEdit: boolean;
}

const initialState: BrandingActionState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          Salvando…
        </>
      ) : (
        'Salvar branding'
      )}
    </Button>
  );
}

export function BrandingForm({ defaults, canEdit }: BrandingFormProps) {
  const [state, formAction] = useFormState(updateBrandingAction, initialState);
  const [retention, setRetention] = useState<number>(defaults.retention_days);

  function handleRetentionChange(event: ChangeEvent<HTMLInputElement>) {
    const next = Number(event.currentTarget.value);
    if (Number.isFinite(next)) setRetention(next);
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <fieldset
        disabled={!canEdit}
        className="space-y-5 disabled:opacity-70"
        aria-describedby={!canEdit ? 'branding-readonly-hint' : undefined}
      >
        <div className="space-y-2">
          <Label htmlFor="primary_color">Cor primária</Label>
          <div className="flex items-center gap-3">
            <Input
              id="primary_color"
              name="primary_color"
              type="color"
              defaultValue={defaults.primary_color || '#d97706'}
              className="h-9 w-16 cursor-pointer p-1"
              aria-invalid={Boolean(state.fieldErrors.primary_color)}
              aria-describedby={
                state.fieldErrors.primary_color
                  ? 'primary-color-error'
                  : 'primary-color-hint'
              }
            />
            <p id="primary-color-hint" className="text-xs text-muted-foreground">
              Cor de destaque do widget e do hub do usuário.
            </p>
          </div>
          {state.fieldErrors.primary_color ? (
            <p
              id="primary-color-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {state.fieldErrors.primary_color[0]}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="logo_url">URL do logo</Label>
          <Input
            id="logo_url"
            name="logo_url"
            type="url"
            inputMode="url"
            defaultValue={defaults.logo_url}
            placeholder="https://cdn.exemplo.com/logo.svg"
            autoComplete="off"
            aria-invalid={Boolean(state.fieldErrors.logo_url)}
            aria-describedby={
              state.fieldErrors.logo_url ? 'logo-url-error' : undefined
            }
          />
          {state.fieldErrors.logo_url ? (
            <p
              id="logo-url-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {state.fieldErrors.logo_url[0]}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="support_email">E-mail de suporte</Label>
          <Input
            id="support_email"
            name="support_email"
            type="email"
            inputMode="email"
            defaultValue={defaults.support_email}
            placeholder="suporte@exemplo.com"
            autoComplete="off"
            aria-invalid={Boolean(state.fieldErrors.support_email)}
            aria-describedby={
              state.fieldErrors.support_email
                ? 'support-email-error'
                : undefined
            }
          />
          {state.fieldErrors.support_email ? (
            <p
              id="support-email-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {state.fieldErrors.support_email[0]}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="retention_days">Retenção de dados (dias)</Label>
            <span
              aria-live="polite"
              className="font-mono text-xs text-muted-foreground"
            >
              {retention} dias
            </span>
          </div>
          <input
            id="retention_days"
            name="retention_days"
            type="range"
            min={30}
            max={365}
            step={1}
            value={retention}
            onChange={handleRetentionChange}
            className="w-full accent-primary"
            aria-invalid={Boolean(state.fieldErrors.retention_days)}
            aria-describedby={
              state.fieldErrors.retention_days
                ? 'retention-days-error'
                : 'retention-days-hint'
            }
          />
          <p id="retention-days-hint" className="text-xs text-muted-foreground">
            Define por quantos dias mantemos artefatos, sessões e
            <code className="mx-1 font-mono">audit_events</code> antes do
            expurgo. Mínimo 30, máximo 365.
          </p>
          {state.fieldErrors.retention_days ? (
            <p
              id="retention-days-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {state.fieldErrors.retention_days[0]}
            </p>
          ) : null}
        </div>
      </fieldset>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Branding atualizado com sucesso.
        </p>
      ) : null}

      <SubmitButton disabled={!canEdit} />
    </form>
  );
}
