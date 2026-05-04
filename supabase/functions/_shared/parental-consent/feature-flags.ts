// Feature flag readout for AgeKey Consent on the Edge runtime.
//
// Edge Functions importam este módulo em vez de tocarem `Deno.env`
// diretamente — facilita teste e mantém defaults canônicos.

import { readFeatureFlags } from '../../../../packages/shared/src/feature-flags/index.ts';

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
