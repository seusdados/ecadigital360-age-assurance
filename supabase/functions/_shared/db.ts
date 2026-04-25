// Service-role Supabase client + tenant context helper.
// Edge Functions ALWAYS go through the service-role client because they
// run privileged logic that needs to bypass RLS — but we still set
// `app.current_tenant_id` so DB triggers (audit_log) attribute writes
// to the right tenant.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { config } from './env.ts';

let _admin: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(config.supabaseUrl(), config.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { 'X-Client-Info': 'agekey-edge-functions' },
    },
  });
  return _admin;
}

// Sets `app.current_tenant_id` on the current connection so downstream
// triggers (audit_log) can attribute writes correctly. supabase-js opens
// pooled connections per-call, so this RPC sets the GUC for the session
// behind the current statement; subsequent triggers in the same query
// chain inherit it.
//
// Defense in depth: audit_log() also COALESCEs to the row's tenant_id
// when the GUC is unset — but always calling this avoids relying on
// implicit fallbacks.
export async function setTenantContext(
  client: SupabaseClient,
  tenantId: string,
): Promise<void> {
  const { error } = await client.rpc('set_tenant_context', {
    tenant_id: tenantId,
  });
  if (error && !/function .* does not exist/i.test(error.message)) {
    throw error;
  }
}

export function sha256Hex(input: string): Promise<string> {
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(input))
    .then((buf) => {
      const bytes = new Uint8Array(buf);
      let hex = '';
      for (const b of bytes) hex += b.toString(16).padStart(2, '0');
      return hex;
    });
}
