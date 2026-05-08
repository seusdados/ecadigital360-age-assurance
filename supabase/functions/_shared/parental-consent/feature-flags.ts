// Feature flag readout for AgeKey Consent on the Edge runtime.
//
// Edge Functions importam este módulo em vez de tocarem `Deno.env`
// diretamente — facilita teste e mantém defaults canônicos.

import { readFeatureFlags } from '../../../../packages/shared/src/feature-flags/index.ts';
import { CANONICAL_REASON_CODES } from '../../../../packages/shared/src/taxonomy/reason-codes.ts';
import { corsHeaders } from '../cors.ts';

export interface ParentalConsentRuntimeFlags {
  enabled: boolean;
  devReturnOtp: boolean;
  deliveryProvider: string;
  panelBaseUrl: string;
  guardianPanelTtlSeconds: number;
  consentTokenTtlSeconds: number;
  consentDefaultExpiryDays: number;
}

export function readParentalConsentFlags(): ParentalConsentRuntimeFlags {
  const flags = readFeatureFlags((name) => Deno.env.get(name));
  const provider = Deno.env.get('AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER') ?? 'noop';
  const devReturnOtp =
    (Deno.env.get('AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP') ?? '').toLowerCase() ===
      'true' || Deno.env.get('AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP') === '1';
  const panelBaseUrl =
    Deno.env.get('AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL') ??
    'https://panel.agekey.com.br/parental-consent';
  const panelTtl = Number(
    Deno.env.get('AGEKEY_PARENTAL_CONSENT_PANEL_TTL_SECONDS') ?? '86400',
  );
  const tokenTtl = Number(
    Deno.env.get('AGEKEY_PARENTAL_CONSENT_TOKEN_TTL_SECONDS') ?? '3600',
  );
  const expiryDays = Number(
    Deno.env.get('AGEKEY_PARENTAL_CONSENT_DEFAULT_EXPIRY_DAYS') ?? '365',
  );
  return {
    enabled: flags.AGEKEY_PARENTAL_CONSENT_ENABLED,
    devReturnOtp,
    deliveryProvider: provider,
    panelBaseUrl,
    guardianPanelTtlSeconds:
      Number.isFinite(panelTtl) && panelTtl > 0 ? panelTtl : 86_400,
    consentTokenTtlSeconds:
      Number.isFinite(tokenTtl) && tokenTtl > 0 ? tokenTtl : 3_600,
    consentDefaultExpiryDays:
      Number.isFinite(expiryDays) && expiryDays > 0 ? expiryDays : 365,
  };
}

/**
 * Resposta canônica 503 quando a feature flag global do módulo Consent
 * está OFF. NÃO acessa o banco e NÃO emite nenhuma side-effect além do
 * próprio Response. Use no início de cada handler antes de qualquer
 * leitura/escrita.
 *
 * Status 503 (Service Unavailable) é o correto semântico: o módulo
 * existe mas está desligado por configuração — o caller pode tentar
 * de novo após a operação habilitar a flag. NÃO é 403 (forbidden) porque
 * o caller não fez nada errado.
 */
export function featureDisabledResponse(origin: string | null): Response {
  const body = {
    error: 'ServiceUnavailableError',
    reason_code: CANONICAL_REASON_CODES.SYSTEM_INVALID_REQUEST,
    message:
      'AgeKey Consent module is disabled (AGEKEY_PARENTAL_CONSENT_ENABLED=false).',
  };
  return new Response(JSON.stringify(body), {
    status: 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': '60',
      ...corsHeaders(origin),
    },
  });
}
