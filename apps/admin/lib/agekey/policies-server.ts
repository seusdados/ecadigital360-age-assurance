import 'server-only';

import { agekey, type PolicyListItem } from './client';
import { createClient } from '@/lib/supabase/server';

export interface PolicyVersionRow {
  version: number;
  diff_json: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

/**
 * Fetch a single policy by id from /policies-list — the API doesn't yet
 * expose a single-item endpoint, so we filter the listing client-side.
 * Returns null when the id is unknown to the caller's tenant.
 */
export async function getPolicyById(
  id: string,
): Promise<PolicyListItem | null> {
  const result = await agekey.policies.list({ include_templates: true });
  return result.items.find((p) => p.id === id) ?? null;
}

/**
 * Read policy_versions directly via supabase-js. RLS allows tenant
 * members to read versions of policies they own; if the table or the
 * policy doesn't expose a row, we surface an empty array rather than
 * throw, so the detail page degrades gracefully.
 */
export async function getPolicyVersions(
  policyId: string,
): Promise<PolicyVersionRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('policy_versions')
      .select('version, diff_json, created_at, created_by')
      .eq('policy_id', policyId)
      .order('version', { ascending: false })
      .limit(50);
    if (error) return [];
    return (data ?? []) as PolicyVersionRow[];
  } catch {
    return [];
  }
}
