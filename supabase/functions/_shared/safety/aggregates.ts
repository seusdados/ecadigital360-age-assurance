// Aggregates helper — incrementa contadores por sujeito.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface IncrementArgs {
  tenantId: string;
  applicationId: string;
  subjectId: string;
  aggregateKey: string;
  window: '24h' | '7d' | '30d' | '12m';
  delta?: number;
}

/**
 * Incrementa contador. Faz upsert via SQL UPSERT (ON CONFLICT).
 */
export async function incrementAggregate(
  client: SupabaseClient,
  args: IncrementArgs,
): Promise<void> {
  const delta = args.delta ?? 1;
  // Tentativa via RPC ou UPSERT manual.
  const { error: insErr } = await client.from('safety_aggregates').upsert(
    {
      tenant_id: args.tenantId,
      application_id: args.applicationId,
      subject_id: args.subjectId,
      aggregate_key: args.aggregateKey,
      window: args.window,
      value: delta,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,application_id,subject_id,aggregate_key,window' },
  );
  if (insErr) {
    // Fallback: incremento manual via SELECT FOR UPDATE seria ideal,
    // mas com upsert de cima sem retornar conflito agora fazemos UPDATE
    // condicional para incrementar.
    await client.rpc('safety_increment_aggregate' as never, {
      p_tenant_id: args.tenantId,
      p_application_id: args.applicationId,
      p_subject_id: args.subjectId,
      p_aggregate_key: args.aggregateKey,
      p_window: args.window,
      p_delta: delta,
    });
  }
}

/**
 * Lê valor agregado atual.
 */
export async function readAggregate(
  client: SupabaseClient,
  args: Omit<IncrementArgs, 'delta'>,
): Promise<number> {
  const { data } = await client
    .from('safety_aggregates')
    .select('value')
    .eq('tenant_id', args.tenantId)
    .eq('application_id', args.applicationId)
    .eq('subject_id', args.subjectId)
    .eq('aggregate_key', args.aggregateKey)
    .eq('window', args.window)
    .maybeSingle();
  if (!data) return 0;
  const value = (data as { value: number }).value;
  return typeof value === 'number' ? value : 0;
}
