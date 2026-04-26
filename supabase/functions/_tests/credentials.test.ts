// Deno tests — _shared/credentials.ts
//
// Validates entropy, prefix shape and never colliding within 1024 generations.

import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import { newApiKey, newWebhookSecret } from '../_shared/credentials.ts';

Deno.test('newApiKey produces ak_<env>_<32 b64url> shape', () => {
  for (const env of ['live', 'test', 'dev'] as const) {
    const { raw, prefix } = newApiKey(env);
    assert(raw.startsWith(`ak_${env}_`), `expected env prefix, got ${raw}`);
    // ak_ + env + _ + 32 random chars
    const random = raw.slice(`ak_${env}_`.length);
    assertEquals(random.length, 32);
    assert(/^[A-Za-z0-9_-]{32}$/.test(random), 'random part must be base64url');
    // Prefix preserves the env discriminator and shows first 6 chars + ellipsis.
    assert(prefix.startsWith(`ak_${env}_`));
    assert(prefix.endsWith('…'));
  }
});

Deno.test('newWebhookSecret has whsec_ prefix and 32 b64url chars', () => {
  const s = newWebhookSecret();
  assert(s.startsWith('whsec_'));
  const tail = s.slice('whsec_'.length);
  assertEquals(tail.length, 32);
  assert(/^[A-Za-z0-9_-]{32}$/.test(tail));
});

Deno.test('1024 generated api keys are unique', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1024; i++) {
    const { raw } = newApiKey('test');
    assert(!seen.has(raw), `collision at iteration ${i}`);
    seen.add(raw);
  }
});

Deno.test('1024 generated webhook secrets are unique', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1024; i++) {
    const s = newWebhookSecret();
    assert(!seen.has(s), `collision at iteration ${i}`);
    seen.add(s);
  }
});
