import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { formatDateTime, shortId } from '@/lib/utils';

export const metadata: Metadata = { title: 'Safety · Alerta' };

interface AlertRow {
  id: string;
  status: string;
  severity: string;
  rule_code: string;
  risk_category: string;
  reason_codes: string[];
  actions_taken: string[];
  actor_subject_id: string;
  counterparty_subject_id: string | null;
  step_up_session_id: string | null;
  parental_consent_request_id: string | null;
  triggering_event_ids: string[];
  created_at: string;
  resolved_at: string | null;
  resolved_note: string | null;
  legal_hold: boolean;
}

interface SubjectRow {
  id: string;
  subject_ref_hmac: string;
  age_state: string;
}

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTenantContext();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('safety_alerts' as never)
    .select(
      'id, status, severity, rule_code, risk_category, reason_codes, actions_taken, actor_subject_id, counterparty_subject_id, step_up_session_id, parental_consent_request_id, triggering_event_ids, created_at, resolved_at, resolved_note, legal_hold',
    )
    .eq('id', id)
    .maybeSingle();
  const alert = data as unknown as AlertRow | null;
  if (!alert) notFound();

  const subjectIds = [alert.actor_subject_id];
  if (alert.counterparty_subject_id) subjectIds.push(alert.counterparty_subject_id);
  const { data: subjData } = await supabase
    .from('safety_subjects' as never)
    .select('id, subject_ref_hmac, age_state')
    .in('id', subjectIds);
  const subjects = (subjData as unknown as SubjectRow[] | null) ?? [];
  const actor = subjects.find((s) => s.id === alert.actor_subject_id);
  const counterparty = alert.counterparty_subject_id
    ? subjects.find((s) => s.id === alert.counterparty_subject_id)
    : null;

  return (
    <div className="space-y-6">
      <Link href="/safety/alerts" className="text-sm text-primary hover:underline">
        ← Voltar
      </Link>
      <h2 className="text-xl font-medium">Alerta {shortId(alert.id)}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Resumo">
          <Field label="Regra"><code>{alert.rule_code}</code></Field>
          <Field label="Status"><code>{alert.status}</code></Field>
          <Field label="Severidade">{alert.severity}</Field>
          <Field label="Risk category">{alert.risk_category}</Field>
          <Field label="Reason codes" mono>{alert.reason_codes.join(', ')}</Field>
          <Field label="Actions taken" mono>{alert.actions_taken.join(', ')}</Field>
          <Field label="Legal hold">{alert.legal_hold ? '🔒 sim' : 'não'}</Field>
          <Field label="Criado em">{formatDateTime(alert.created_at)}</Field>
          <Field label="Resolvido em">
            {alert.resolved_at ? formatDateTime(alert.resolved_at) : '—'}
          </Field>
        </Card>
        <Card title="Sujeitos">
          {actor && (
            <Field label="Ator (HMAC)" mono>
              {shortId(actor.subject_ref_hmac)} · estado: <code>{actor.age_state}</code>
            </Field>
          )}
          {counterparty && (
            <Field label="Contraparte (HMAC)" mono>
              {shortId(counterparty.subject_ref_hmac)} · estado:{' '}
              <code>{counterparty.age_state}</code>
            </Field>
          )}
          {alert.step_up_session_id && (
            <Field label="Step-up session" mono>{alert.step_up_session_id}</Field>
          )}
          {alert.parental_consent_request_id && (
            <Field label="Parental consent request" mono>
              {alert.parental_consent_request_id}
            </Field>
          )}
        </Card>
        <Card title="Eventos disparadores">
          {alert.triggering_event_ids.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {alert.triggering_event_ids.map((eid) => (
                <li key={eid} className="font-mono text-xs">{shortId(eid)}</li>
              ))}
            </ul>
          )}
        </Card>
        {alert.resolved_note && (
          <Card title="Nota da resolução">
            <p className="text-sm">{alert.resolved_note}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
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
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-xs break-all' : 'text-sm'}>{children}</dd>
    </div>
  );
}
