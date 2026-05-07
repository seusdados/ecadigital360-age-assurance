// Public route the guardian lands on after the relying party redirects them.
//
// MVP behaviour: render a placeholder page that confirms the flow exists,
// shows the consent_request_id and points to the API. Real OTP collection
// and acceptance UI ship in a follow-up round; the page is intentionally
// minimal so it cannot leak information about a non-existent request.
//
// Reference: docs/modules/parental-consent/ux-copy.md

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Consentimento parental — AgeKey',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GuardianLandingPage({ params }: PageProps) {
  const { id } = await params;
  // Defensive: id format is checked by the underlying edge functions; the
  // page never reveals existence — it shows the same shell whether the id
  // is real or not, and the guardian cannot infer a leak from the markup.
  const safeId = /^[0-9a-f-]{36}$/.test(id) ? id : 'invalid';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Pedido de consentimento parental
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Este link foi enviado para você porque uma plataforma pediu seu
        consentimento como responsável legal antes de liberar um recurso para
        a pessoa menor de idade que você representa. AgeKey nunca pede
        documento, foto, dados bancários ou informação de saúde.
      </p>

      <ol className="mt-6 list-inside list-decimal space-y-2 text-sm">
        <li>Confirme o canal por onde você recebeu este link.</li>
        <li>
          Leia atentamente a versão de texto de consentimento que será exibida
          e marque que você compreendeu o escopo, a finalidade e o seu direito
          de revogar a qualquer momento.
        </li>
        <li>
          Digite o código de verificação que você recebeu no canal escolhido.
        </li>
      </ol>

      <p className="mt-6 text-xs text-muted-foreground">
        Identificador desta solicitação:{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
          {safeId}
        </code>
      </p>

      <p className="mt-6 text-xs text-muted-foreground">
        Você pode revogar este consentimento a qualquer momento na plataforma
        que originou o pedido. Em caso de dúvida, entre em contato com a
        plataforma diretamente — o AgeKey não armazena seus dados de contato
        em texto legível.
      </p>

      <p className="mt-8 text-[11px] text-muted-foreground">
        Esta interface é a versão MVP. A coleta interativa de código e do
        aceite parental será habilitada quando o canal de envio do código
        estiver homologado.
      </p>
    </main>
  );
}
