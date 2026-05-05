// Consent check: dispara verificação de parental_consent quando regra exige.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export interface ConsentCheckRequest {
  tenantId: string;
  applicationId: string;
  policyId: string;
  policyVersionId: string;
  consentTextVersionId: string;
  resource: string;
  childRefHmac: string;
  purposeCodes: string[];
  dataCategories: string[];
  locale: string;
}

export interface ConsentCheckResult {
  consent_request_id: string;
  expires_at: string;
}

/**
 * Cria parental_consent_request via Edge Function existente.
 *
 * Optamos por chamar diretamente a tabela com service_role em vez de
 * fazer HTTP→Edge Function pra evitar latência. O guardian_panel_token
 * raw é gerado aqui e descartado após o INSERT — caso o tenant precise
 * disponibilizar painel, deve obter via Edge Function própria.
 */
export async function requestParentalConsentCheck(
  client: SupabaseClient,
  req: ConsentCheckRequest,
): Promise<ConsentCheckResult> {
  const ENCODER = new TextEncoder();
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  let bin = '';
  for (const b of tokenBytes) bin += String.fromCharCode(b);
  const tokenRaw =
    'pcpt_' +
    btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const hashBuf = await crypto.subtle.digest(
    'SHA-256',
    ENCODER.encode(tokenRaw),
  );
  let hashHex = '';
  for (const b of new Uint8Array(hashBuf))
    hashHex += b.toString(16).padStart(2, '0');

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from('parental_consent_requests')
    .insert({
      tenant_id: req.tenantId,
      application_id: req.applicationId,
      policy_id: req.policyId,
      policy_version_id: req.policyVersionId,
      consent_text_version_id: req.consentTextVersionId,
      resource: req.resource,
      purpose_codes: req.purposeCodes,
      data_categories: req.dataCategories,
      locale: req.locale,
      child_ref_hmac: req.childRefHmac,
      status: 'awaiting_guardian',
      guardian_panel_token_hash: hashHex,
      guardian_panel_token_expires_at: expiresAt,
      expires_at: expiresAt,
    })
    .select('id, expires_at')
    .single();
  if (error || !data) {
    throw error ?? new Error('Failed to create parental_consent_request from Safety');
  }
  return {
    consent_request_id: (data as { id: string }).id,
    expires_at: (data as { expires_at: string }).expires_at,
  };
}
