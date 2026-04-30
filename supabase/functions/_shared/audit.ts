// Manual audit event helper. Most audit_events are written by DB triggers
// (009_triggers.sql); this is for explicit application-level events
// (e.g. token revoked, key rotated) that the trigger layer can't see.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export interface AuditEventInput {
  tenantId: string;
  actorType: 'user' | 'api_key' | 'system' | 'cron';
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  diff?: Record<string, unknown>;
  clientIp?: string | null;
  userAgent?: string | null;
}

export async function writeAuditEvent(
  client: SupabaseClient,
  e: AuditEventInput,
): Promise<void> {
  const { error } = await client.from('audit_events').insert({
    tenant_id: e.tenantId,
    actor_type: e.actorType,
    actor_id: e.actorId ?? null,
    action: e.action,
    resource_type: e.resourceType,
    resource_id: e.resourceId ?? null,
    diff_json: e.diff ?? {},
    client_ip: e.clientIp ?? null,
    user_agent: e.userAgent ?? null,
  });
  if (error) throw error;
}
