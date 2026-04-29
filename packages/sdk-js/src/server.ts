// =============================================================================
// @agekey/sdk-js/server — Node / Deno / Bun entry
// =============================================================================
//
// Server-side AgeKey SDK. Holds the tenant API key and performs
// server-to-server calls plus local JWT verification with JWKS caching.
//
// Compatible runtimes:
//   * Node.js >= 18 (native `globalThis.fetch` + `globalThis.crypto.subtle`)
//   * Deno
//   * Bun
//   * Edge runtimes (Vercel Edge, Cloudflare Workers, Supabase Edge Functions)
//
// USAGE — Express
// ---------------
//   import express from 'express';
//   import { AgeKeyServer } from '@agekey/sdk-js/server';
//
//   const ageServer = new AgeKeyServer({ apiKey: process.env.AGEKEY_API_KEY! });
//
//   app.post('/api/verify/start', async (_req, res) => {
//     const session = await ageServer.createSession({
//       policy_slug: 'dev-18-plus',
//     });
//     res.json(session);
//   });
//
//   app.post(
//     '/api/agekey/webhook',
//     express.raw({ type: 'application/json' }),
//     async (req, res) => {
//       const signature = req.header('X-AgeKey-Signature') ?? '';
//       const payload = await ageServer.registerWebhookHandler(
//         req.body, // Buffer (express.raw)
//         signature,
//         process.env.AGEKEY_WEBHOOK_SECRET_HASH!,
//       );
//       // payload.event_type, payload.session_id, ...
//       res.sendStatus(204);
//     },
//   );
// =============================================================================

import {
  type ResultTokenClaims,
  type SessionCreateRequest,
  type SessionCreateResponse,
  type SessionGetResponse,
  type TokenRevokeRequest,
  type VerifiedToken,
  type VerifyOptions,
  SessionCreateResponseSchema,
  SessionGetResponseSchema,
  AgeKeyError,
  InternalError,
  InvalidRequestError,
  RateLimitError,
  SessionExpiredError,
  SessionAlreadyCompletedError,
  REASON_CODES,
  fetchJwks,
  verifyResultToken,
} from '@agekey/shared';
import type { ReasonCode } from '@agekey/shared';

export * from './types.ts';
export * from './errors.ts';

const DEFAULT_BASE_URL =
  'https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1';
const DEFAULT_ISSUER = 'https://agekey.com.br';
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// -----------------------------------------------------------------------------
// Server options
// -----------------------------------------------------------------------------

/**
 * Constructor options for {@link AgeKeyServer}.
 */
export interface AgeKeyServerOptions {
  /**
   * Tenant API key (`ak_*`). MUST be loaded from a secure server-side secret
   * store — never expose this in the browser bundle.
   */
  apiKey: string;
  /**
   * Base URL of the AgeKey Edge Functions endpoint.
   * Default: production URL.
   */
  baseUrl?: string;
  /**
   * Expected JWT issuer for `verifyToken`. Default: `https://agekey.com.br`.
   */
  issuer?: string;
  /**
   * Optional custom fetch. Defaults to `globalThis.fetch`.
   */
  fetch?: typeof globalThis.fetch;
}

// -----------------------------------------------------------------------------
// Webhook payload
// -----------------------------------------------------------------------------

/**
 * Decoded AgeKey webhook payload (PII-free). The `event_type` is
 * `verification.approved | verification.denied | verification.needs_review`.
 */
export interface AgeKeyWebhookPayload {
  event_id: string;
  event_type:
    | 'verification.approved'
    | 'verification.denied'
    | 'verification.needs_review';
  tenant_id: string;
  session_id: string;
  application_id: string;
  decision: 'approved' | 'denied' | 'needs_review';
  reason_code: ReasonCode;
  method: 'zkp' | 'vc' | 'gateway' | 'fallback';
  assurance_level: 'low' | 'substantial' | 'high';
  threshold_satisfied: boolean;
  jti: string;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Helpers — error handling
// -----------------------------------------------------------------------------

interface ParsedErrorBody {
  reasonCode: ReasonCode;
  message: string;
  details?: unknown;
}

async function parseErrorBody(resp: Response): Promise<ParsedErrorBody | null> {
  try {
    const body = (await resp.json()) as {
      error?: string;
      reason_code?: string;
      message?: string;
      details?: unknown;
    };
    if (body && typeof body.reason_code === 'string') {
      return {
        reasonCode: body.reason_code as ReasonCode,
        message: body.message ?? body.error ?? 'AgeKey error',
        ...(body.details !== undefined ? { details: body.details } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function toAgeKeyError(resp: Response): Promise<AgeKeyError> {
  const parsed = await parseErrorBody(resp);
  if (resp.status === 429) {
    const retryAfter = Number(resp.headers.get('retry-after') ?? '60');
    return new RateLimitError(Number.isFinite(retryAfter) ? retryAfter : 60);
  }
  if (parsed) {
    if (parsed.reasonCode === REASON_CODES.SESSION_EXPIRED) {
      return new SessionExpiredError();
    }
    if (parsed.reasonCode === REASON_CODES.SESSION_ALREADY_COMPLETED) {
      return new SessionAlreadyCompletedError();
    }
    return new AgeKeyError(
      resp.status,
      parsed.reasonCode,
      parsed.message,
      parsed.details,
    );
  }
  if (resp.status === 400) return new InvalidRequestError();
  return new InternalError(`Request failed: ${resp.status}`);
}

function joinUrl(base: string, path: string): string {
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

// -----------------------------------------------------------------------------
// Web Crypto — HMAC verification (works in Node 18+, Deno, Bun, browser)
// -----------------------------------------------------------------------------

const ENCODER = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new InvalidRequestError('Invalid hex string');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(byte)) {
      throw new InvalidRequestError('Invalid hex string');
    }
    out[i] = byte;
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(
  keyBytes: Uint8Array,
  payload: Uint8Array,
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new InternalError(
      'globalThis.crypto.subtle is not available — Node 18+, Deno, Bun, or modern browser required',
    );
  }
  const key = await subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await subtle.sign('HMAC', key, payload as BufferSource);
  return bytesToHex(new Uint8Array(sig));
}

function rawBodyToBytes(rawBody: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof rawBody === 'string') return ENCODER.encode(rawBody);
  if (rawBody instanceof Uint8Array) return rawBody;
  if (rawBody instanceof ArrayBuffer) return new Uint8Array(rawBody);
  throw new InvalidRequestError(
    'rawBody must be string | Uint8Array | ArrayBuffer (e.g. express.raw())',
  );
}

// -----------------------------------------------------------------------------
// JWKS cache (per-instance)
// -----------------------------------------------------------------------------

interface JwksCacheEntry {
  fetchedAt: number;
  keys: Awaited<ReturnType<typeof fetchJwks>>;
}

// -----------------------------------------------------------------------------
// AgeKeyServer
// -----------------------------------------------------------------------------

/**
 * Server-side AgeKey client. Authenticated with the tenant's `X-AgeKey-API-Key`.
 */
export class AgeKeyServer {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly issuer: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private jwksCache: JwksCacheEntry | null;

  /**
   * @param options See {@link AgeKeyServerOptions}.
   */
  constructor(options: AgeKeyServerOptions) {
    if (!options.apiKey || options.apiKey.length === 0) {
      throw new InvalidRequestError('apiKey is required');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.issuer = options.issuer ?? DEFAULT_ISSUER;
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== 'function') {
      throw new InternalError('No fetch implementation available');
    }
    this.fetchImpl = f.bind(globalThis);
    this.jwksCache = null;
  }

  /**
   * Create a verification session (server-to-server). The browser SDK consumes
   * the response — see {@link AgeKeyClient.start}.
   *
   * @throws {AgeKeyError} on HTTP failure.
   */
  async createSession(
    input: SessionCreateRequest,
    init?: { signal?: AbortSignal },
  ): Promise<SessionCreateResponse> {
    const url = joinUrl(this.baseUrl, '/verifications-session-create');
    const fetchInit: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-AgeKey-API-Key': this.apiKey,
      },
      body: JSON.stringify(input),
    };
    if (init?.signal !== undefined) {
      fetchInit.signal = init.signal;
    }
    const resp = await this.fetchImpl(url, fetchInit);
    if (!resp.ok) {
      throw await toAgeKeyError(resp);
    }
    const json = (await resp.json()) as unknown;
    return SessionCreateResponseSchema.parse(json);
  }

  /**
   * Fetch the public, PII-free view of a session. Useful for polling or
   * audit reads.
   */
  async getSession(
    sessionId: string,
    init?: { signal?: AbortSignal },
  ): Promise<SessionGetResponse> {
    const url = joinUrl(
      this.baseUrl,
      `/verifications-session-get/${encodeURIComponent(sessionId)}`,
    );
    const fetchInit: RequestInit = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-AgeKey-API-Key': this.apiKey,
      },
    };
    if (init?.signal !== undefined) {
      fetchInit.signal = init.signal;
    }
    const resp = await this.fetchImpl(url, fetchInit);
    if (!resp.ok) throw await toAgeKeyError(resp);
    const json = (await resp.json()) as unknown;
    return SessionGetResponseSchema.parse(json);
  }

  /**
   * Verify an AgeKey result JWT. By default fetches and caches the JWKS for
   * 5 minutes. Pass `fetchJwks: false` to skip the network and rely on the
   * AgeKey backend `/verifications-token-verify` endpoint instead.
   *
   * @param jwt The result token JWT string.
   * @param opts.expectedAudience Optional audience claim to enforce.
   * @param opts.fetchJwks When `false`, calls the backend verify endpoint
   *                       instead of verifying locally. Default `true`.
   * @returns The {@link VerifiedToken} from `@agekey/shared`.
   */
  async verifyToken(
    jwt: string,
    opts: { expectedAudience?: string; fetchJwks?: boolean } = {},
  ): Promise<VerifiedToken> {
    const useLocal = opts.fetchJwks ?? true;
    if (useLocal) {
      const keys = await this.getJwks();
      const verifyOpts: VerifyOptions = {
        jwksKeys: keys,
        expectedIssuer: this.issuer,
      };
      if (opts.expectedAudience !== undefined) {
        verifyOpts.expectedAudience = opts.expectedAudience;
      }
      return verifyResultToken(jwt, verifyOpts);
    }

    // Remote verification path.
    const url = joinUrl(this.baseUrl, '/verifications-token-verify');
    const body: { token: string; expected_audience?: string } = { token: jwt };
    if (opts.expectedAudience !== undefined) {
      body.expected_audience = opts.expectedAudience;
    }
    const resp = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-AgeKey-API-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw await toAgeKeyError(resp);
    const json = (await resp.json()) as {
      valid: boolean;
      claims?: ResultTokenClaims;
      revoked: boolean;
      reason_code?: string;
    };
    return {
      valid: json.valid && !json.revoked,
      ...(json.claims !== undefined ? { claims: json.claims } : {}),
    };
  }

  /**
   * Revoke a previously issued result token by its JWT ID.
   *
   * @param jti UUID of the token (the `jti` claim).
   * @param reason Free-form audit string (e.g. "user logged out").
   */
  async revokeToken(jti: string, reason: string): Promise<void> {
    const url = joinUrl(this.baseUrl, '/verifications-token-revoke');
    const body: TokenRevokeRequest = { jti, reason };
    const resp = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-AgeKey-API-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw await toAgeKeyError(resp);
  }

  /**
   * Obtain a short-lived signed URL (TTL 300s) to download a proof artifact.
   *
   * @returns The signed URL string.
   * @throws {AgeKeyError} 403 when the artifact belongs to another tenant;
   *                       400 when the artifact has no Storage object
   *                       (e.g. fallback declarations).
   */
  async getArtifactUrl(artifactId: string): Promise<string> {
    const url = joinUrl(this.baseUrl, '/proof-artifact-url');
    const resp = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-AgeKey-API-Key': this.apiKey,
      },
      body: JSON.stringify({ artifact_id: artifactId }),
    });
    if (!resp.ok) throw await toAgeKeyError(resp);
    const json = (await resp.json()) as { url?: string };
    if (typeof json.url !== 'string') {
      throw new InternalError('proof-artifact-url missing url field');
    }
    return json.url;
  }

  /**
   * Verify the HMAC-SHA256 signature of an incoming AgeKey webhook and return
   * the parsed JSON payload.
   *
   * Compute `secretHashHex` once, on webhook secret creation, as
   * `sha256(raw_secret).hex` — this is the exact value persisted in
   * `webhook_endpoints.secret_hash`. See
   * `docs/HANDOFF_EDGE_TO_FRONTEND.md` §5.b.
   *
   * @param rawBody     The raw request body (Buffer / string / Uint8Array).
   *                    For Express, use `express.raw({ type: 'application/json' })`.
   * @param signatureHeader Value of the `X-AgeKey-Signature` header.
   * @param secretHashHex   `hex(sha256(raw_webhook_secret))`.
   * @returns The decoded {@link AgeKeyWebhookPayload}.
   * @throws {InvalidRequestError} when signature is invalid or body is malformed.
   */
  async registerWebhookHandler(
    rawBody: string | Uint8Array | ArrayBuffer,
    signatureHeader: string,
    secretHashHex: string,
  ): Promise<AgeKeyWebhookPayload> {
    if (!signatureHeader) {
      throw new InvalidRequestError('Missing X-AgeKey-Signature header');
    }
    const payloadBytes = rawBodyToBytes(rawBody);
    const keyBytes = hexToBytes(secretHashHex);
    const expected = await hmacSha256Hex(keyBytes, payloadBytes);
    const provided = signatureHeader.trim().toLowerCase();
    if (!constantTimeEqualHex(expected, provided)) {
      throw new InvalidRequestError('Webhook signature mismatch');
    }
    let parsed: unknown;
    try {
      const text =
        typeof rawBody === 'string'
          ? rawBody
          : new TextDecoder().decode(payloadBytes);
      parsed = JSON.parse(text);
    } catch {
      throw new InvalidRequestError('Webhook body is not valid JSON');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new InvalidRequestError('Webhook body must be a JSON object');
    }
    return parsed as AgeKeyWebhookPayload;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async getJwks(): Promise<
    Awaited<ReturnType<typeof fetchJwks>>
  > {
    const now = Date.now();
    if (
      this.jwksCache !== null &&
      now - this.jwksCache.fetchedAt < JWKS_CACHE_TTL_MS
    ) {
      return this.jwksCache.keys;
    }
    const url = joinUrl(this.baseUrl, '/jwks');
    const keys = await fetchJwks(url);
    this.jwksCache = { fetchedAt: now, keys };
    return keys;
  }
}
