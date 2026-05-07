// Tenant-facing dashboard for AgeKey Parental Consent (Round 3 MVP).
//
// This page lists the most recent consent requests for the active tenant
// and exposes the published consent text versions. It deliberately does NOT
// expose:
//   * guardian contact (email/phone) — never read on the panel,
//   * subject identifying refs — only HMAC hashes are stored and they are
//     not echoed here,
//   * civil identifiers, document numbers, full names, birthdates.
//
// Reference: docs/modules/parental-consent/architecture.md
//            docs/modules/parental-consent/ux-copy.md

import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';

export const metadata: Metadata = { title: 'Consentimento parental' };

interface ConsentRequestRow {
  id: string;
  application_id: string;
  resource: string;
  status: string;
  decision: string;
  reason_code: string;
  risk_tier: string;
  requested_at: string;
  expires_at: string;
}

interface ConsentTextRow {
  id: string;
  version: number;
  language: string;
  title: string;
  status: string;
  effective_from: string;
}

export default async function ParentalConsentPage() {
  const ctx = await requireTenantContext();
  const supabase = await createClient();

  const requestsPromise = supabase
    .from('parental_consent_requests')
    .select(
      'id, application_id, resource, status, decision, reason_code, risk_tier, requested_at, expires_at',
    )
    .eq('tenant_id', ctx.tenantId)
    .order('requested_at', { ascending: false })
    .limit(25);

  const textsPromise = supabase
    .from('consent_text_versions')
    .select('id, version, language, title, status, effective_from')
    .eq('tenant_id', ctx.tenantId)
    .order('effective_from', { ascending: false })
    .limit(25);

  const [{ data: requests, error: reqErr }, { data: texts, error: txtErr }] =
    await Promise.all([requestsPromise, textsPromise]);

  if (reqErr) throw reqErr;
  if (txtErr) throw txtErr;

  const requestRows = (requests ?? []) as ConsentRequestRow[];
  const textRows = (texts ?? []) as ConsentTextRow[];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Consentimento parental
        </h1>
        <p className="text-sm text-muted-foreground">
          Auditoria minimizada de pedidos de consentimento. Sem dados pessoais
          do responsável ou do menor — apenas referências opacas e hashes de
          texto e prova.
        </p>
      </header>

      <section aria-labelledby="texts-heading" className="space-y-3">
        <h2
          id="texts-heading"
          className="text-base font-medium tracking-tight"
        >
          Versões de texto publicadas
        </h2>
        {textRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma versão de texto cadastrada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {textRows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div className="space-y-1">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Versão {row.version} · {row.language} · status {row.status}
                  </p>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {new Date(row.effective_from).toISOString().slice(0, 19)}Z
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="requests-heading" className="space-y-3">
        <h2
          id="requests-heading"
          className="text-base font-medium tracking-tight"
        >
          Pedidos de consentimento recentes
        </h2>
        {requestRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há pedidos. Eles aparecem aqui quando uma aplicação chama
            POST /v1/parental-consent/session.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Recurso</th>
                  <th className="px-4 py-2">Decisão</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Risco</th>
                  <th className="px-4 py-2">Razão</th>
                  <th className="px-4 py-2">Solicitado</th>
                  <th className="px-4 py-2">Expira</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requestRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-mono text-xs">
                      {row.resource}
                    </td>
                    <td className="px-4 py-2">{row.decision}</td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">{row.risk_tier}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {row.reason_code}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {new Date(row.requested_at).toISOString().slice(0, 19)}Z
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {new Date(row.expires_at).toISOString().slice(0, 19)}Z
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Este painel é o ponto de entrada do módulo de consentimento parental.
        A revogação, edição de texto e o painel do responsável serão liberados
        em rodadas seguintes — todas as chamadas correspondentes já existem na
        API e estão documentadas em <code>docs/modules/parental-consent/</code>.
      </p>
    </div>
  );
}
