import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { TenantRow } from '@/types/database';

export interface TenantContext {
  userId: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: 'owner' | 'admin' | 'operator' | 'auditor' | 'billing';
}

interface MembershipQueryRow {
  role: TenantContext['role'];
  tenant_id: string;
  tenants: TenantRow | null;
}

/**
 * Resolves the current authenticated user's primary tenant.
 *
 * In Fase 3 the panel only handles a single active tenant per user.
 * Multi-tenant switcher will land later — for now we pick the most
 * recently joined tenant (highest tenant_users.created_at).
 *
 * Redirects to /login if unauthenticated, /onboarding if user has
 * no tenant yet.
 */
export async function requireTenantContext(): Promise<TenantContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('tenant_users')
    .select(
      'role, tenant_id, tenants:tenant_id ( id, slug, name, status, deleted_at )',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const membership = data as MembershipQueryRow | null;
  const tenant = membership?.tenants ?? null;

  if (!membership || !tenant || tenant.deleted_at) {
    redirect('/onboarding');
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    role: membership.role,
  };
}
