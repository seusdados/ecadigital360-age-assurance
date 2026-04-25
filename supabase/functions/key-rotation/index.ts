// POST /functions/v1/key-rotation — cron job that rotates ES256 signing keys.
//
// Auth: Bearer <CRON_SECRET> in Authorization header.
//
// Rotation algorithm:
//   1. Generate fresh ES256 keypair.
//   2. INSERT new key as status='rotating'.
//   3. Promote previous 'rotating' (if any) → 'active' (with activated_at=now).
//   4. Demote previous 'active' (older than 24h) → 'retired'.
//   5. Hard-delete 'retired' keys older than 90 days (after token TTL safety window).
//
// In a fresh database where no keys exist yet, the new key skips the rotating
// state and is activated immediately so signing endpoints can work.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import {
  ForbiddenError,
  InternalError,
  InvalidRequestError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { config } from '../_shared/env.ts';
import { generateEs256KeyPair } from '../_shared/tokens.ts';

const FN = 'key-rotation';

const ROTATING_TO_ACTIVE_MS = 24 * 60 * 60 * 1000; // 24h
const ACTIVE_TO_RETIRED_MS = 24 * 60 * 60 * 1000; // 24h overlap
const RETIRED_PURGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function nextKid(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  return `ak_${y}${m}${day}_${h}`;
}

// Encode a JWK as hex of its JSON serialization. Production must replace this
// with a Vault-backed encryption (pgsodium / vault.decrypted_secrets).
function encodePrivateJwk(jwk: JsonWebKey): { enc: string; iv: string } {
  const bytes = new TextEncoder().encode(JSON.stringify(jwk));
  let enc = '';
  for (const b of bytes) enc += b.toString(16).padStart(2, '0');
  return { enc, iv: '00'.repeat(12) };
}

serve(async (req) => {
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: null };

  try {
    if (req.method !== 'POST') {
      throw new InvalidRequestError('Method not allowed');
    }

    const authz = req.headers.get('authorization') ?? '';
    const expected = `Bearer ${config.cronSecret()}`;
    if (authz !== expected) {
      throw new ForbiddenError('Invalid cron secret');
    }

    const client = db();

    const { data: keys, error: keysErr } = await client
      .from('crypto_keys')
      .select('id, kid, status, activated_at, retired_at, created_at')
      .order('created_at', { ascending: false });
    if (keysErr) throw keysErr;

    const now = Date.now();
    const hasAnyKey = (keys?.length ?? 0) > 0;

    const pair = await generateEs256KeyPair();
    const { enc, iv } = encodePrivateJwk(pair.privateJwk);
    const kid = nextKid();

    const initialStatus = hasAnyKey ? 'rotating' : 'active';
    const newRow = {
      kid,
      algorithm: 'ES256',
      status: initialStatus,
      public_jwk_json: pair.publicJwk,
      private_key_enc: enc,
      private_key_iv: iv,
      activated_at: initialStatus === 'active' ? new Date().toISOString() : null,
    };
    const ins = await client.from('crypto_keys').insert(newRow).select('id, kid, status').single();
    if (ins.error || !ins.data) throw ins.error ?? new InternalError('Failed to insert key');

    // Promote old rotating → active when ≥ 24h old
    const promotions: string[] = [];
    for (const k of keys ?? []) {
      if (k.status !== 'rotating') continue;
      const age = now - new Date(k.created_at).getTime();
      if (age >= ROTATING_TO_ACTIVE_MS) {
        const upd = await client
          .from('crypto_keys')
          .update({ status: 'active', activated_at: new Date().toISOString() })
          .eq('id', k.id);
        if (upd.error) throw upd.error;
        promotions.push(k.kid);
      }
    }

    // Demote active → retired when ≥ 24h old AND not the most recently activated
    let mostRecentActivated: { id: string; activated_at: string } | null = null;
    for (const k of keys ?? []) {
      if (k.status === 'active' && k.activated_at) {
        if (
          !mostRecentActivated ||
          new Date(k.activated_at).getTime() > new Date(mostRecentActivated.activated_at).getTime()
        ) {
          mostRecentActivated = { id: k.id, activated_at: k.activated_at };
        }
      }
    }
    const retirements: string[] = [];
    for (const k of keys ?? []) {
      if (k.status !== 'active' || !k.activated_at) continue;
      if (mostRecentActivated && k.id === mostRecentActivated.id) continue;
      const age = now - new Date(k.activated_at).getTime();
      if (age >= ACTIVE_TO_RETIRED_MS) {
        const upd = await client
          .from('crypto_keys')
          .update({ status: 'retired', retired_at: new Date().toISOString() })
          .eq('id', k.id);
        if (upd.error) throw upd.error;
        retirements.push(k.kid);
      }
    }

    // Purge retired keys older than 90 days
    const purges: string[] = [];
    for (const k of keys ?? []) {
      if (k.status !== 'retired' || !k.retired_at) continue;
      const age = now - new Date(k.retired_at).getTime();
      if (age >= RETIRED_PURGE_MS) {
        const del = await client.from('crypto_keys').delete().eq('id', k.id);
        if (del.error) throw del.error;
        purges.push(k.kid);
      }
    }

    log.info('key_rotation', {
      fn: FN,
      trace_id,
      new_kid: ins.data.kid,
      new_status: ins.data.status,
      promotions,
      retirements,
      purges,
    });

    return jsonResponse(
      {
        new_kid: ins.data.kid,
        status: ins.data.status,
        promotions,
        retirements,
        purges,
      },
      { origin: null, status: 201 },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
