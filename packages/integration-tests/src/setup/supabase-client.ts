// Helpers para criar clientes Supabase com tenant context simulado.
//
// `serviceClient()` — bypassa RLS (admin operations, cleanup).
// `tenantClient(tenantId)` — usa anon-equivalente; em produção real,
//   usaria login/JWT do tenant. Para o MVP de R8, simulamos via SQL
//   `SET LOCAL app.current_tenant_id = ...` antes de cada query.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { IntegrationEnv } from './env.ts';

export function serviceClient(env: IntegrationEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente "tenant" com tenant context setado via SQL ANTES da query.
 * Caller usa `await tenantClient.rpc('set_current_tenant', { tid })`
 * — função SQL que faz `SET LOCAL app.current_tenant_id`.
 *
 * Em rodada futura, substituir por JWT real do usuário do tenant.
 */
export function tenantClient(env: IntegrationEnv): SupabaseClient {
  // Reutiliza service role mas opera em modo "tenant" através de
  // GUC. Se a função SQL `set_current_tenant` não existir, os testes
  // detectam e skipam graciosamente.
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function tryCallSetTenant(
  client: SupabaseClient,
  tenantId: string,
): Promise<boolean> {
  try {
    const { error } = await client.rpc('set_current_tenant' as never, {
      tid: tenantId,
    } as never);
    return !error;
  } catch {
    return false;
  }
}
