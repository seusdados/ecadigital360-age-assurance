// API key authentication. Resolves api_key → application + tenant.
// Edge Functions accept `X-AgeKey-API-Key` header. The raw key is hashed
// (SHA-256) and matched against `applications.api_key_hash`.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  ForbiddenError,
  UnauthorizedError,
} from './errors.ts';
import { sha256Hex } from './db.ts';

export interface ApiKeyPrincipal {
  apiKeyHash: string;
  applicationId: string;
  applicationSlug: string;
  tenantId: string;
}

export async function authenticateApiKey(
  client: SupabaseClient,
  req: Request,
): Promise<ApiKeyPrincipal> {
  const raw = req.headers.get('x-agekey-api-key');
  if (!raw) {
    throw new UnauthorizedError('Missing X-AgeKey-API-Key header');
  }
  if (raw.length < 16 || raw.length > 256) {
    throw new UnauthorizedError('Invalid api_key format');
  }
  const apiKeyHash = await sha256Hex(raw);

  const { data, error } = await client
    .from('applications')
    .select('id, slug, tenant_id, status, deleted_at')
    .eq('api_key_hash', apiKeyHash)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new UnauthorizedError('Auth lookup failed');
  }
  if (!data) {
    throw new UnauthorizedError('Invalid api_key');
  }
  if (data.status !== 'active') {
    throw new ForbiddenError(`Application is ${data.status}`);
  }

  return {
    apiKeyHash,
    applicationId: data.id,
    applicationSlug: data.slug,
    tenantId: data.tenant_id,
  };
}
