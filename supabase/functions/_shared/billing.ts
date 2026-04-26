// Billing event recording. One row per processed verification.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type {
  VerificationDecision,
  VerificationMethod,
} from '../../../packages/shared/src/types.ts';

export interface BillingEventInput {
  tenantId: string;
  applicationId: string;
  sessionId: string;
  method: VerificationMethod;
  decision: VerificationDecision;
  billableUnits?: number;
}

export async function recordBillingEvent(
  client: SupabaseClient,
  e: BillingEventInput,
): Promise<void> {
  const { error } = await client.from('billing_events').insert({
    tenant_id: e.tenantId,
    application_id: e.applicationId,
    session_id: e.sessionId,
    event_type: 'verification.completed',
    method: e.method,
    decision: e.decision,
    billable_units: e.billableUnits ?? 1,
  });
  if (error) throw error;
}
