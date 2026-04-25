// POST /v1/proof-artifacts/:id/url — issue a short-lived signed URL for a stored artifact.
//
// Auth: X-AgeKey-API-Key. Caller must own the tenant that owns the artifact.
// Response includes a 300-second signed URL, never the raw bytes.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import {
  ForbiddenError,
  InvalidRequestError,
  NotFoundError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const FN = 'proof-artifact-url';
const SIGNED_URL_TTL_S = 300; // 5 minutos — TTL máximo permitido por LGPD/compliance

const Body = z
  .object({
    artifact_id: z.string().uuid(),
  })
  .strict();

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };

  if (req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await checkRateLimit(client, principal.apiKeyHash, 'proof-artifact-url', principal.tenantId);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const { artifact_id } = parsed.data;

    const { data: artifact, error: artErr } = await client
      .from('proof_artifacts')
      .select('id, tenant_id, storage_bucket, storage_path, mime_type, size_bytes')
      .eq('id', artifact_id)
      .maybeSingle();
    if (artErr) throw artErr;
    if (!artifact) throw new NotFoundError('Artifact not found');
    if (artifact.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('Artifact belongs to another tenant');
    }
    if (!artifact.storage_path) {
      // Fallback declarations don't have a Storage object — only the hash.
      throw new InvalidRequestError(
        'Artifact has no storage object (likely a fallback declaration)',
      );
    }

    const signed = await client.storage
      .from(artifact.storage_bucket)
      .createSignedUrl(artifact.storage_path, SIGNED_URL_TTL_S);

    if (signed.error || !signed.data) {
      throw signed.error ?? new InvalidRequestError('Failed to sign URL');
    }

    log.info('proof_artifact_url_issued', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      artifact_id,
      ttl_seconds: SIGNED_URL_TTL_S,
    });

    return jsonResponse(
      {
        artifact_id,
        url: signed.data.signedUrl,
        expires_in_seconds: SIGNED_URL_TTL_S,
        mime_type: artifact.mime_type,
        size_bytes: artifact.size_bytes,
      },
      { origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
