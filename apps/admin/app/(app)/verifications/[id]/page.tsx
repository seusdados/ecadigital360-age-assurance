import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  agekey,
  AgeKeyApiError,
  type VerificationSessionDetail,
} from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { cn, formatDateTime, shortId } from '@/lib/utils';
import { RevokeTokenDialog } from './revoke-token-dialog';

export const metadata: Metadata = {
  title: 'Detalhe da verificação',
};

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_REVOKE_ROLES = new Set(['owner', 'admin', 'operator']);

export default async function VerificationDetailPage({
  params,
}: DetailPageProps) {
  const ctx = await requireTenantContext();
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  let session: VerificationSessionDetail | null = null;
  let loadError: string | null = null;
  let notFoundFlag = false;

  try {
    session = await agekey.verifications.get(id);
  } catch (err) {
    if (err instanceof AgeKeyApiError) {
      if (err.status === 404) {
        notFoundFlag = true;
      } else {
        loadError = `Falha ao carregar verificação (${err.reasonCode}).`;
      }
    } else {
      loadError = 'Falha ao carregar verificação.';
    }
  }

  if (notFoundFlag || (!session && !loadError)) {
    notFound();
  }

  const canRevoke =
    session?.decision === 'approved' &&
    !!session?.jti &&
    !session.token_revoked &&
    ALLOWED_REVOKE_ROLES.has(ctx.role);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/verifications"
          className={cn(
            'inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground',
            'rounded underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Verificações
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-md font-thin">Detalhe da verificação</h1>
          {session ? (
            <p
              className="font-mono text-xs text-muted-foreground"
              title={session.session_id}
            >
              session_id: {shortId(session.session_id, 8, 6)}
            </p>
          ) : null}
        </div>
        {session && canRevoke && session.jti ? (
          <RevokeTokenDialog jti={session.jti} sessionId={session.session_id} />
        ) : null}
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </p>
      ) : session ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Status">
            <Field label="Status">
              <StatusBadge status={session.status} />
            </Field>
            <Field label="Método">
              <code className="font-mono text-xs uppercase tracking-wide">
                {session.method ?? '—'}
              </code>
            </Field>
            <Field label="Decisão">
              <DecisionBadge decision={session.decision} />
            </Field>
            <Field label="Reason code">
              <code className="font-mono text-xs">
                {session.reason_code ?? '—'}
              </code>
            </Field>
            <Field label="Nível de garantia">
              <AssuranceBadge level={session.assurance_level} />
            </Field>
          </Section>

          <Section title="Token">
            <Field label="JTI">
              <code className="font-mono text-xs" title={session.jti ?? undefined}>
                {session.jti ? shortId(session.jti, 8, 6) : '—'}
              </code>
            </Field>
            <Field label="Status do token">
              {session.jti ? (
                session.token_revoked ? (
                  <span className="rounded bg-destructive/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-destructive">
                    Revogado
                  </span>
                ) : (
                  <span className="rounded bg-success/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-success">
                    Ativo
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Expira em">
              <span className="text-sm">
                {formatDateTime(session.token_expires_at)}
              </span>
            </Field>
          </Section>

          <Section title="Política">
            <Field label="Slug">
              <code className="font-mono text-xs">{session.policy.slug}</code>
            </Field>
            <Field label="Nome">
              <span className="text-sm">{session.policy.name}</span>
            </Field>
            <Field label="Idade mínima">
              <span className="text-sm">{session.policy.age_threshold}+</span>
            </Field>
            <Field label="Versão">
              <code className="font-mono text-xs">
                v{session.policy.version}
              </code>
            </Field>
            <Field label="Jurisdição">
              <span className="text-sm text-muted-foreground">
                {session.policy.jurisdiction_code ?? '—'}
              </span>
            </Field>
          </Section>

          <Section title="Aplicação">
            <Field label="Slug">
              <code className="font-mono text-xs">
                {session.application.slug}
              </code>
            </Field>
            <Field label="Nome">
              <span className="text-sm">{session.application.name}</span>
            </Field>
          </Section>

          <Section title="Linha do tempo" className="lg:col-span-2">
            <Field label="Criada em">
              <span className="text-sm">
                {formatDateTime(session.created_at)}
              </span>
            </Field>
            <Field label="Concluída em">
              <span className="text-sm">
                {formatDateTime(session.completed_at)}
              </span>
            </Field>
          </Section>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('rounded-lg border border-border bg-card p-5', className)}
      aria-labelledby={`section-${title}`}
    >
      <h2
        id={`section-${title}`}
        className="mb-3 text-xs uppercase tracking-widest text-muted-foreground"
      >
        {title}
      </h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5">
        {children}
      </dl>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground/90">{children}</dd>
    </>
  );
}

function StatusBadge({
  status,
}: {
  status: VerificationSessionDetail['status'];
}) {
  const tone =
    status === 'completed'
      ? 'bg-success/15 text-success'
      : status === 'in_progress' || status === 'pending'
        ? 'bg-primary/15 text-primary'
        : 'bg-destructive/15 text-destructive';
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-[11px] uppercase tracking-wide',
        tone,
      )}
    >
      {status}
    </span>
  );
}

function DecisionBadge({
  decision,
}: {
  decision: VerificationSessionDetail['decision'];
}) {
  if (!decision) return <span className="text-muted-foreground">—</span>;
  const tone =
    decision === 'approved'
      ? 'bg-success/15 text-success'
      : decision === 'denied'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-warning/15 text-warning';
  const label =
    decision === 'approved'
      ? 'Aprovado'
      : decision === 'denied'
        ? 'Negado'
        : 'Revisão';
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

function AssuranceBadge({
  level,
}: {
  level: VerificationSessionDetail['assurance_level'];
}) {
  if (!level) return <span className="text-muted-foreground">—</span>;
  const tone =
    level === 'high'
      ? 'bg-success/15 text-success'
      : level === 'substantial'
        ? 'bg-primary/15 text-primary'
        : 'bg-muted text-muted-foreground';
  const label =
    level === 'high' ? 'Alto' : level === 'substantial' ? 'Substantial' : 'Baixo';
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
