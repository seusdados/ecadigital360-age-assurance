// Subject resolver: garante que existe `safety_subjects` para o
// `subject_ref_hmac` enviado pelo cliente. Atualiza age_state se o
// caller passou a informação (vinda do Core ou do app cliente).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { SafetySubjectAgeState } from '../../../../packages/shared/src/schemas/safety.ts';

export interface SafetySubjectResolved {
  id: string;
  age_state: SafetySubjectAgeState;
  reports_count: number;
  alerts_count: number;
}

export async function upsertSafetySubject(
  client: SupabaseClient,
  args: {
    tenantId: string;
    applicationId: string;
    subjectRefHmac: string;
    ageState?: SafetySubjectAgeState | undefined;
    assuranceLevel?: string | null | undefined;
  },
): Promise<SafetySubjectResolved> {
  // Tenta SELECT primeiro (idempotente sem atualizar campos sensíveis).
  const { data: existing } = await client
    .from('safety_subjects')
    .select('id, age_state, reports_count, alerts_count')
    .eq('tenant_id', args.tenantId)
    .eq('application_id', args.applicationId)
    .eq('subject_ref_hmac', args.subjectRefHmac)
    .maybeSingle();

  if (existing) {
    // Atualiza age_state apenas se o caller forneceu valor diferente
    // (e o anterior era 'unknown') ou se a fonte é mais "alta".
    const current = (existing as { age_state: SafetySubjectAgeState }).age_state;
    if (args.ageState && current === 'unknown' && args.ageState !== 'unknown') {
      await client
        .from('safety_subjects')
        .update({
          age_state: args.ageState,
          assurance_level: args.assuranceLevel ?? null,
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', (existing as { id: string }).id);
      return {
        id: (existing as { id: string }).id,
        age_state: args.ageState,
        reports_count: (existing as { reports_count: number }).reports_count,
        alerts_count: (existing as { alerts_count: number }).alerts_count,
      };
    }
    // Apenas refresh last_seen.
    await client
      .from('safety_subjects')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id);
    return existing as unknown as SafetySubjectResolved;
  }

  const { data: created, error } = await client
    .from('safety_subjects')
    .insert({
      tenant_id: args.tenantId,
      application_id: args.applicationId,
      subject_ref_hmac: args.subjectRefHmac,
      age_state: args.ageState ?? 'unknown',
      assurance_level: args.assuranceLevel ?? null,
    })
    .select('id, age_state, reports_count, alerts_count')
    .single();
  if (error || !created) {
    throw error ?? new Error('Failed to upsert safety_subject');
  }
  return created as unknown as SafetySubjectResolved;
}
