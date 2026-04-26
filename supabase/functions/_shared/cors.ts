import { config } from './env.ts';

// Build CORS headers. NEVER returns "*" for production — falls back
// to the first allowed origin when the request origin is unknown.
export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = config.allowedOrigins();
  const isWildcard = allowed.length === 1 && allowed[0] === '*';

  let allowOrigin: string;
  if (isWildcard) {
    allowOrigin = origin ?? '*';
  } else if (origin && allowed.includes(origin)) {
    allowOrigin = origin;
  } else {
    allowOrigin = allowed[0] ?? '';
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-agekey-api-key, x-agekey-trace-id',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response('ok', {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}
