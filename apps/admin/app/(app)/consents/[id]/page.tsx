import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { formatDateTime, shortId } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Consentimento parental',
};

interface ConsentDetailPageProps {
  params: Promise<{ id: string }>;
}

interface RequestRow {
  id: string;
  status: string;
  resource: string;
  purpose_codes: string[];
  data_categories: string[];
  child_ref_hmac: string;
  locale: string;
  created_at: string;
  decided_at: string | null;
  reason_code: string | null;
  expires_at: string;
  policy_id: string;
  application_id: string;
  consent_text_version_id: string;
}

interface ConsentRow {
  id: string;
  decision: string;
  reason_code: string;
  granted_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  consent_assurance_level: string;
  created_at: string;
}

interface TokenRow {
  jti: string;
  kid: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

interface RevocationRow {
  id: string;
  source: string;
  reason: string;
  revoked_at: string;
}

export default async function ConsentDetailPage({
  params,
}: ConsentDetailPageProps) {
  await requireTenantContext();
  const { id } = await params;

  const supabase = await createClient();

  // Cast `as never` em .from(): tabelas Consent ainda não estão no
  // `Database` type gerado. Após primeira aplicação das migrations
  // 020-023, regenerar via `supabase gen types` e remover os casts.
  const { data: reqData } = await supabase
    .from('parental_consent_requests' as never)
    .select(
      'id, status, resource, purpose_codes, data_categories, child_ref_hmac, locale, created_at, decided_at, reason_code, expires_at, policy_id, application_id, consent_text_version_id',
    )
    .eq('id', id)
    .maybeSingle();

  const req = reqData as unknown as RequestRow | null;
  if (!req) notFound();

  const [
    { data: pcData },
    { data: tokensData },
    { data: revsData },
    { data: policyData },
    { data: appData },
  ] = await Promise.all([
    supabase
      .from('parental_consents' as never)
      .select(
        'id, decision, reason_code, granted_at, expires_at, revoked_at, consent_assurance_level, created_at',
      )
      .eq('consent_request_id', id)
      .maybeSingle(),
    supabase
      .from('parental_consent_tokens' as never)
      .select('jti, kid, issued_at, expires_at, revoked_at, revoked_reason'),
    supabase
      .from('parental_consent_revocations' as never)
      .select('id, source, reason, revoked_at')
      .order('revoked_at', { ascending: false }),
    supabase
      .from('policies' as never)
      .select('id, slug, name, age_threshold, current_version')
      .eq('id', req.policy_id)
      .maybeSingle(),
    supabase
      .from('applications' as never)
      .select('id, slug, name')
      .eq('id', req.application_id)
      .maybeSingle(),
  ]);

  const pc = pcData as unknown as ConsentRow | null;
  const tokens = (tokensData as unknown as TokenRow[] | null) ?? [];
  const revs = (revsData as unknown as RevocationRow[] | null) ?? [];
  const policy = policyData as unknown as
    | { id: string; slug: string; name: string; age_threshold: number; current_version: number }
    | null;
  const app = appData as unknown as
    | { id: string; slug: string; name: string }
    | null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/consents" className="text-sm text-primary hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-medium">
          Consentimento {shortId(req.id)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status atual: <span className="font-mono">{req.status}</span> · Recurso:{' '}
          <code className="rounded bg-muted px-1">{req.resource}</code>
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Solicitação">
          <Field label="Reference da criança (HMAC)" mono>
            {req.child_ref_hmac}
          </Field>
          <Field label="Locale">{req.locale}</Field>
          <Field label="Criada em">{formatDateTime(req.created_at)}</Field>
          <Field label="Expira em">{formatDateTime(req.expires_at)}</Field>
          <Field label="Decidida em">
            {req.decided_at ? formatDateTime(req.decided_at) : '—'}
          </Field>
          <Field label="Reason code">
            <code>{req.reason_code ?? '—'}</code>
          </Field>
          <Field label="Purpose codes" mono>
            {req.purpose_codes.join(', ')}
          </Field>
          <Field label="Data categories" mono>
            {req.data_categories.join(', ')}
          </Field>
        </Card>

        <Card title="Política e Application">
          {policy && (
            <>
              <Field label="Política">
                <Link href="/policies" className="text-primary hover:underline">
                  {policy.name}
                </Link>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {policy.slug} v{policy.current_version}
                </span>
              </Field>
              <Field label="Limiar etário">
                {String(policy.age_threshold)}+
              </Field>
            </>
          )}
          {app && (
            <Field label="Application">
              <Link href="/applications" className="text-primary hover:underline">
                {app.name}
              </Link>
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {app.slug}
              </span>
            </Field>
          )}
        </Card>

        <Card title="Consentimento (registro)">
          {pc ? (
            <>
              <Field label="Decisão">
                <code>{pc.decision}</code>
              </Field>
              <Field label="Assurance">{pc.consent_assurance_level}</Field>
              <Field label="Reason">
                <code>{pc.reason_code}</code>
              </Field>
              <Field label="Aceito em">
                {pc.granted_at ? formatDateTime(pc.granted_at) : '—'}
              </Field>
              <Field label="Expira em">
                {pc.expires_at ? formatDateTime(pc.expires_at) : '—'}
              </Field>
              <Field label="Revogado em">
                {pc.revoked_at ? formatDateTime(pc.revoked_at) : '—'}
              </Field>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ainda não há registro de consentimento — fluxo em andamento.
            </p>
          )}
        </Card>

        <Card title="Token (parental_consent_token)">
          {tokens.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {tokens.map((t) => (
                <li key={t.jti} className="rounded border border-border p-2">
                  <div className="font-mono text-xs">jti {shortId(t.jti)}</div>
                  <div className="text-xs text-muted-foreground">
                    kid {t.kid} · emitido {formatDateTime(t.issued_at)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    expira {formatDateTime(t.expires_at)}
                    {t.revoked_at
                      ? ` · revogado ${formatDateTime(t.revoked_at)}`
                      : ''}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum token emitido.</p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-medium">Trilha de revogações</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Append-only. Cada linha aqui também dispara webhook{' '}
          <code className="rounded bg-muted px-1">parental_consent.revoked</code>.
        </p>
        {revs.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Origem</th>
                <th className="px-3 py-2 font-medium">Motivo</th>
                <th className="px-3 py-2 font-medium">Quando</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {revs.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono text-xs">{r.source}</td>
                  <td className="px-3 py-2">{r.reason}</td>
                  <td className="px-3 py-2">{formatDateTime(r.revoked_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Sem revogações.</p>
        )}
      </section>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={mono ? 'font-mono text-xs break-all' : 'text-sm'}>
        {children}
      </dd>
    </div>
  );
}
