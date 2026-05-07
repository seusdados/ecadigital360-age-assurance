// Provider supabase_email — entrega de OTP por e-mail via relay HTTPS.
//
// Decisão de design (MVP, R5):
// ---------------------------------------------------------------
// O AgeKey NÃO usa o Supabase Auth para representar responsáveis
// (responsáveis nunca viram `auth.users` — o módulo Consent é
// custom). Logo, NÃO podemos usar `supabase.auth.admin.inviteUserByEmail`
// nem `generateLink`, porque ambos criam/recuperam usuários do
// GoTrue, o que é semanticamente errado e cria PII residual.
//
// O caminho mais limpo, sem dependências externas hardcoded, é
// delegar para um RELAY HTTPS de e-mail configurado pelo operador.
// Esse relay pode ser:
//   1. Um endpoint Supabase Edge Function próprio (ex.: outra função
//      do mesmo projeto que encapsula SMTP/GoTrue/SES);
//   2. Um serviço externo que aceite POST `{from,to,subject,text}`
//      (Resend, Postmark, SendGrid, Mailgun, SES SMTP gateway, etc.);
//   3. Em produção AgeKey, será um Edge Function dedicado que usa o
//      SMTP configurado no projeto Supabase do tenant.
//
// O contrato HTTPS é minimalista: POST JSON com `{from, to, subject,
// text}` e header `Authorization: Bearer <token>`. Nenhuma credencial
// SMTP cleartext circula por esta camada — só a URL do relay e um
// token opaco (ambos via env vars).
//
// PRIVACIDADE:
//   - O OTP cleartext é enviado APENAS no payload HTTPS para o relay.
//     NUNCA é logado.
//   - O e-mail cleartext do responsável é enviado APENAS no payload
//     HTTPS. NUNCA é logado por este provider.
//   - O retorno expõe apenas `providerId` e `providerMessageId`
//     (opaco, sem PII).
//
// Quando configuração ausente em runtime: o provider sobe erro
// explícito — ele NUNCA aprova um envio silenciosamente.

import type {
  OtpProvider,
  OtpProviderSendInput,
  OtpProviderSendResult,
} from './types.ts';
import { renderOtpEmailTemplate } from '../../../../../packages/shared/src/parental-consent/otp-templates.ts';

export const SUPABASE_EMAIL_PROVIDER_ID = 'supabase_email';

export interface SupabaseEmailProviderConfig {
  /** URL HTTPS do relay de e-mail. Ex.: outra Edge Function. Obrigatório. */
  relayUrl: string;
  /** Token opaco enviado no header Authorization. Obrigatório. */
  relayToken: string;
  /** E-mail "from" (envelope sender). Obrigatório. */
  fromEmail: string;
  /** Nome opcional do remetente (ex.: "AgeKey"). */
  fromName?: string;
  /** TTL em minutos exibido no template. Default 10. */
  expiresInMinutes?: number;
  /** Permite injetar um fetch alternativo (testes). */
  fetchImpl?: typeof fetch;
}

export class SupabaseEmailProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseEmailProviderConfigError';
  }
}

function assertConfig(cfg: SupabaseEmailProviderConfig): void {
  if (!cfg.relayUrl) {
    throw new SupabaseEmailProviderConfigError(
      'AGEKEY_PARENTAL_CONSENT_OTP_RELAY_URL is required when provider is "supabase_email".',
    );
  }
  if (!cfg.relayToken) {
    throw new SupabaseEmailProviderConfigError(
      'AGEKEY_PARENTAL_CONSENT_OTP_RELAY_TOKEN is required when provider is "supabase_email".',
    );
  }
  if (!cfg.fromEmail) {
    throw new SupabaseEmailProviderConfigError(
      'AGEKEY_PARENTAL_CONSENT_OTP_FROM_EMAIL is required when provider is "supabase_email".',
    );
  }
}

export function createSupabaseEmailProvider(
  cfg: SupabaseEmailProviderConfig,
): OtpProvider {
  // Falha eager: se algo crítico estiver ausente, falha já na criação,
  // não no primeiro envio. Garante que o boot da Edge Function
  // identifique configuração inválida antes do primeiro request.
  assertConfig(cfg);

  const fetchFn = cfg.fetchImpl ?? fetch;
  const ttl = cfg.expiresInMinutes ?? 10;

  return {
    id: SUPABASE_EMAIL_PROVIDER_ID,
    async send(input: OtpProviderSendInput): Promise<OtpProviderSendResult> {
      if (input.channel !== 'email') {
        return {
          delivered: false,
          providerId: SUPABASE_EMAIL_PROVIDER_ID,
          errorReason: 'channel_unsupported',
        };
      }

      const tpl = renderOtpEmailTemplate({
        otp: input.otp,
        locale: input.locale,
        expiresInMinutes: input.expiresInMinutes ?? ttl,
      });

      const fromHeader = cfg.fromName
        ? `${cfg.fromName} <${cfg.fromEmail}>`
        : cfg.fromEmail;

      let resp: Response;
      try {
        resp = await fetchFn(cfg.relayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.relayToken}`,
          },
          body: JSON.stringify({
            from: fromHeader,
            to: input.contact,
            subject: tpl.subject,
            text: tpl.text,
          }),
        });
      } catch (_err) {
        // NÃO logar mensagem de erro do fetch porque pode conter URL
        // sensível. Apenas marcar relay_unreachable.
        return {
          delivered: false,
          providerId: SUPABASE_EMAIL_PROVIDER_ID,
          errorReason: 'relay_unreachable',
        };
      }

      if (!resp.ok) {
        return {
          delivered: false,
          providerId: SUPABASE_EMAIL_PROVIDER_ID,
          errorReason: `relay_status_${resp.status}`,
        };
      }

      // Tenta extrair message_id do payload (opcional).
      let providerMessageId: string | undefined;
      try {
        const data = (await resp.json()) as
          | { id?: string; message_id?: string }
          | null;
        if (data && typeof data === 'object') {
          providerMessageId = data.id ?? data.message_id;
        }
      } catch {
        // Body não-JSON ou vazio: tudo bem, sem message_id.
      }

      return {
        delivered: true,
        providerId: SUPABASE_EMAIL_PROVIDER_ID,
        providerMessageId,
      };
    },
  };
}
