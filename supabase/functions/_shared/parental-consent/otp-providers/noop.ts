// Provider noop — desenvolvimento/local apenas.
//
// NÃO envia nada. Usado quando `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER=noop`
// e `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true`. O OTP cleartext é
// devolvido pela Edge Function de `/guardian/start` para que o
// desenvolvedor possa colar no painel de testes.
//
// Quando o flag `devReturnOtp` está OFF, a camada chamadora deve
// recusar este provider — comportamento é controlado em `otp.ts`.

import type {
  OtpProvider,
  OtpProviderSendInput,
  OtpProviderSendResult,
} from './types.ts';

export const NOOP_PROVIDER_ID = 'noop';

export function createNoopProvider(): OtpProvider {
  return {
    id: NOOP_PROVIDER_ID,
    async send(_input: OtpProviderSendInput): Promise<OtpProviderSendResult> {
      // Não realiza I/O. Retorna delivered=true para sinalizar que o
      // pipeline aceitou o envio (em dev o fluxo continua via dev_otp).
      return {
        delivered: true,
        providerId: NOOP_PROVIDER_ID,
      };
    },
  };
}
