// Deno tests — pure logic of the key-rotation cron (AK-P0-08).
//
// `key-rotation/index.ts` is split between IO (DB / Vault) and a pure
// decision layer in `_shared/key-rotation-logic.ts`. These tests pin the
// pure layer so we can prove rotation never:
//   - keeps two `active` keys simultaneously (CI guard against regression),
//   - prematurely retires the current signing key,
//   - skips a daily run silently.

import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import {
  ACTIVE_TO_RETIRED_MS,
  classifyTransitions,
  type CryptoKeyRow,
  hasMultipleFreshActives,
  ROTATING_TO_ACTIVE_MS,
  ROTATION_INTERVAL_MS,
  shouldRotate,
} from '../_shared/key-rotation-logic.ts';

const NOW = Date.parse('2026-04-30T03:00:00Z');

function row(o: Partial<CryptoKeyRow> & { kid: string; status: CryptoKeyRow['status'] }): CryptoKeyRow {
  return {
    id: o.id ?? `id-${o.kid}`,
    kid: o.kid,
    status: o.status,
    activated_at: o.activated_at ?? null,
    retired_at: o.retired_at ?? null,
    created_at: o.created_at ?? new Date(NOW).toISOString(),
  };
}

// =====================================================================
// shouldRotate
// =====================================================================
Deno.test('shouldRotate: empty key set → bootstrap → true', () => {
  assertEquals(shouldRotate(NOW, []), true);
});

Deno.test('shouldRotate: only retired keys (no active) → true', () => {
  const keys = [
    row({
      kid: 'ak_old',
      status: 'retired',
      activated_at: new Date(NOW - 5 * 86400_000).toISOString(),
      retired_at: new Date(NOW - 86400_000).toISOString(),
    }),
  ];
  assertEquals(shouldRotate(NOW, keys), true);
});

Deno.test('shouldRotate: fresh active < 24h → false', () => {
  const keys = [
    row({
      kid: 'ak_now',
      status: 'active',
      activated_at: new Date(NOW - 60_000).toISOString(), // 1 min ago
    }),
  ];
  assertEquals(shouldRotate(NOW, keys), false);
});

Deno.test('shouldRotate: active activated >= 24h ago → true', () => {
  const keys = [
    row({
      kid: 'ak_yesterday',
      status: 'active',
      activated_at: new Date(NOW - ROTATION_INTERVAL_MS).toISOString(),
    }),
  ];
  assertEquals(shouldRotate(NOW, keys), true);
});

Deno.test('shouldRotate: respects custom intervalMs', () => {
  const keys = [
    row({
      kid: 'ak_x',
      status: 'active',
      activated_at: new Date(NOW - 3 * 3600_000).toISOString(), // 3h
    }),
  ];
  assertEquals(shouldRotate(NOW, keys, { intervalMs: 2 * 3600_000 }), true);
  assertEquals(shouldRotate(NOW, keys, { intervalMs: 4 * 3600_000 }), false);
});

// =====================================================================
// classifyTransitions
// =====================================================================
Deno.test('classifyTransitions: bootstrap (no keys) → empty plan', () => {
  const plan = classifyTransitions(NOW, []);
  assertEquals(plan.promote, []);
  assertEquals(plan.retire, []);
  assertEquals(plan.purge, []);
  assertEquals(plan.keepActive, []);
});

Deno.test('classifyTransitions: rotating ≥ 24h old is promoted', () => {
  const keys = [
    row({
      kid: 'ak_rot',
      status: 'rotating',
      created_at: new Date(NOW - ROTATING_TO_ACTIVE_MS).toISOString(),
    }),
  ];
  const plan = classifyTransitions(NOW, keys);
  assertEquals(plan.promote, ['ak_rot']);
});

Deno.test('classifyTransitions: rotating < 24h old is NOT promoted', () => {
  const keys = [
    row({
      kid: 'ak_rot_young',
      status: 'rotating',
      created_at: new Date(NOW - 3600_000).toISOString(), // 1h
    }),
  ];
  const plan = classifyTransitions(NOW, keys);
  assertEquals(plan.promote, []);
});

Deno.test('classifyTransitions: most recent active is kept, old active is retired', () => {
  const keys = [
    row({
      kid: 'ak_current',
      status: 'active',
      activated_at: new Date(NOW - 3600_000).toISOString(), // 1h ago — fresh
    }),
    row({
      kid: 'ak_previous',
      status: 'active',
      activated_at: new Date(NOW - ACTIVE_TO_RETIRED_MS - 60_000).toISOString(),
    }),
  ];
  const plan = classifyTransitions(NOW, keys);
  assertEquals(plan.keepActive, ['ak_current']);
  assertEquals(plan.retire, ['ak_previous']);
});

Deno.test('classifyTransitions: never retires the only active key', () => {
  const keys = [
    row({
      kid: 'ak_only',
      status: 'active',
      activated_at: new Date(NOW - 10 * 86400_000).toISOString(), // 10 days
    }),
  ];
  const plan = classifyTransitions(NOW, keys);
  assertEquals(plan.retire, []);
  assertEquals(plan.keepActive, ['ak_only']);
});

Deno.test('classifyTransitions: retired ≥ 90d is purged', () => {
  const keys = [
    row({
      kid: 'ak_ancient',
      status: 'retired',
      retired_at: new Date(NOW - 91 * 86400_000).toISOString(),
    }),
    row({
      kid: 'ak_recent_retired',
      status: 'retired',
      retired_at: new Date(NOW - 30 * 86400_000).toISOString(),
    }),
  ];
  const plan = classifyTransitions(NOW, keys);
  assertEquals(plan.purge, ['ak_ancient']);
});

Deno.test('classifyTransitions: full lifecycle in one run', () => {
  const keys = [
    // current active — keep
    row({
      kid: 'ak_curr',
      status: 'active',
      activated_at: new Date(NOW - 3600_000).toISOString(),
    }),
    // previous active — retire
    row({
      kid: 'ak_prev',
      status: 'active',
      activated_at: new Date(NOW - 2 * 86400_000).toISOString(),
    }),
    // rotating ready — promote
    row({
      kid: 'ak_rot',
      status: 'rotating',
      created_at: new Date(NOW - 25 * 3600_000).toISOString(),
    }),
    // ancient retired — purge
    row({
      kid: 'ak_ancient',
      status: 'retired',
      retired_at: new Date(NOW - 100 * 86400_000).toISOString(),
    }),
  ];
  const plan = classifyTransitions(NOW, keys);
  assertEquals(plan.promote, ['ak_rot']);
  assertEquals(plan.retire, ['ak_prev']);
  assertEquals(plan.purge, ['ak_ancient']);
  assertEquals(plan.keepActive, ['ak_curr']);
});

// =====================================================================
// hasMultipleFreshActives — regression guard
// =====================================================================
Deno.test('hasMultipleFreshActives: single active → false', () => {
  const keys = [
    row({
      kid: 'ak_a',
      status: 'active',
      activated_at: new Date(NOW - 3600_000).toISOString(),
    }),
  ];
  assertEquals(hasMultipleFreshActives(NOW, keys), false);
});

Deno.test('hasMultipleFreshActives: two fresh actives → true (illegal state)', () => {
  const keys = [
    row({
      kid: 'ak_a',
      status: 'active',
      activated_at: new Date(NOW - 3600_000).toISOString(),
    }),
    row({
      kid: 'ak_b',
      status: 'active',
      activated_at: new Date(NOW - 7200_000).toISOString(),
    }),
  ];
  assert(hasMultipleFreshActives(NOW, keys));
});

Deno.test('hasMultipleFreshActives: two actives but one is past overlap → false', () => {
  const keys = [
    row({
      kid: 'ak_curr',
      status: 'active',
      activated_at: new Date(NOW - 3600_000).toISOString(),
    }),
    row({
      kid: 'ak_stale',
      status: 'active',
      activated_at: new Date(NOW - ACTIVE_TO_RETIRED_MS - 60_000).toISOString(),
    }),
  ];
  // The stale one should be retired by classifyTransitions; this helper
  // only flags coexistence INSIDE the overlap window.
  assertEquals(hasMultipleFreshActives(NOW, keys), false);
});

// =====================================================================
// Plan idempotency: applying the plan and re-running yields a stable plan
// =====================================================================
Deno.test('classifyTransitions is idempotent after applying', () => {
  const keys: CryptoKeyRow[] = [
    row({
      kid: 'ak_curr',
      status: 'active',
      activated_at: new Date(NOW - 3600_000).toISOString(),
    }),
    row({
      kid: 'ak_prev',
      status: 'active',
      activated_at: new Date(NOW - 2 * 86400_000).toISOString(),
    }),
  ];
  const plan1 = classifyTransitions(NOW, keys);
  // Simulate applying the plan: ak_prev becomes retired now.
  const after: CryptoKeyRow[] = keys.map((k) =>
    plan1.retire.includes(k.kid)
      ? { ...k, status: 'retired', retired_at: new Date(NOW).toISOString() }
      : k,
  );
  const plan2 = classifyTransitions(NOW, after);
  assertEquals(plan2.retire, []);
  assertEquals(plan2.keepActive, ['ak_curr']);
  assertEquals(plan2.purge, []);
});
