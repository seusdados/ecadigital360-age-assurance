'use client';

import { useState, useTransition } from 'react';

interface FormProps {
  consentRequestId: string;
  panelToken: string;
  consentTextVersionId: string;
  status: string;
  apiBase: string;
}

type Stage =
  | { kind: 'collect_contact' }
  | { kind: 'collect_otp'; contactMasked: string; devOtp: string | null }
  | { kind: 'done'; decision: 'approved' | 'denied'; reasonCode: string }
  | { kind: 'error'; message: string };

export function ParentalPanelForm(props: FormProps) {
  const initialStage: Stage =
    props.status === 'awaiting_verification'
      ? { kind: 'collect_otp', contactMasked: '***', devOtp: null }
      : { kind: 'collect_contact' };

  const [stage, setStage] = useState<Stage>(initialStage);
  const [pending, startTransition] = useTransition();
  const [contactChannel, setContactChannel] = useState<'email' | 'phone'>(
    'email',
  );
  const [contactValue, setContactValue] = useState('');
  const [otp, setOtp] = useState('');
  const [decision, setDecision] = useState<'approve' | 'deny'>('approve');

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const resp = await fetch(
          `${props.apiBase}/parental-consent-guardian-start/${props.consentRequestId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guardian_panel_token: props.panelToken,
              contact_channel: contactChannel,
              contact_value: contactValue,
            }),
          },
        );
        if (!resp.ok) {
          const body = await resp.json().catch(() => null);
          setStage({
            kind: 'error',
            message: `${resp.status} · ${body?.reason_code ?? body?.error ?? 'erro'}`,
          });
          return;
        }
        const data = (await resp.json()) as {
          contact_masked: string;
          dev_otp: string | null;
        };
        setStage({
          kind: 'collect_otp',
          contactMasked: data.contact_masked,
          devOtp: data.dev_otp,
        });
      } catch (err) {
        setStage({
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'erro de rede',
        });
      }
    });
  }

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const resp = await fetch(
          `${props.apiBase}/parental-consent-confirm/${props.consentRequestId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guardian_panel_token: props.panelToken,
              otp,
              decision,
              consent_text_version_id: props.consentTextVersionId,
            }),
          },
        );
        if (!resp.ok) {
          const body = await resp.json().catch(() => null);
          setStage({
            kind: 'error',
            message: `${resp.status} · ${body?.reason_code ?? body?.error ?? 'erro'}`,
          });
          return;
        }
        const data = (await resp.json()) as {
          decision: 'approved' | 'denied';
          reason_code: string;
        };
        setStage({
          kind: 'done',
          decision: data.decision,
          reasonCode: data.reason_code,
        });
      } catch (err) {
        setStage({
          kind: 'error',
          message: err instanceof Error ? err.message : 'erro de rede',
        });
      }
    });
  }

  if (stage.kind === 'done') {
    const ok = stage.decision === 'approved';
    return (
      <div
        className={`rounded-lg border p-5 ${
          ok
            ? 'border-emerald-500/50 bg-emerald-50/60'
            : 'border-rose-500/50 bg-rose-50/60'
        }`}
      >
        <h2 className="text-lg font-medium">
          {ok ? 'Consentimento aprovado' : 'Consentimento negado'}
        </h2>
        <p className="mt-2 text-sm">
          Reason code: <code>{stage.reasonCode}</code>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Você pode fechar esta página. Em caso de revogação futura, use o link
          original.
        </p>
      </div>
    );
  }

  if (stage.kind === 'error') {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-5">
        <h2 className="text-sm font-medium">Erro</h2>
        <p className="mt-1 text-sm">{stage.message}</p>
        <button
          type="button"
          className="mt-3 rounded-md border border-input bg-background px-4 py-2 text-sm"
          onClick={() => setStage({ kind: 'collect_contact' })}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (stage.kind === 'collect_contact') {
    return (
      <form
        onSubmit={handleStart}
        className="space-y-4 rounded-lg border border-border bg-card p-5"
      >
        <div>
          <label htmlFor="channel" className="text-sm font-medium">
            Canal do contato do responsável
          </label>
          <select
            id="channel"
            value={contactChannel}
            onChange={(e) =>
              setContactChannel(e.target.value as 'email' | 'phone')
            }
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="email">E-mail</option>
            <option value="phone">Telefone</option>
          </select>
        </div>
        <div>
          <label htmlFor="contact" className="text-sm font-medium">
            {contactChannel === 'email' ? 'E-mail' : 'Telefone (com DDD)'}
          </label>
          <input
            id="contact"
            type={contactChannel === 'email' ? 'email' : 'tel'}
            value={contactValue}
            onChange={(e) => setContactValue(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={
              contactChannel === 'email'
                ? 'responsavel@exemplo.com'
                : '+55 (11) 99999-1234'
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Seu contato é cifrado em repouso. Nunca aparece em token público,
            log ou painel admin do serviço solicitante.
          </p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Enviando código...' : 'Receber código de verificação'}
        </button>
      </form>
    );
  }

  // collect_otp
  return (
    <form
      onSubmit={handleConfirm}
      className="space-y-4 rounded-lg border border-border bg-card p-5"
    >
      <p className="text-sm">
        Enviamos um código de 6 dígitos para{' '}
        <strong>{stage.contactMasked}</strong>.
      </p>
      {stage.devOtp ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-50 p-2 text-xs">
          <strong>DEV ONLY:</strong> OTP retornado em ambiente de
          desenvolvimento — <code>{stage.devOtp}</code>
        </div>
      ) : null}
      <div>
        <label htmlFor="otp" className="text-sm font-medium">
          Código de verificação
        </label>
        <input
          id="otp"
          inputMode="numeric"
          pattern="[0-9]{6}"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
          maxLength={6}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-center font-mono text-lg tracking-widest"
          placeholder="000000"
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Sua decisão</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-md border border-input p-2 text-sm">
            <input
              type="radio"
              name="decision"
              value="approve"
              checked={decision === 'approve'}
              onChange={() => setDecision('approve')}
            />
            Aprovar
          </label>
          <label className="flex items-center gap-2 rounded-md border border-input p-2 text-sm">
            <input
              type="radio"
              name="decision"
              value="deny"
              checked={decision === 'deny'}
              onChange={() => setDecision('deny')}
            />
            Negar
          </label>
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Processando...' : 'Confirmar decisão'}
      </button>
    </form>
  );
}
