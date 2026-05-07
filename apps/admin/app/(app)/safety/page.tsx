// Tenant-facing dashboard for AgeKey Safety Signals (Round 4 MVP).
//
// This page lists the most recent safety events and open alerts for the
// active tenant. It deliberately does NOT expose:
//   * raw text, image, video, audio (Safety v1 is metadata-only),
//   * IP addresses (only HMAC hashes are stored),
//   * actor / counterparty references (only HMAC hashes are stored),
//   * any PII.
//
// Reference: docs/modules/safety-signals/FRONTEND_SPEC.md

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';

export const metadata: Metadata = { title: 'Sinais de risco' };

interface SafetyEventRow {
  id: string;
  event_type: string;
  channel_type: string;
  relationship_type: string;
  actor_age_state: string;
  counterparty_age_state: string;
  occurred_at: string;
  received_at: string;
  reason_codes: string[];
}

interface SafetyAlertRow {
  id: string;
  status: string;
  severity: string;
  risk_category: string;
  reason_codes: string[];
  human_review_required: boolean;
  opened_at: string;
}

export default async function SafetySignalsPage() {
  const ctx = await requireTenantContext();
  const supabase = await createClient();

  const eventsP = supabase
    .from('safety_events')
    .select(
      'id, event_type, channel_type, relationship_type, actor_age_state, counterparty_age_state, occurred_at, received_at, reason_codes',
    )
    .eq('tenant_id', ctx.tenantId)
    .order('received_at', { ascending: false })
    .limit(25);
  const alertsP = supabase
    .from('safety_alerts')
    .select(
      'id, status, severity, risk_category, reason_codes, human_review_required, opened_at',
    )
    .eq('tenant_id', ctx.tenantId)
    .in('status', ['open', 'acknowledged'])
    .order('opened_at', { ascending: false })
    .limit(25);

  const [{ data: events, error: eErr }, { data: alerts, error: aErr }] =
    await Promise.all([eventsP, alertsP]);
  if (eErr) throw eErr;
  if (aErr) throw aErr;

  const eventRows = (events ?? []) as SafetyEventRow[];
  const alertRows = (alerts ?? []) as SafetyAlertRow[];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sinais de risco
        </h1>
        <p className="text-sm text-muted-foreground">
          Eventos mínimos enviados pela aplicação cliente com hash do
          identificador opaco. Sem mensagens, sem mídia, sem IP em texto, sem
          dados pessoais.
        </p>
      </header>

      <section aria-labelledby="alerts-heading" className="space-y-3">
        <h2
          id="alerts-heading"
          className="text-base font-medium tracking-tight"
        >
          Alertas abertos
        </h2>
        {alertRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum alerta aberto no momento.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Categoria</th>
                  <th className="px-4 py-2">Severidade</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Revisão humana</th>
                  <th className="px-4 py-2">Razões</th>
                  <th className="px-4 py-2">Aberto em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {alertRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-mono text-xs">
                      {row.risk_category}
                    </td>
                    <td className="px-4 py-2">{row.severity}</td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">
                      {row.human_review_required ? 'sim' : 'não'}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {row.reason_codes.join(', ')}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {new Date(row.opened_at).toISOString().slice(0, 19)}Z
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="events-heading" className="space-y-3">
        <h2
          id="events-heading"
          className="text-base font-medium tracking-tight"
        >
          Eventos recentes
        </h2>
        {eventRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há eventos. Eles aparecem aqui quando uma aplicação chama
            POST /v1/safety/event-ingest.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Evento</th>
                  <th className="px-4 py-2">Canal</th>
                  <th className="px-4 py-2">Relação</th>
                  <th className="px-4 py-2">Idades</th>
                  <th className="px-4 py-2">Razões</th>
                  <th className="px-4 py-2">Recebido em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eventRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-mono text-xs">
                      {row.event_type}
                    </td>
                    <td className="px-4 py-2">{row.channel_type}</td>
                    <td className="px-4 py-2">{row.relationship_type}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {row.actor_age_state} → {row.counterparty_age_state}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {row.reason_codes?.join(', ') ?? '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {new Date(row.received_at).toISOString().slice(0, 19)}Z
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        AgeKey Safety Signals é uma camada de sinais — não é detecção de
        crime, não é vigilância parental, não captura conteúdo. Detalhes em{' '}
        <Link href="/faq" className="underline">
          docs/modules/safety-signals
        </Link>
        .
      </p>
    </div>
  );
}
