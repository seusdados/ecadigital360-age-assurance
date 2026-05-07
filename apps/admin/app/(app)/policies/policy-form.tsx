'use client';

// Client Component justification: this form needs interactive state
// (React Hook Form), a controlled Dialog, ordered multi-select with
// keyboard arrows, and live slug suggestions — none of which can be
// expressed declaratively in a Server Component.

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Loader2, Plus, Pencil } from 'lucide-react';
import { useEffect, useId, useMemo, useState, useTransition } from 'react';
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
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  ASSURANCE_LEVELS,
  JURISDICTION_CODES,
  POLICY_METHODS,
  PolicyFormSchema,
  suggestSlug,
  type PolicyFormInput,
  type PolicyMethod,
} from '@/lib/validations/policies';
import { savePolicyAction, type PolicyActionState } from './actions';

interface PolicyTemplate {
  id: string;
  name: string;
  slug: string;
}

interface PolicyFormProps {
  mode?: 'create' | 'edit';
  initial?: Partial<PolicyFormInput> & { id?: string };
  templates?: PolicyTemplate[];
  triggerLabel?: string;
}

const DEFAULT_VALUES: PolicyFormInput = {
  slug: '',
  name: '',
  description: undefined,
  age_threshold: 18,
  jurisdiction_code: undefined,
  method_priority_json: ['zkp', 'vc', 'gateway', 'fallback'],
  required_assurance_level: 'substantial',
  token_ttl_seconds: 86400,
  cloned_from_id: undefined,
  id: undefined,
};

const METHOD_LABELS: Record<PolicyMethod, string> = {
  zkp: 'ZKP (zero-knowledge proof)',
  vc: 'Verifiable Credential',
  gateway: 'Gateway externo',
  fallback: 'Fallback manual',
};

const ASSURANCE_LABELS: Record<(typeof ASSURANCE_LEVELS)[number], string> = {
  low: 'Baixo (low)',
  substantial: 'Substancial (substantial)',
  high: 'Alto (high)',
};

function formatHours(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const hours = seconds / 3600;
  if (hours >= 1) {
    return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`;
  }
  const minutes = seconds / 60;
  return `${minutes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min`;
}

export function PolicyForm({
  mode = 'create',
  initial,
  templates = [],
  triggerLabel,
}: PolicyFormProps) {
  const [open, setOpen] = useState(false);
  const [serverState, setServerState] = useState<PolicyActionState>({
    status: 'idle',
  });
  const [isPending, startTransition] = useTransition();
  const titleId = useId();
  const descId = useId();

  const computedDefaults = useMemo<PolicyFormInput>(
    () => ({
      ...DEFAULT_VALUES,
      ...initial,
      // Normalize undefined for select/textarea controls in the form.
      description: initial?.description ?? undefined,
      jurisdiction_code: initial?.jurisdiction_code ?? undefined,
      cloned_from_id: initial?.cloned_from_id ?? undefined,
      method_priority_json:
        initial?.method_priority_json ?? DEFAULT_VALUES.method_priority_json,
    }),
    [initial],
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<PolicyFormInput>({
    resolver: zodResolver(PolicyFormSchema),
    defaultValues: computedDefaults,
    mode: 'onBlur',
  });

  // Reset whenever the dialog reopens or the initial payload changes.
  useEffect(() => {
    if (open) {
      reset(computedDefaults);
      setServerState({ status: 'idle' });
    }
  }, [open, computedDefaults, reset]);

  const watchedName = watch('name');
  const watchedTtl = watch('token_ttl_seconds');

  // Auto-suggest slug from name only while the user hasn't edited it
  // manually and we're in create mode. In edit mode the slug is locked
  // to the persisted value to avoid breaking external references.
  useEffect(() => {
    if (mode !== 'create') return;
    if (dirtyFields.slug) return;
    const suggested = suggestSlug(watchedName ?? '');
    setValue('slug', suggested, { shouldValidate: false, shouldDirty: false });
  }, [watchedName, dirtyFields.slug, mode, setValue]);

  const onSubmit: SubmitHandler<PolicyFormInput> = (values) => {
    setServerState({ status: 'idle' });
    startTransition(async () => {
      const state = await savePolicyAction(values);
      setServerState(state);
      if (state.status === 'success') {
        setOpen(false);
      }
    });
  };

  const submitting = isPending;
  const trigger =
    triggerLabel ??
    (mode === 'edit' ? 'Editar política' : 'Nova política');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={mode === 'edit' ? 'outline' : 'default'}
          size={mode === 'edit' ? 'sm' : 'default'}
        >
          {mode === 'edit' ? (
            <Pencil aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {trigger}
        </Button>
      </DialogTrigger>

      <DialogContent
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle id={titleId}>
            {mode === 'edit' ? 'Editar política' : 'Nova política'}
          </DialogTitle>
          <DialogDescription id={descId}>
            Defina a regra de elegibilidade etária. Campos marcados com *
            são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
        >
          <input type="hidden" {...register('id')} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Nome *"
              error={errors.name?.message}
              htmlFor="policy-name"
            >
              <Input
                id="policy-name"
                autoComplete="off"
                aria-invalid={Boolean(errors.name)}
                {...register('name')}
              />
            </Field>

            <Field
              label="Slug *"
              error={errors.slug?.message}
              htmlFor="policy-slug"
              hint="Identificador estável, kebab-case."
            >
              <Input
                id="policy-slug"
                autoComplete="off"
                aria-invalid={Boolean(errors.slug)}
                {...register('slug')}
              />
            </Field>
          </div>

          <Field
            label="Descrição"
            error={errors.description?.message}
            htmlFor="policy-description"
          >
            <Textarea
              id="policy-description"
              rows={3}
              aria-invalid={Boolean(errors.description)}
              {...register('description')}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field
              label="Idade mínima *"
              error={errors.age_threshold?.message}
              htmlFor="policy-age"
            >
              <Input
                id="policy-age"
                type="number"
                min={1}
                max={120}
                inputMode="numeric"
                aria-invalid={Boolean(errors.age_threshold)}
                {...register('age_threshold')}
              />
            </Field>

            <Field
              label="Jurisdição"
              error={errors.jurisdiction_code?.message}
              htmlFor="policy-jurisdiction"
            >
              <Select
                id="policy-jurisdiction"
                aria-invalid={Boolean(errors.jurisdiction_code)}
                {...register('jurisdiction_code')}
              >
                <option value="">— Sem jurisdição —</option>
                {JURISDICTION_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code === 'BR' ? 'Brasil (BR)' : 'União Europeia (EU)'}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Nível de assurance *"
              error={errors.required_assurance_level?.message}
              htmlFor="policy-assurance"
            >
              <Select
                id="policy-assurance"
                aria-invalid={Boolean(errors.required_assurance_level)}
                {...register('required_assurance_level')}
              >
                {ASSURANCE_LEVELS.map((lv) => (
                  <option key={lv} value={lv}>
                    {ASSURANCE_LABELS[lv]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Controller
            control={control}
            name="method_priority_json"
            render={({ field, fieldState }) => (
              <Field
                label="Prioridade de métodos *"
                error={fieldState.error?.message}
                htmlFor="policy-methods"
                hint="A ordem define a tentativa: arraste com as setas para reordenar."
              >
                <MethodPriorityEditor
                  value={field.value}
                  onChange={field.onChange}
                  ariaInvalid={Boolean(fieldState.error)}
                />
              </Field>
            )}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="TTL do token (segundos) *"
              error={errors.token_ttl_seconds?.message}
              htmlFor="policy-ttl"
              hint={`= ${formatHours(Number(watchedTtl) || 0)}`}
            >
              <Input
                id="policy-ttl"
                type="number"
                min={60}
                inputMode="numeric"
                aria-invalid={Boolean(errors.token_ttl_seconds)}
                {...register('token_ttl_seconds')}
              />
            </Field>

            <Field
              label="Clonar de template"
              error={errors.cloned_from_id?.message}
              htmlFor="policy-clone"
              hint="Opcional. Selecione um template global como base."
            >
              <Select
                id="policy-clone"
                disabled={mode === 'edit'}
                aria-invalid={Boolean(errors.cloned_from_id)}
                {...register('cloned_from_id')}
              >
                <option value="">— Nenhum —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

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
              <Button type="button" variant="ghost" disabled={submitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Salvando…
                </>
              ) : mode === 'edit' ? (
                'Salvar alterações'
              ) : (
                'Criar política'
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
        <p
          id={errorId}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function MethodPriorityEditor({
  value,
  onChange,
  ariaInvalid,
}: {
  value: PolicyMethod[];
  onChange: (next: PolicyMethod[]) => void;
  ariaInvalid: boolean;
}) {
  const ordered = useMemo<PolicyMethod[]>(() => {
    const seen = new Set<PolicyMethod>();
    const result: PolicyMethod[] = [];
    for (const m of value) {
      if (POLICY_METHODS.includes(m) && !seen.has(m)) {
        seen.add(m);
        result.push(m);
      }
    }
    return result;
  }, [value]);

  const inactive = POLICY_METHODS.filter((m) => !ordered.includes(m));

  function toggle(method: PolicyMethod, checked: boolean) {
    if (checked) {
      onChange([...ordered, method]);
    } else {
      onChange(ordered.filter((m) => m !== method));
    }
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...ordered];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div
      role="group"
      aria-invalid={ariaInvalid}
      className={cn(
        'space-y-2 rounded-md border border-input bg-background/40 p-3',
      )}
    >
      <ol className="space-y-1.5">
        {ordered.map((method, index) => (
          <li
            key={method}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
          >
            <span className="font-mono text-xs text-muted-foreground w-5">
              {index + 1}.
            </span>
            <span className="flex-1 text-sm">{METHOD_LABELS[method]}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Mover ${METHOD_LABELS[method]} para cima`}
              onClick={() => move(index, -1)}
              disabled={index === 0}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Mover ${METHOD_LABELS[method]} para baixo`}
              onClick={() => move(index, 1)}
              disabled={index === ordered.length - 1}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggle(method, false)}
            >
              Remover
            </Button>
          </li>
        ))}
      </ol>

      {inactive.length > 0 ? (
        <div className="flex flex-wrap gap-3 border-t border-border pt-2">
          {inactive.map((method) => {
            const id = `add-method-${method}`;
            return (
              <label
                key={method}
                htmlFor={id}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Checkbox
                  id={id}
                  checked={false}
                  onChange={(e) => toggle(method, e.target.checked)}
                />
                {METHOD_LABELS[method]}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
