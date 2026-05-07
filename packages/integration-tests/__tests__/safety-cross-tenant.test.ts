import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/setup/env.ts';
import { tenantClient, tryCallSetTenant } from '../src/setup/supabase-client.ts';

const env = loadEnv();

describe.skipIf(!env.enabled)('Safety cross-tenant isolation (RLS)', () => {
  it('safety_events cross-tenant negado', async () => {
    const c = tenantClient(env);
    const okA = await tryCallSetTenant(c, env.tenantA);
    if (!okA) return;
    const { data: evA } = await c.from('safety_events').select('id').limit(5);
    await tryCallSetTenant(c, env.tenantB);
    const { data: evBSeesA } = await c
      .from('safety_events')
      .select('id')
      .in(
        'id',
        ((evA as Array<{ id: string }> | null) ?? []).map((e) => e.id),
      );
    expect(evBSeesA?.length ?? 0).toBe(0);
  });

  it('safety_alerts cross-tenant negado', async () => {
    const c = tenantClient(env);
    const okA = await tryCallSetTenant(c, env.tenantA);
    if (!okA) return;
    const { data: alA } = await c.from('safety_alerts').select('id').limit(5);
    await tryCallSetTenant(c, env.tenantB);
    const { data: alBSeesA } = await c
      .from('safety_alerts')
      .select('id')
      .in(
        'id',
        ((alA as Array<{ id: string }> | null) ?? []).map((a) => a.id),
      );
    expect(alBSeesA?.length ?? 0).toBe(0);
  });

  it('safety_subjects cross-tenant negado', async () => {
    const c = tenantClient(env);
    const okA = await tryCallSetTenant(c, env.tenantA);
    if (!okA) return;
    const { data: sA } = await c.from('safety_subjects').select('id').limit(5);
    await tryCallSetTenant(c, env.tenantB);
    const { data: sBSeesA } = await c
      .from('safety_subjects')
      .select('id')
      .in(
        'id',
        ((sA as Array<{ id: string }> | null) ?? []).map((s) => s.id),
      );
    expect(sBSeesA?.length ?? 0).toBe(0);
  });

  it('safety_aggregates cross-tenant negado (sem score universal)', async () => {
    const c = tenantClient(env);
    const okA = await tryCallSetTenant(c, env.tenantA);
    if (!okA) return;
    const { data: aggA } = await c
      .from('safety_aggregates')
      .select('id')
      .limit(5);
    await tryCallSetTenant(c, env.tenantB);
    const { data: aggBSeesA } = await c
      .from('safety_aggregates')
      .select('id')
      .in(
        'id',
        ((aggA as Array<{ id: string }> | null) ?? []).map((a) => a.id),
      );
    expect(aggBSeesA?.length ?? 0).toBe(0);
  });
});
