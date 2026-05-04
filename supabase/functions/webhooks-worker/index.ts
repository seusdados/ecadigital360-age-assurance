// POST /functions/v1/webhooks-worker — cron worker that drains pending webhook deliveries.
//
// Auth: Bearer CRON_SECRET. Picks up to BATCH_SIZE pending deliveries due now,
// computes/refreshes signature, POSTs to endpoint with timeout, then updates
// status + next_attempt_at (exponential backoff). Dead-letters after 6 attempts.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { ForbiddenError, InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { config } from '../_shared/env.ts';
import {
  WEBHOOK_HEADERS,
  payloadHash,
} from '../../../packages/shared/src/webhooks/index.ts';

const FN = 'webhooks-worker';

const BATCH_SIZE = 50;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 6;
// Backoff (in seconds) per attempt 0..5 → 30s, 2m, 10m, 1h, 6h, 24h.
const BACKOFFS_S = [30, 120, 600, 3600, 21_600, 86_400];

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

serve(async (req) => {
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: null };

  try {
    if (req.method !== 'POST') throw new InvalidRequestError('Method not allowed');
    if (req.headers.get('authorization') !== `Bearer ${config.cronSecret()}`) {
      throw new ForbiddenError('Invalid cron secret');
    }

    const client = db();
    const nowIso = new Date().toISOString();

    const { data: pending, error: fetchErr } = await client
      .from('webhook_deliveries')
      .select(
        'id, endpoint_id, tenant_id, event_type, payload_json, signature, idempotency_key, attempts',
      )
      .eq('status', 'pending')
      .lte('next_attempt_at', nowIso)
      .order('next_attempt_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (fetchErr) throw fetchErr;

    let delivered = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const d of pending ?? []) {
      // Load endpoint to get URL + secret raw is unavailable; we sign with the
      // hash + payload — cliente verifica usando o secret armazenado na sua side.
      // Esquema: header X-AgeKey-Signature = HMAC-SHA256(secret_raw, body).
      // Nesta fase o sign acontece no momento do enqueue (delivery.signature).
      const { data: endpoint } = await client
        .from('webhook_endpoints')
        .select('url, status, deleted_at')
        .eq('id', d.endpoint_id)
        .maybeSingle();

      if (!endpoint || endpoint.deleted_at || endpoint.status !== 'active') {
        await client
          .from('webhook_deliveries')
          .update({
            status: 'failed',
            last_error: 'endpoint_inactive_or_missing',
            attempts: d.attempts + 1,
          })
          .eq('id', d.id);
        failed++;
        continue;
      }

      const body = JSON.stringify(d.payload_json);
      // Headers canônicos enviados em paralelo aos headers legados
      // (compat-safe). O signature legado em `d.signature` continua
      // sendo a assinatura primária; o `X-AgeKey-Webhook-*` é
      // informativo até que a Rodada de migração de trigger SQL
      // (012_webhook_enqueue.sql) seja executada.
      const canonicalTimestamp = Math.floor(Date.now() / 1000).toString();
      const canonicalPayloadHash = await payloadHash(body);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      let lastResponseCode: number | null = null;
      let lastError: string | null = null;
      let ok = false;
      try {
        const resp = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Headers legados (mantidos por compatibilidade):
            'X-AgeKey-Event-Type': d.event_type,
            'X-AgeKey-Delivery-Id': d.idempotency_key,
            'X-AgeKey-Signature': d.signature,
            // Headers canônicos (Rodada Core readiness alignment):
            [WEBHOOK_HEADERS.EVENT_TYPE]: d.event_type,
            [WEBHOOK_HEADERS.EVENT_ID]: d.idempotency_key,
            [WEBHOOK_HEADERS.IDEMPOTENCY_KEY]: d.idempotency_key,
            [WEBHOOK_HEADERS.TIMESTAMP]: canonicalTimestamp,
            'X-AgeKey-Payload-Hash': canonicalPayloadHash,
          },
          body,
          signal: ctrl.signal,
        });
        lastResponseCode = resp.status;
        ok = resp.ok;
        if (!ok) lastError = `http_${resp.status}`;
      } catch (e) {
        lastError = e instanceof Error ? e.name : 'unknown_error';
      } finally {
        clearTimeout(t);
      }

      const newAttempts = d.attempts + 1;
      if (ok) {
        await client
          .from('webhook_deliveries')
          .update({
            status: 'delivered',
            attempts: newAttempts,
            last_response_code: lastResponseCode,
            last_error: null,
          })
          .eq('id', d.id);
        delivered++;
        continue;
      }

      if (newAttempts >= MAX_ATTEMPTS) {
        await client
          .from('webhook_deliveries')
          .update({
            status: 'dead_letter',
            attempts: newAttempts,
            last_response_code: lastResponseCode,
            last_error: lastError,
          })
          .eq('id', d.id);
        deadLettered++;
        continue;
      }

      const backoffS = BACKOFFS_S[Math.min(newAttempts, BACKOFFS_S.length - 1)] ?? 60;
      const next = new Date(Date.now() + backoffS * 1000).toISOString();
      await client
        .from('webhook_deliveries')
        .update({
          attempts: newAttempts,
          next_attempt_at: next,
          last_response_code: lastResponseCode,
          last_error: lastError,
        })
        .eq('id', d.id);
      failed++;
    }

    log.info('webhooks_worker_run', {
      fn: FN,
      trace_id,
      processed: pending?.length ?? 0,
      delivered,
      failed,
      dead_lettered: deadLettered,
    });

    return jsonResponse(
      { processed: pending?.length ?? 0, delivered, failed, dead_lettered: deadLettered },
      { origin: null },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});

// Mark hmacSha256Hex as exported for later use; for now it's only referenced
// when the verifier-core enqueues a delivery (out of scope here).
export { hmacSha256Hex };
