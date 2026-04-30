'use client';

// Client Component justification: form state via React Hook Form,
// controlled Dialog visibility, and a multi-checkbox controlled input
// require client-side interactivity.

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import { useEffect, useId, useState, useTransition } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ISSUER_FORMATS,
  IssuerFormSchema,
  type IssuerFormInput,
  type IssuerFormat,
} from '@/lib/validations/issuers';
import { saveIssuerAction, type IssuerActionState } from './actions';

const FORMAT_LABELS: Record<IssuerFormat, string> = {
  w3c_vc: 'W3C VC',
  sd_jwt_vc: 'SD-JWT VC',
  attestation: 'Attestation',
  'predicate-attestation-v1': 'Predicate Attestation v1',
};

const DEFAULT_VALUES: IssuerFormInput = {
  issuer_did: '',
  name: '',
  supports_formats: ['w3c_vc'],
  jwks_uri: undefined,
  public_keys_json_raw: '{"keys": []}',
  metadata_json_raw: undefined,
};

export function IssuerForm() {
  const [open, setOpen] = useState(false);
  const [serverState, setServerState] = useState<IssuerActionState>({
    status: 'idle',
  });
  const [isPending, startTransition] = useTransition();
  const titleId = useId();
  const descId = useId();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<IssuerFormInput>({
    resolver: zodResolver(IssuerFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (open) {
      reset(DEFAULT_VALUES);
      setServerState({ status: 'idle' });
    }
  }, [open, reset]);

  const onSubmit: SubmitHandler<IssuerFormInput> = (values) => {
    setServerState({ status: 'idle' });
    startTransition(async () => {
      const state = await saveIssuerAction(values);
      setServerState(state);
      if (state.status === 'success') {
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus aria-hidden="true" />
          Registrar emissor
        </Button>
      </DialogTrigger>

      <DialogContent
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle id={titleId}>Registrar emissor</DialogTitle>
          <DialogDescription id={descId}>
            Adicione um emissor confiável ao seu trust registry.
            Campos marcados com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
        >
          <Field
            label="DID do emissor *"
            error={errors.issuer_did?.message}
            htmlFor="issuer-did"
            hint="ex.: did:web:exemplo.com"
          >
            <Input
              id="issuer-did"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(errors.issuer_did)}
              {...register('issuer_did')}
            />
          </Field>

          <Field
            label="Nome *"
            error={errors.name?.message}
            htmlFor="issuer-name"
          >
            <Input
              id="issuer-name"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </Field>

          <Controller
            control={control}
            name="supports_formats"
            render={({ field, fieldState }) => (
              <Field
                label="Formatos suportados *"
                error={fieldState.error?.message}
                htmlFor="issuer-formats"
              >
                <fieldset
                  id="issuer-formats"
                  className="space-y-2 rounded-md border border-input bg-background/40 p-3"
                  aria-invalid={Boolean(fieldState.error)}
                >
                  <legend className="sr-only">Formatos suportados</legend>
                  {ISSUER_FORMATS.map((fmt) => {
                    const id = `issuer-fmt-${fmt}`;
                    const checked = field.value?.includes(fmt) ?? false;
                    return (
                      <label
                        key={fmt}
                        htmlFor={id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...(field.value ?? []), fmt]
                              : (field.value ?? []).filter((f) => f !== fmt);
                            field.onChange(next);
                          }}
                        />
                        <span>{FORMAT_LABELS[fmt]}</span>
                        <code className="ml-auto font-mono text-[11px] text-muted-foreground">
                          {fmt}
                        </code>
                      </label>
                    );
                  })}
                </fieldset>
              </Field>
            )}
          />

          <Field
            label="JWKS URI"
            error={errors.jwks_uri?.message}
            htmlFor="issuer-jwks"
            hint="Opcional. URL para o conjunto de chaves públicas em JWKS."
          >
            <Input
              id="issuer-jwks"
              type="url"
              inputMode="url"
              autoComplete="off"
              aria-invalid={Boolean(errors.jwks_uri)}
              {...register('jwks_uri')}
            />
          </Field>

          <Field
            label="Public keys (JSON)"
            error={errors.public_keys_json_raw?.message}
            htmlFor="issuer-pubkeys"
            hint='Opcional. Objeto JSON, ex.: {"keys": []}.'
          >
            <Textarea
              id="issuer-pubkeys"
              rows={4}
              spellCheck={false}
              className="font-mono text-xs"
              aria-invalid={Boolean(errors.public_keys_json_raw)}
              {...register('public_keys_json_raw')}
            />
          </Field>

          <Field
            label="Metadata (JSON)"
            error={errors.metadata_json_raw?.message}
            htmlFor="issuer-metadata"
            hint="Opcional. Metadata livre em formato JSON."
          >
            <Textarea
              id="issuer-metadata"
              rows={3}
              spellCheck={false}
              className="font-mono text-xs"
              aria-invalid={Boolean(errors.metadata_json_raw)}
              {...register('metadata_json_raw')}
            />
          </Field>

          {serverState.error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {serverState.error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Registrando…
                </>
              ) : (
                'Registrar emissor'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? (
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
