// Painel parental público — acesso por token curto e escopado.
//
// Fluxo:
//   1. Página carrega session-get com `?token=<panel_token>`.
//   2. Mostra texto de consentimento (versionado).
//   3. Formulário pede contato do responsável (e-mail/telefone).
//   4. Server action POST /guardian/start → OTP enviado.
//   5. Formulário pede OTP + decisão (Aprovar/Negar).
//   6. Server action POST /confirm → exibe recibo (aprovação/negação).
//
// Este caminho NÃO está dentro do route group (app) — não exige login
// no admin. Tem layout próprio e é público.

import type { Metadata } from 'next';
import { agekeyEnv } from '@/lib/agekey/env';
import { ParentalPanelForm } from './form';

export const metadata: Metadata = {
  title: 'Consentimento parental · AgeKey',
  robots: { index: false, follow: false },
};

interface PanelPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

interface SessionData {
  consent_request_id: string;
  status: string;
  resource: string;
  purpose_codes: string[];
  data_categories: string[];
  policy: { id: string; slug: string; version: number; age_threshold: number };
  consent_text: { id: string; locale: string; text_hash: string };
  expires_at: string;
  decided_at: string | null;
  reason_code: string | null;
}

interface ConsentTextRow {
  id: string;
  locale: string;
  text_body: string;
}

async function fetchSession(
  id: string,
  token: string,
): Promise<{ session: SessionData | null; error: string | null }> {
  const base = agekeyEnv.apiBase();
  const url = `${base}/parental-consent-session-get/${encodeURIComponent(
    id,
  )}?token=${encodeURIComponent(token)}`;
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      return { session: null, error: `Erro ${resp.status}: ${await resp.text()}` };
    }
    return { session: (await resp.json()) as SessionData, error: null };
  } catch (e) {
    return {
      session: null,
      error: e instanceof Error ? e.message : 'unknown_error',
    };
  }
}

async function fetchConsentText(
  consentTextVersionId: string,
): Promise<ConsentTextRow | null> {
  // Server action via Supabase server client — RLS permite tenant only,
  // mas service_role bypassa. Aqui usamos a anon key + token na URL,
  // então recorremos a um endpoint adicional. Para o MVP, o painel
  // exibe apenas o `text_hash` e um placeholder genérico — o texto
  // completo é entregue ao integrador via API. Em produção, criar
  // endpoint público `/parental-consent-text/:id?token=<panel_token>`.
  return null;
}

export default async function ParentalConsentPanel({
  params,
  searchParams,
}: PanelPageProps) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <Shell>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-sm">
          Link inválido — token de painel ausente. Solicite um novo link ao
          serviço que pediu o consentimento.
        </div>
      </Shell>
    );
  }

  const { session, error } = await fetchSession(id, token);
  if (!session) {
    return (
      <Shell>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-sm">
          Não foi possível carregar a solicitação. Verifique o link recebido.
          {error ? <pre className="mt-2 text-xs">{error}</pre> : null}
        </div>
      </Shell>
    );
  }

  const consentText = await fetchConsentText(session.consent_text.id);

  if (
    session.status === 'approved' ||
    session.status === 'denied' ||
    session.status === 'revoked' ||
    session.status === 'expired'
  ) {
    return (
      <Shell>
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-medium">Solicitação encerrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Status atual: <strong>{session.status}</strong>.
            {session.reason_code ? (
              <>
                {' '}
                Motivo: <code>{session.reason_code}</code>.
              </>
            ) : null}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Você pode fechar esta página.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-medium">Consentimento parental</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você é responsável legal pela criança/adolescente que está pedindo
            acesso ao recurso{' '}
            <code className="rounded bg-muted px-1">{session.resource}</code>{' '}
            sob a política <strong>{session.policy.slug}</strong> (limiar{' '}
            {session.policy.age_threshold}+). Sua decisão é registrada de forma
            auditável e revogável.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Texto do consentimento (versão {session.consent_text.id})
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed">
            {consentText ? (
              <pre className="whitespace-pre-wrap font-sans">
                {consentText.text_body}
              </pre>
            ) : (
              <>
                <p>
                  O serviço solicitante deseja registrar o consentimento para as
                  seguintes finalidades:
                </p>
                <ul className="list-disc pl-5">
                  {session.purpose_codes.map((p) => (
                    <li key={p}>
                      <code className="rounded bg-muted px-1">{p}</code>
                    </li>
                  ))}
                </ul>
                <p>Categorias de dado tratadas:</p>
                <ul className="list-disc pl-5">
                  {session.data_categories.map((d) => (
                    <li key={d}>
                      <code className="rounded bg-muted px-1">{d}</code>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Hash do texto: <code>{session.consent_text.text_hash}</code>
                </p>
              </>
            )}
          </div>
        </section>

        <ParentalPanelForm
          consentRequestId={session.consent_request_id}
          panelToken={token}
          consentTextVersionId={session.consent_text.id}
          status={session.status}
          apiBase={agekeyEnv.apiBase()}
        />

        <p className="text-xs text-muted-foreground">
          AgeKey · este painel não solicita documento, idade exata, data de
          nascimento, CPF ou nome civil. O consentimento aceito é registrado por
          referência opaca e pode ser revogado a qualquer momento.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          AgeKey · Consentimento Parental
        </p>
      </div>
      {children}
    </main>
  );
}
