// Step-up: cria verification_session no Core a partir de Safety.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export interface StepUpRequest {
  tenantId: string;
  applicationId: string;
  /** policy_id que o tenant configurou para step-up via Safety. */
  policyId: string;
  policyVersionId: string;
  /** referência opaca ao usuário a verificar (subject_ref_hmac). */
  externalUserRef: string;
  locale: string;
}

export interface StepUpResult {
  session_id: string;
  expires_at: string;
}

/**
 * Cria verification_session no Core. Reusa a tabela existente sem
 * desviar do contrato Core.
 */
export async function createStepUpSession(
  client: SupabaseClient,
  req: StepUpRequest,
): Promise<StepUpResult> {
  const { data, error } = await client
    .from('verification_sessions')
    .insert({
      tenant_id: req.tenantId,
      application_id: req.applicationId,
      policy_id: req.policyId,
      policy_version_id: req.policyVersionId,
      status: 'pending',
      external_user_ref: req.externalUserRef,
      locale: req.locale,
    })
    .select('id, expires_at')
    .single();
  if (error || !data) {
    throw error ?? new Error('Failed to create step-up verification_session');
  }
  return {
    session_id: (data as { id: string }).id,
    expires_at: (data as { expires_at: string }).expires_at,
  };
}
