// Resolve a policy by tenant + slug and load its current snapshot version.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { NotFoundError } from './errors.ts';
import type { PolicySnapshot, VerificationMethod } from '../../../packages/shared/src/types.ts';
import { ASSURANCE_RANK } from '../../../packages/shared/src/types.ts';
import type { AssuranceLevel } from '../../../packages/shared/src/types.ts';

export interface ResolvedPolicy {
  snapshot: PolicySnapshot;
  policy_version_id: string;
}

export async function resolvePolicy(
  client: SupabaseClient,
  tenantId: string,
  policySlug: string,
): Promise<ResolvedPolicy> {
  const { data: policy, error: policyErr } = await client
    .from('policies')
    .select(
      'id, tenant_id, name, slug, age_threshold, age_band_min, age_band_max, jurisdiction_code, method_priority_json, required_assurance_level, token_ttl_seconds, current_version',
    )
    .eq('tenant_id', tenantId)
    .eq('slug', policySlug)
    .is('deleted_at', null)
    .eq('status', 'active')
    .maybeSingle();

  if (policyErr) throw policyErr;
  if (!policy) {
    throw new NotFoundError(`Policy "${policySlug}" not found`);
  }

  const { data: version, error: versionErr } = await client
    .from('policy_versions')
    .select('id, version')
    .eq('policy_id', policy.id)
    .eq('version', policy.current_version)
    .maybeSingle();

  if (versionErr) throw versionErr;
  if (!version) {
    throw new NotFoundError('Policy version snapshot not found');
  }

  const methodPriority = Array.isArray(policy.method_priority_json)
    ? (policy.method_priority_json as VerificationMethod[])
    : (['zkp', 'vc', 'gateway', 'fallback'] as VerificationMethod[]);

  return {
    snapshot: {
      id: policy.id,
      tenant_id: policy.tenant_id,
      name: policy.name,
      slug: policy.slug,
      age_threshold: policy.age_threshold,
      age_band_min: policy.age_band_min,
      age_band_max: policy.age_band_max,
      jurisdiction_code: policy.jurisdiction_code,
      method_priority: methodPriority,
      required_assurance_level: policy.required_assurance_level,
      token_ttl_seconds: policy.token_ttl_seconds,
      current_version: policy.current_version,
    },
    policy_version_id: version.id,
  };
}

// Decide which methods are actually offerable given client capabilities.
// We never strip the fallback — it must always be available as last resort.
export function selectAvailableMethods(
  policy: PolicySnapshot,
  capabilities: {
    digital_credentials_api?: boolean;
    wallet_present?: boolean;
    platform?: 'web' | 'ios' | 'android';
  },
): VerificationMethod[] {
  const out: VerificationMethod[] = [];
  for (const m of policy.method_priority) {
    if (m === 'zkp' && !capabilities.digital_credentials_api) continue;
    if (m === 'vc' && !capabilities.wallet_present && !capabilities.digital_credentials_api)
      continue;
    out.push(m);
  }
  if (!out.includes('fallback')) out.push('fallback');
  return out;
}

export function meetsAssurance(
  delivered: AssuranceLevel,
  required: AssuranceLevel,
): boolean {
  return ASSURANCE_RANK[delivered] >= ASSURANCE_RANK[required];
}
