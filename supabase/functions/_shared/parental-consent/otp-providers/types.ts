// Contrato de provider de delivery de OTP para o módulo Consent.
//
// Cada provider concreto implementa `OtpProvider` e é selecionado em
// runtime via `selectProvider(name)`. Esta camada permite trocar
// noop ↔ supabase_email ↔ Twilio ↔ SES sem tocar a Edge Function de
// negócio.

export type OtpChannel = 'email' | 'phone';

export interface OtpProviderSendInput {
  channel: OtpChannel;
  /** Contato cleartext — necessário só para o envio. NUNCA logar. */
  contact: string;
  /** OTP cleartext — necessário só para o envio. NUNCA logar. */
  otp: string;
  /** Locale do template (pt-BR / en-US). */
  locale: string;
  /** TTL em minutos a exibir no corpo da mensagem. Default 10. */
  expiresInMinutes?: number;
}

export interface OtpProviderSendResult {
  /** True se o provider confirmou aceite do envio (sem garantia de entrega). */
  delivered: boolean;
  /** Identificador estável do provider (ex.: 'noop', 'supabase_email'). */
  providerId: string;
  /** Identificador opcional retornado pelo provider, útil para debug/audit. */
  providerMessageId?: string;
  /**
   * Razão do erro quando `delivered === false`. Curta, sem PII,
   * sem stacktrace. Exemplo: "smtp_unavailable", "config_missing".
   */
  errorReason?: string;
}

export interface OtpProvider {
  /** Identificador estável do provider — usado em logs e audit. */
  readonly id: string;
  send(input: OtpProviderSendInput): Promise<OtpProviderSendResult>;
}
