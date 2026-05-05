// Registry de providers OTP — seleção em runtime.
//
// Adicionar novo provider em rodada futura: criar arquivo em
// `./<provider>.ts` com `createXProvider`, registrar aqui.

import type { OtpProvider } from './types.ts';
import { NOOP_PROVIDER_ID, createNoopProvider } from './noop.ts';
import {
  SUPABASE_EMAIL_PROVIDER_ID,
  createSupabaseEmailProvider,
  SupabaseEmailProviderConfigError,
} from './supabase-email.ts';

export type {
  OtpChannel,
  OtpProvider,
  OtpProviderSendInput,
  OtpProviderSendResult,
} from './types.ts';
export { NOOP_PROVIDER_ID, createNoopProvider };
export {
  SUPABASE_EMAIL_PROVIDER_ID,
  createSupabaseEmailProvider,
  SupabaseEmailProviderConfigError,
};

export interface ProviderEnv {
  /** Lê env var por nome. Edge: `Deno.env.get`. Node: closure sobre process.env. */
  read(name: string): string | undefined;
}

export class UnknownOtpProviderError extends Error {
  constructor(name: string) {
    super(
      `Unknown OTP provider "${name}". Supported: noop, supabase_email.`,
    );
    this.name = 'UnknownOtpProviderError';
  }
}

/**
 * Seleciona e instancia o provider configurado em
 * `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` (default: noop).
 *
 * Falha eager: se o provider exigir configuração e ela estiver
 * ausente, lança erro na criação. NUNCA aprova fluxo silenciosamente.
 */
export function selectProvider(env: ProviderEnv): OtpProvider {
  const name =
    (env.read('AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER') ?? 'noop')
      .trim()
      .toLowerCase();

  if (name === NOOP_PROVIDER_ID) {
    return createNoopProvider();
  }

  if (name === SUPABASE_EMAIL_PROVIDER_ID) {
    return createSupabaseEmailProvider({
      relayUrl: env.read('AGEKEY_PARENTAL_CONSENT_OTP_RELAY_URL') ?? '',
      relayToken: env.read('AGEKEY_PARENTAL_CONSENT_OTP_RELAY_TOKEN') ?? '',
      fromEmail: env.read('AGEKEY_PARENTAL_CONSENT_OTP_FROM_EMAIL') ?? '',
      ...(env.read('AGEKEY_PARENTAL_CONSENT_OTP_FROM_NAME')
        ? { fromName: env.read('AGEKEY_PARENTAL_CONSENT_OTP_FROM_NAME')! }
        : {}),
    });
  }

  throw new UnknownOtpProviderError(name);
}
