'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  leadSchema,
  type LeadInput,
  POLICY_OPTIONS,
  CHANNEL_OPTIONS,
  SEGMENT_OPTIONS,
} from '@/lib/leadSchema';
import { Button } from '@/components/ui/Button';
import { siteCopy } from '@/content/site';
import { cn } from '@/lib/utils';

const inputCls =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function ContactForm({ source }: { source: 'contato' | 'demo' }) {
  const [submitState, setSubmitState] = useState<
    | { status: 'idle' }
    | { status: 'submitting' }
    | { status: 'success' }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      source,
      policies: [],
      channel: 'não sei ainda',
      segment: 'plataforma digital',
    },
  });

  async function onSubmit(values: LeadInput) {
    setSubmitState({ status: 'submitting' });
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setSubmitState({
          status: 'error',
          message: data.error ?? 'Não foi possível enviar agora. Tente novamente.',
        });
        return;
      }
      reset({
        source,
        policies: [],
        channel: 'não sei ainda',
        segment: 'plataforma digital',
      });
      setSubmitState({ status: 'success' });
    } catch {
      setSubmitState({
        status: 'error',
        message: 'Erro de rede. Tente novamente em instantes.',
      });
    }
  }

  if (submitState.status === 'success') {
    return (
      <div className="rounded-xl border border-success/40 bg-success/10 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success mt-0.5" aria-hidden />
          <div>
            <p className="font-medium text-foreground">Solicitação recebida.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {siteCopy.contact.success}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-xl border border-border bg-card p-6 md:p-8"
    >
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 mb-6 flex items-start gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-warning mt-0.5" aria-hidden />
        <p className="text-foreground">{siteCopy.contact.safety}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nome" error={errors.name?.message} htmlFor="name">
          <input id="name" autoComplete="name" className={inputCls} {...register('name')} />
        </Field>

        <Field label="Email corporativo" error={errors.email?.message} htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={inputCls}
            {...register('email')}
          />
        </Field>

        <Field label="Empresa" error={errors.company?.message} htmlFor="company">
          <input
            id="company"
            autoComplete="organization"
            className={inputCls}
            {...register('company')}
          />
        </Field>

        <Field label="Cargo" error={errors.role?.message} htmlFor="role">
          <input
            id="role"
            autoComplete="organization-title"
            className={inputCls}
            {...register('role')}
          />
        </Field>

        <Field
          label="Site da empresa"
          error={errors.website?.message}
          htmlFor="website"
          hint="Opcional. Use https://"
        >
          <input
            id="website"
            type="url"
            autoComplete="url"
            placeholder="https://"
            className={inputCls}
            {...register('website')}
          />
        </Field>

        <Field label="Segmento" error={errors.segment?.message} htmlFor="segment">
          <select id="segment" className={inputCls} {...register('segment')}>
            {SEGMENT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Volume estimado / mês"
          error={errors.monthlyVolume?.message}
          htmlFor="monthlyVolume"
          hint="Ex.: 5 mil, 50 mil, 1M+"
        >
          <input
            id="monthlyVolume"
            className={inputCls}
            placeholder="Verificações por mês"
            {...register('monthlyVolume')}
          />
        </Field>

        <Field label="Canal desejado" error={errors.channel?.message} htmlFor="channel">
          <select id="channel" className={inputCls} {...register('channel')}>
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-foreground">
          Políticas necessárias
        </legend>
        <p className="mt-1 text-xs text-muted-foreground">
          Selecione todas que se aplicam.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {POLICY_OPTIONS.map((p) => (
            <label
              key={p}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted"
            >
              <input
                type="checkbox"
                value={p}
                {...register('policies')}
                className="h-4 w-4 accent-[hsl(var(--accent))]"
              />
              <span>{p}</span>
            </label>
          ))}
        </div>
        {errors.policies ? (
          <p className="mt-2 text-sm text-destructive">{errors.policies.message}</p>
        ) : null}
      </fieldset>

      <Field
        label="Mensagem"
        htmlFor="message"
        error={errors.message?.message}
        className="mt-6"
        hint="Conte sobre seu produto, prazos e contexto. Não envie dados pessoais."
      >
        <textarea
          id="message"
          rows={5}
          className={cn(inputCls, 'resize-y')}
          {...register('message')}
        />
      </Field>

      <input type="hidden" {...register('source')} />

      {submitState.status === 'error' ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {submitState.message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Ao enviar, você concorda em ser contatado pelo time AgeKey sobre integração e proposta.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={submitState.status === 'submitting'}
        >
          {submitState.status === 'submitting' ? 'Enviando…' : 'Enviar solicitação'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
