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
// triggers can attribute writes correctly. This is fire-and-forget by
// nature of the supabase-js client (each query gets its own tx) — for
// strict isolation use rpc('set_tenant_ctx') wrapping the work.
export async function setTenantContext(
  client: SupabaseClient,
  tenantId: string,
): Promise<void> {
  // Use a lightweight RPC. The function must be created in a follow-up
  // migration — for now we tolerate failure (logged once at boot).
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
