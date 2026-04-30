// Token bucket rate limiter. Backed by `rate_limit_buckets` (PG table).
// Key = SHA-256(api_key_hash + ":" + route).
// Algorithm: refill (tokens += refill_rate * elapsed_seconds, capped at capacity),
// then consume 1 token. Atomic via UPDATE ... RETURNING.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { RateLimitError } from './errors.ts';
import { sha256Hex } from './db.ts';

export interface RateLimitConfig {
  capacity: number; // burst max
  refillRate: number; // tokens per second
}

const DEFAULT: RateLimitConfig = { capacity: 60, refillRate: 1 };

const ROUTE_OVERRIDES: Record<string, RateLimitConfig> = {
  'session-create': { capacity: 30, refillRate: 0.5 },
  'session-complete': { capacity: 30, refillRate: 0.5 },
  'token-verify': { capacity: 600, refillRate: 10 },
};

export async function checkRateLimit(
  client: SupabaseClient,
  apiKeyHash: string,
  route: string,
  tenantId: string | null = null,
): Promise<void> {
  const cfg = ROUTE_OVERRIDES[route] ?? DEFAULT;
  const key = await sha256Hex(`${apiKeyHash}:${route}`);

  // Try atomic upsert + decrement via a tiny RPC. If it doesn't exist,
  // fall back to a non-atomic SELECT+UPDATE (acceptable for staging).
  const { data, error } = await client.rpc('rate_limit_consume', {
    p_key: key,
    p_tenant_id: tenantId,
    p_capacity: cfg.capacity,
    p_refill_rate: cfg.refillRate,
  });

  if (error) {
    if (/function .* does not exist/i.test(error.message)) {
      await fallbackConsume(client, key, tenantId, cfg);
      return;
    }
    throw error;
  }

  const allowed = (data as unknown as { allowed: boolean; retry_after: number } | null) ?? null;
  if (allowed && !allowed.allowed) {
    throw new RateLimitError(Math.max(1, Math.ceil(allowed.retry_after)));
  }
}

async function fallbackConsume(
  client: SupabaseClient,
  key: string,
  tenantId: string | null,
  cfg: RateLimitConfig,
): Promise<void> {
  const now = new Date();

  const existing = await client
    .from('rate_limit_buckets')
    .select('tokens, capacity, refill_rate, last_refill_at')
    .eq('key', key)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (!existing.data) {
    const insert = await client.from('rate_limit_buckets').insert({
      key,
      tenant_id: tenantId,
      tokens: cfg.capacity - 1,
      capacity: cfg.capacity,
      refill_rate: cfg.refillRate,
      last_refill_at: now.toISOString(),
    });
    if (insert.error) throw insert.error;
    return;
  }

  const elapsedMs = now.getTime() - new Date(existing.data.last_refill_at).getTime();
  const refilled = Math.min(
    existing.data.capacity,
    existing.data.tokens + (existing.data.refill_rate * elapsedMs) / 1000,
  );

  if (refilled < 1) {
    const retryAfter = Math.ceil((1 - refilled) / existing.data.refill_rate);
    throw new RateLimitError(retryAfter);
  }

  const upd = await client
    .from('rate_limit_buckets')
    .update({
      tokens: refilled - 1,
      last_refill_at: now.toISOString(),
    })
    .eq('key', key);
  if (upd.error) throw upd.error;
}
