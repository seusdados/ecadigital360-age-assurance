// GET /.well-known/jwks.json — public verification keys.
// No auth. Cacheable for 5 minutes (CDN-friendly).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { loadJwksPublicKeys } from '../_shared/keys.ts';

const FN = 'jwks';
const CACHE_TTL_S = 300;

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };

  if (req.method !== 'GET') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const keys = await loadJwksPublicKeys(db());

    const body = {
      keys: keys.map((k) => ({
        ...k.publicJwk,
        kid: k.kid,
        use: 'sig',
        alg: 'ES256',
      })),
    };

    log.info('jwks_served', { fn: FN, trace_id, key_count: keys.length });

    return jsonResponse(body, {
      origin,
      headers: {
        'Cache-Control': `public, max-age=${CACHE_TTL_S}, s-maxage=${CACHE_TTL_S}`,
      },
    });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
