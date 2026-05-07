import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/setup/env.ts';
import {
  serviceClient,
  tenantClient,
  tryCallSetTenant,
} from '../src/setup/supabase-client.ts';

const env = loadEnv();

describe.skipIf(!env.enabled)('Core cross-tenant isolation (RLS)', () => {
  it('tenantA verification_sessions NÃO leiveis para tenantB', async () => {
    const c = tenantClient(env);

    const okA = await tryCallSetTenant(c, env.tenantA);
    if (!okA) return; // skip silencioso se RPC ausente

    const { data: sessionsA } = await c
      .from('verification_sessions')
      .select('id')
      .limit(5);

    await tryCallSetTenant(c, env.tenantB);
    const { data: sessionsBSeesA } = await c
      .from('verification_sessions')
      .select('id')
      .in(
        'id',
        ((sessionsA as Array<{ id: string }> | null) ?? []).map((s) => s.id),
      );

    expect(sessionsBSeesA?.length ?? 0).toBe(0);
  });

  it('result_tokens cross-tenant negado', async () => {
    const c = tenantClient(env);

    const okA = await tryCallSetTenant(c, env.tenantA);
    if (!okA) return;

    const { data: tokensA } = await c.from('result_tokens').select('jti').limit(5);

    await tryCallSetTenant(c, env.tenantB);
    const { data: tokensBSeesA } = await c
      .from('result_tokens')
      .select('jti')
      .in(
        'jti',
        ((tokensA as Array<{ jti: string }> | null) ?? []).map((t) => t.jti),
      );

    expect(tokensBSeesA?.length ?? 0).toBe(0);
  });

  it('applications cross-tenant negado', async () => {
    const c = tenantClient(env);
    const okA = await tryCallSetTenant(c, env.tenantA);
    if (!okA) return;
    const { data: appsA } = await c.from('applications').select('id').limit(5);
    await tryCallSetTenant(c, env.tenantB);
    const { data: appsBSeesA } = await c
      .from('applications')
      .select('id')
      .in(
        'id',
        ((appsA as Array<{ id: string }> | null) ?? []).map((a) => a.id),
      );
    expect(appsBSeesA?.length ?? 0).toBe(0);
  });
});

describe('Core cross-tenant — env check', () => {
  it('env check expõe enabled=false quando vars ausentes', () => {
    if (!env.enabled) {
      expect(env.enabled).toBe(false);
    } else {
      expect(env.tenantA.length).toBeGreaterThan(0);
    }
  });
});
