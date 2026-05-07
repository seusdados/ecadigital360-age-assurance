// Templates puros do OTP de consentimento parental.
//
// Geram apenas (subject, text) — SEM nome, e-mail, telefone, CPF ou
// qualquer outro identificador civil do responsável ou do menor. O
// painel parental, autenticado e auditado, é o único lugar onde
// purpose_codes / data_categories aparecem para o responsável; o
// e-mail é minimalista de propósito.
//
// O OTP cleartext aparece NESTE template porque o template é o único
// caminho legítimo para entregar o código ao responsável. O template
// nunca é persistido — é gerado em runtime e descartado após o envio.
// Quem chama o template não deve logar o resultado.

export type OtpTemplateLocale = 'pt-BR' | 'en-US';

export interface OtpTemplateInput {
  /** OTP cleartext de 6 dígitos — passado para o corpo do e-mail. */
  otp: string;
  /** Locale aceito pelo MVP. Fallback para pt-BR se desconhecido. */
  locale?: string;
  /** TTL do OTP em minutos, exibido no corpo. Default 10. */
  expiresInMinutes?: number;
}

export interface OtpTemplateOutput {
  subject: string;
  text: string;
}

const DEFAULT_TTL_MIN = 10;

/**
 * Resolve o locale para um dos suportados pelo MVP.
 */
export function resolveOtpTemplateLocale(
  locale: string | undefined,
): OtpTemplateLocale {
  if (!locale) return 'pt-BR';
  const lower = locale.toLowerCase();
  if (lower.startsWith('en')) return 'en-US';
  return 'pt-BR';
}

/**
 * Gera o template (subject + text) para envio do OTP ao responsável.
 *
 * NÃO inclui PII. NÃO inclui nome, e-mail, telefone, ou qualquer dado
 * do menor ou do responsável. Apenas mensagem genérica + OTP + TTL.
 */
export function renderOtpEmailTemplate(
  input: OtpTemplateInput,
): OtpTemplateOutput {
  const locale = resolveOtpTemplateLocale(input.locale);
  const ttl =
    typeof input.expiresInMinutes === 'number' && input.expiresInMinutes > 0
      ? Math.floor(input.expiresInMinutes)
      : DEFAULT_TTL_MIN;

  if (locale === 'en-US') {
    return {
      subject: 'Your AgeKey parental verification code',
      text: [
        'You requested to review a parental consent decision through AgeKey.',
        '',
        `Your verification code is: ${input.otp}`,
        '',
        `This code expires in ${ttl} minutes. If you did not request this code, you can safely ignore this email — no action will be taken.`,
        '',
        'For your security, never share this code with anyone.',
        '',
        '— AgeKey',
      ].join('\n'),
    };
  }

  return {
    subject: 'Seu código AgeKey de verificação parental',
    text: [
      'Você solicitou avaliar um pedido de consentimento parental pelo AgeKey.',
      '',
      `Seu código de verificação é: ${input.otp}`,
      '',
      `Este código expira em ${ttl} minutos. Se você não solicitou este código, ignore este e-mail — nenhuma ação será tomada.`,
      '',
      'Por segurança, nunca compartilhe este código com ninguém.',
      '',
      '— AgeKey',
    ].join('\n'),
  };
}
