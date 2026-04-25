// Deno tests — fallback adapter happy + denial paths.

import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { fallbackAdapter } from '../_shared/adapters/fallback.ts';
import type { SessionContext } from '../../../packages/adapter-contracts/src/index.ts';
import type { PolicySnapshot } from '../../../packages/shared/src/types.ts';

function makeCtx(overrides: Partial<SessionContext> = {}): SessionContext {
  const policy: PolicySnapshot = {
    id: 'p',
    tenant_id: 't',
    name: 'BR 18+',
    slug: 'br-18',
    age_threshold: 18,
    age_band_min: null,
    age_band_max: null,
    jurisdiction_code: 'BR',
    method_priority: ['fallback'],
    required_assurance_level: 'low',
    token_ttl_seconds: 86400,
    current_version: 1,
  };
  return {
    tenantId: 't',
    applicationId: 'a',
    sessionId: 's',
    policy,
    nonce: 'nonce-x',
    nonceExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    capabilities: {},
    clientIp: '203.0.113.1',
    userAgent: 'Mozilla/5.0 valid-ua',
    locale: 'pt-BR',
    ...overrides,
  };
}

Deno.test('fallback approves when declaration meets threshold and signals OK', async () => {
  const ctx = makeCtx();
  const result = await fallbackAdapter.completeSession(ctx, {
    method: 'fallback',
    declaration: { age_at_least: 21, consent: true },
    signals: { captcha_token: 'cap-ok', device_fingerprint: 'fp1' },
  });
  assertEquals(result.decision, 'approved');
  assertEquals(result.threshold_satisfied, true);
  assertEquals(result.method, 'fallback');
  assertEquals(result.assurance_level, 'low');
  assertEquals(result.reason_code, 'FALLBACK_DECLARATION_ACCEPTED');
  assert(result.artifact?.hash_hex.length === 64);
});

Deno.test('fallback denies when declaration < threshold', async () => {
  const ctx = makeCtx();
  const result = await fallbackAdapter.completeSession(ctx, {
    method: 'fallback',
    declaration: { age_at_least: 16, consent: true },
    signals: { captcha_token: 'cap-ok' },
  });
  assertEquals(result.decision, 'denied');
  assertEquals(result.reason_code, 'POLICY_ASSURANCE_UNMET');
  assertEquals(result.threshold_satisfied, false);
});

Deno.test('fallback escalates to needs_review when risk is high', async () => {
  // No captcha + missing UA + missing IP → score >= 0.7
  const ctx = makeCtx({ userAgent: '', clientIp: null });
  const result = await fallbackAdapter.completeSession(ctx, {
    method: 'fallback',
    declaration: { age_at_least: 18, consent: true },
    signals: {},
  });
  assertEquals(result.decision, 'needs_review');
  assertEquals(result.reason_code, 'FALLBACK_RISK_HIGH');
});

Deno.test('fallback prepareSession returns challenge nonce + ui hints', async () => {
  const ctx = makeCtx();
  const payload = await fallbackAdapter.prepareSession(ctx);
  assertEquals(payload.method, 'fallback');
  assertEquals((payload.client_payload as Record<string, unknown>).challenge_nonce, 'nonce-x');
  assertEquals(
    (payload.client_payload as { ui: { age_threshold: number } }).ui.age_threshold,
    18,
  );
});
