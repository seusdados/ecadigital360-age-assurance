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
import {
  ACTIVE_TO_RETIRED_MS,
  classifyTransitions,
  type CryptoKeyRow,
  RETIRED_PURGE_MS,
  ROTATING_TO_ACTIVE_MS,
} from '../_shared/key-rotation-logic.ts';

const FN = 'key-rotation';

function nextKid(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  return `ak_${y}${m}${day}_${h}`;
}

// (encodePrivateJwk hex placeholder removed in Fase 2.d — keys now live in
// Supabase Vault. See migration 014_vault_crypto_keys.sql.)

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
    const kid = nextKid();

    const initialStatus = hasAnyKey ? 'rotating' : 'active';
    const newRow = {
      kid,
      algorithm: 'ES256',
      status: initialStatus,
      public_jwk_json: pair.publicJwk,
      // Legacy columns kept NOT NULL by 004_trust.sql; we write empty
      // strings since the canonical storage is now Supabase Vault
      // (linked via crypto_keys.vault_secret_id by the RPC below).
      private_key_enc: '',
      private_key_iv: '',
      activated_at: initialStatus === 'active' ? new Date().toISOString() : null,
    };
    const ins = await client.from('crypto_keys').insert(newRow).select('id, kid, status').single();
    if (ins.error || !ins.data) throw ins.error ?? new InternalError('Failed to insert key');

    // Persist the private JWK in Supabase Vault and link via vault_secret_id.
    const { error: vaultErr } = await client.rpc('crypto_keys_store_private', {
      p_kid: kid,
      p_private_jwk_json: pair.privateJwk,
    });
    if (vaultErr) {
      // Roll back the row we just inserted to avoid orphan public-only keys.
      await client.from('crypto_keys').delete().eq('id', ins.data.id);
      throw new InternalError(`vault store failed: ${vaultErr.message}`);
    }

    // Compute the lifecycle plan via the pure helper (unit-tested in
    // _tests/key-rotation-logic.test.ts). The IO layer below just applies
    // it. ROTATING_TO_ACTIVE_MS / ACTIVE_TO_RETIRED_MS / RETIRED_PURGE_MS
    // are passed explicitly to keep call-site self-documenting.
    const plan = classifyTransitions(now, (keys ?? []) as CryptoKeyRow[], {
      rotatingToActiveMs: ROTATING_TO_ACTIVE_MS,
      activeToRetiredMs: ACTIVE_TO_RETIRED_MS,
      retiredPurgeMs: RETIRED_PURGE_MS,
    });

    // Promote rotating → active.
    for (const kidToPromote of plan.promote) {
      const upd = await client
        .from('crypto_keys')
        .update({ status: 'active', activated_at: new Date().toISOString() })
        .eq('kid', kidToPromote);
      if (upd.error) throw upd.error;
    }

    // Demote active → retired.
    for (const kidToRetire of plan.retire) {
      const upd = await client
        .from('crypto_keys')
        .update({ status: 'retired', retired_at: new Date().toISOString() })
        .eq('kid', kidToRetire);
      if (upd.error) throw upd.error;
    }

    // Purge retired keys older than 90 days. Vault secret is purged
    // first to avoid orphan rows in vault.secrets.
    for (const kidToPurge of plan.purge) {
      const purgeVault = await client.rpc('crypto_keys_purge_vault', {
        p_kid: kidToPurge,
      });
      if (purgeVault.error) throw purgeVault.error;
      const del = await client.from('crypto_keys').delete().eq('kid', kidToPurge);
      if (del.error) throw del.error;
    }

    const promotions = plan.promote;
    const retirements = plan.retire;
    const purges = plan.purge;

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
