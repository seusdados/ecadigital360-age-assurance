import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/setup/env.ts';
import { tenantClient, tryCallSetTenant } from '../src/setup/supabase-client.ts';

const env = loadEnv();

describe.skipIf(!env.enabled)('Consent cross-tenant isolation (RLS)', () => {
  it('parental_consent_requests cross-tenant negado', async () => {
    const c = tenantClient(env);
    const okA = await tryCallSetTenant(c, env.tenantA);
    if (!okA) return;
    const { data: reqsA } = await c
      .from('parental_consent_requests')
      .select('id')
      .limit(5);
    await tryCallSetTenant(c, env.tenantB);
    const { data: reqsBSeesA } = await c
      .from('parental_consent_requests')
      .select('id')
      .in(
        'id',
        ((reqsA as Array<{ id: string }> | null) ?? []).map((r) => r.id),
      );
    expect(reqsBSeesA?.length ?? 0).toBe(0);
  });

  it('guardian_contacts cross-tenant negado (RLS estrita)', async () => {
    const c = tenantClient(env);
    const okA = await tryCallSetTenant(c, env.tenantA);
    if (!okA) return;
    const { data: gcA } = await c.from('guardian_contacts').select('id').limit(5);
    await tryCallSetTenant(c, env.tenantB);
    const { data: gcBSeesA } = await c
      .from('guardian_contacts')
      .select('id')
      .in(
        'id',
        ((gcA as Array<{ id: string }> | null) ?? []).map((g) => g.id),
      );
    expect(gcBSeesA?.length ?? 0).toBe(0);
  });

  it('parental_consents cross-tenant negado', async () => {
    const c = tenantClient(env);
    const okA = await tryCallSetTenant(c, env.tenantA);
    if (!okA) return;
    const { data: pcA } = await c.from('parental_consents').select('id').limit(5);
    await tryCallSetTenant(c, env.tenantB);
    const { data: pcBSeesA } = await c
      .from('parental_consents')
      .select('id')
      .in(
        'id',
        ((pcA as Array<{ id: string }> | null) ?? []).map((p) => p.id),
      );
    expect(pcBSeesA?.length ?? 0).toBe(0);
  });
});
