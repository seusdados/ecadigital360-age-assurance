import 'server-only';

import { agekeyEnv } from './env';

/**
 * Server-only HTTP client for AgeKey Edge Functions.
 *
 * - Authenticates with `X-AgeKey-API-Key` (admin key, server-only env var).
 * - Throws AgeKeyApiError on non-2xx responses with the typed error body.
 * - Never logs payloads — they may include reason codes or trace ids that
 *   we DO log, but the request body itself is held in memory only.
 */

export class AgeKeyApiError extends Error {
  readonly status: number;
  readonly reasonCode: string;
  readonly traceId: string | undefined;
  readonly details: unknown;

  constructor(
    status: number,
    reasonCode: string,
    message: string,
    traceId: string | undefined,
    details: unknown,
  ) {
    super(message);
    this.name = 'AgeKeyApiError';
    this.status = status;
    this.reasonCode = reasonCode;
    this.traceId = traceId;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  // Allow per-call cache override; default 'no-store' for admin endpoints.
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const base = agekeyEnv.apiBase();
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    'X-AgeKey-API-Key': agekeyEnv.adminApiKey(),
    'Content-Type': 'application/json',
  };

  const init: RequestInit & { next?: RequestOptions['next'] } = {
    method: opts.method ?? 'GET',
    headers,
    cache: opts.cache ?? 'no-store',
  };

  if (opts.next) {
    init.next = opts.next;
  }

  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }

  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const body =
      isJson && payload && typeof payload === 'object'
        ? (payload as {
            error?: string;
            reason_code?: string;
            message?: string;
            trace_id?: string;
            details?: unknown;
          })
        : null;
    throw new AgeKeyApiError(
      response.status,
      body?.reason_code ?? 'INTERNAL_ERROR',
      body?.message ?? `HTTP ${response.status}`,
      body?.trace_id,
      body?.details,
    );
  }

  return payload as T;
}

// ---------------------------------------------------------------
// Domain-typed wrappers. Keeping these here (rather than scattered
// in feature files) makes it trivial to grep all server-side calls.
// ---------------------------------------------------------------

export interface PolicyListItem {
  id: string;
  tenant_id: string | null;
  slug: string;
  name: string;
  age_threshold: number;
  age_band_min: number | null;
  age_band_max: number | null;
  jurisdiction_code: string | null;
  method_priority_json: Array<'zkp' | 'vc' | 'gateway' | 'fallback'>;
  required_assurance_level: 'low' | 'substantial' | 'high';
  token_ttl_seconds: number;
  current_version: number;
  is_template: boolean;
  status: string;
}

export interface IssuerListItem {
  id: string;
  issuer_did: string;
  name: string;
  trust_status: 'trusted' | 'suspended' | 'untrusted';
  supports_formats: string[];
  jwks_uri: string | null;
  scope: 'global' | 'tenant';
}

// ---------------------------------------------------------------
// AUDIT
// ---------------------------------------------------------------

export type AuditActorType = 'user' | 'api_key' | 'system' | 'cron';

export interface AuditEventItem {
  id: string;
  actor_type: AuditActorType;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  diff_json: Record<string, unknown>;
  client_ip: string | null;
  created_at: string;
}

export interface AuditListResponse {
  items: AuditEventItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface AuditListParams {
  action?: string;
  resource_type?: string;
  actor_type?: AuditActorType;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export const agekey = {
  policies: {
    list: (params: { include_templates?: boolean } = {}) =>
      request<{ items: PolicyListItem[] }>('/policies-list', {
        query: { include_templates: params.include_templates ?? true },
      }),
    write: (body: PolicyWriteInput) =>
      request<{ id: string; version: number; status: 'created' | 'updated' }>(
        '/policies-write',
        { method: 'POST', body },
      ),
  },
  issuers: {
    list: () =>
      request<{ items: IssuerListItem[] }>('/issuers-list'),
    register: (body: IssuerRegisterInput) =>
      request<{ id: string; status: 'created' | 'updated' }>('/issuers-register', {
        method: 'POST',
        body,
      }),
  },
  tokens: {
    revoke: (jti: string, reason: string) =>
      request<{ jti: string; status: 'revoked' | 'already_revoked' }>(
        '/verifications-token-revoke',
        { method: 'POST', body: { jti, reason } },
      ),
  },
  artifacts: {
    signedUrl: (artifact_id: string) =>
      request<{
        artifact_id: string;
        url: string;
        expires_in_seconds: number;
        mime_type: string | null;
        size_bytes: number | null;
      }>('/proof-artifact-url', { method: 'POST', body: { artifact_id } }),
  },
  audit: {
    list: (params: AuditListParams = {}) =>
      request<AuditListResponse>('/audit-list', {
        query: {
          action: params.action,
          resource_type: params.resource_type,
          actor_type: params.actor_type,
          from: params.from,
          to: params.to,
          cursor: params.cursor,
          limit: params.limit,
        },
      }),
  },
};

// Input types kept loose; full Zod validation happens in lib/validations/*.
export interface PolicyWriteInput {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  age_threshold: number;
  age_band_min?: number | null;
  age_band_max?: number | null;
  jurisdiction_code?: string | null;
  method_priority_json?: Array<'zkp' | 'vc' | 'gateway' | 'fallback'>;
  required_assurance_level?: 'low' | 'substantial' | 'high';
  token_ttl_seconds?: number;
  cloned_from_id?: string | null;
}

export interface IssuerRegisterInput {
  issuer_did: string;
  name: string;
  supports_formats?: string[];
  jwks_uri?: string;
  public_keys_json?: Record<string, unknown>;
  metadata_json?: Record<string, unknown>;
}
