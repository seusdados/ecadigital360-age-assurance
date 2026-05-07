'use client';

// Client Component justification: collects a JWT from a textarea, calls a
// Server Action, and renders the parsed response. No browser-side calls
// to AgeKey APIs — the admin API key never leaves the server.

import { useState, useTransition, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { redactTokenForDisplay } from '@agekey/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  verifyTokenAction,
  type VerifyTokenActionResult,
} from './verify-token-action';

const TOP_LEVEL_CLAIM_KEYS = [
  'iss',
  'aud',
  'sub',
  'jti',
  'iat',
  'nbf',
  'exp',
] as const;

const AGEKEY_CLAIM_KEYS = [
  'decision',
  'threshold_satisfied',
  'age_threshold',
  'method',
  'assurance_level',
  'reason_code',
  'tenant_id',
  'application_id',
] as const;

export function TokenVerifyForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<VerifyTokenActionResult | null>(null);
  const [submittedTokenPreview, setSubmittedTokenPreview] = useState<
    string | null
  >(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const token = String(formData.get('token') ?? '').trim();
    const expectedAudience = String(
      formData.get('expected_audience') ?? '',
    ).trim();

    if (token.length === 0) {
      setResult({
        ok: false,
        response: null,
        error: 'Informe um JWT para verificar.',
      });
      setSubmittedTokenPreview(null);
      return;
    }

    // We deliberately store ONLY the redacted preview in client state;
    // the full token stays in the form input until the user clears it.
    const preview = redactTokenForDisplay(token);

    startTransition(async () => {
      const res = await verifyTokenAction({
        token,
        ...(expectedAudience.length > 0
          ? { expected_audience: expectedAudience }
          : {}),
      });
      setResult(res);
      setSubmittedTokenPreview(preview);
    });
  }

  function handleClear() {
    setResult(null);
    setSubmittedTokenPreview(null);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-border bg-card p-4"
        aria-label="Verificador de token JWT"
      >
        <div className="space-y-1">
          <Label htmlFor="verify-token">JWT</Label>
          <Textarea
            id="verify-token"
            name="token"
            required
            spellCheck={false}
            autoComplete="off"
            rows={5}
            placeholder="eyJhbGciOiJFUzI1NiIsImtpZCI6Ii4uLiJ9..."
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Cole um token de resultado emitido pelo AgeKey. O JWT é enviado
            apenas para a Edge Function via Server Action — nunca é gravado
            em logs do painel.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="verify-expected-audience">
            Audience esperado <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="verify-expected-audience"
            name="expected_audience"
            placeholder="ex.: app-slug ou seu-site.exemplo.com"
            autoComplete="off"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={pending}
          >
            Limpar resultado
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Verificando…
              </>
            ) : (
              'Verify'
            )}
          </Button>
        </div>
      </form>

      {result ? (
        <ResultPanel result={result} tokenPreview={submittedTokenPreview} />
      ) : null}
    </div>
  );
}

function ResultPanel({
  result,
  tokenPreview,
}: {
  result: VerifyTokenActionResult;
  tokenPreview: string | null;
}) {
  if (!result.ok || !result.response) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {result.error ?? 'Falha desconhecida.'}
      </div>
    );
  }

  const { valid, reason_code, revoked, claims } = result.response;

  return (
    <section
      aria-label="Resultado da verificação"
      className="space-y-4 rounded-lg border border-border bg-card p-4"
    >
      {tokenPreview ? (
        <p className="text-xs text-muted-foreground">
          Token testado:{' '}
          <code className="font-mono text-foreground">{tokenPreview}</code>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge valid={valid} />
        {reason_code ? (
          <span className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs">
            {reason_code}
          </span>
        ) : null}
        {revoked ? <RevokedBadge /> : null}
      </div>

      {claims ? <ClaimsView claims={claims} /> : null}
    </section>
  );
}

function StatusBadge({ valid }: { valid: boolean }) {
  if (valid) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/30 dark:text-emerald-300 dark:ring-emerald-400/30">
        valid: true
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-destructive/30">
      valid: false
    </span>
  );
}

function RevokedBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/30 dark:text-amber-300 dark:ring-amber-400/30">
      revoked: true
    </span>
  );
}

function ClaimsView({ claims }: { claims: Record<string, unknown> }) {
  const agekey =
    typeof claims.agekey === 'object' && claims.agekey !== null
      ? (claims.agekey as Record<string, unknown>)
      : null;
  const policy =
    agekey && typeof agekey.policy === 'object' && agekey.policy !== null
      ? (agekey.policy as Record<string, unknown>)
      : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
          Claims principais
        </h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {TOP_LEVEL_CLAIM_KEYS.map((key) => (
            <ClaimRow key={key} label={key} value={claims[key]} />
          ))}
        </dl>
      </div>

      {agekey ? (
        <div>
          <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Claims AgeKey
          </h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {AGEKEY_CLAIM_KEYS.map((key) => (
              <ClaimRow
                key={key}
                label={`agekey.${key}`}
                value={agekey[key]}
              />
            ))}
            {policy ? (
              <>
                <ClaimRow
                  label="agekey.policy.slug"
                  value={policy.slug}
                />
                <ClaimRow
                  label="agekey.policy.version"
                  value={policy.version}
                />
              </>
            ) : null}
          </dl>
        </div>
      ) : null}

      <details className="rounded-md border border-border bg-background">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground">
          Claims (JSON)
        </summary>
        <pre className="overflow-x-auto px-3 pb-3 pt-1 font-mono text-xs">
          {JSON.stringify(claims, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function ClaimRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-all font-mono text-xs">{formatValue(value)}</dd>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '—';
  }
}
