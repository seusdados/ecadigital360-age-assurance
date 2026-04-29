// =============================================================================
// @agekey/sdk-js — Browser entry
// =============================================================================
//
// Public, browser-safe SDK for AgeKey age assurance. Designed for client-side
// usage (Next.js client components, vanilla browser apps, mobile WebViews).
//
// SECURITY MODEL
// ---------------
// AgeKey API keys (`ak_*`) are TENANT-LEVEL secrets and MUST NOT be embedded
// in browser bundles. Therefore this SDK does NOT call the
// `verifications-session-create` endpoint directly — that step happens on the
// integrating app's server (use `AgeKeyServer.createSession` from the server
// entry, or your own backend code).
//
// The browser SDK consumes a `SessionCreateResponse` already obtained from
// the server, and drives only the in-flow UI: method selection and the
// `verifications-session-complete` call.
//
// USAGE (Next.js example)
// -----------------------
//   // 1) Server route handler:
//   //    const session = await ageServer.createSession({ policy_slug: 'dev-18-plus' });
//   //    return Response.json(session);
//
//   // 2) Client component:
//   import { AgeKeyClient } from '@agekey/sdk-js';
//
//   const client = new AgeKeyClient({ applicationId: 'my-app' });
//   const session = await fetch('/api/agekey/start').then((r) => r.json());
//   const handle = client.start({ session });
//
//   handle.on('approved', (claims) => console.log(claims));
//   handle.on('denied', (reason) => console.warn(reason));
//
//   await handle.completeFallback({ ageAtLeast: 18, captchaToken: '...' });
//
// =============================================================================

import {
  type ResultTokenClaims,
  type ReasonCode,
  type SessionCreateResponse,
  type SessionCompleteRequest,
  type SessionCompleteResponse,
  type SessionGetResponse,
  type VerificationMethod,
  SessionCompleteResponseSchema,
  SessionGetResponseSchema,
  AgeKeyError,
  InternalError,
  InvalidRequestError,
  RateLimitError,
  SessionExpiredError,
  SessionAlreadyCompletedError,
  REASON_CODES,
} from '@agekey/shared';

export * from './types.ts';
export * from './errors.ts';

// -----------------------------------------------------------------------------
// Client configuration
// -----------------------------------------------------------------------------

/**
 * Constructor options for {@link AgeKeyClient}.
 */
export interface AgeKeyClientOptions {
  /**
   * Application slug or UUID identifying the integrating tenant application.
   * Used as the JWT `aud` claim and for telemetry tagging.
   */
  applicationId: string;
  /**
   * Base URL of the AgeKey Edge Functions endpoint.
   * Defaults to the production URL.
   */
  baseUrl?: string;
  /**
   * BCP-47 locale for SDK-emitted UI strings and the `locale` field sent to
   * complete payloads. Default: `'pt-BR'`.
   */
  locale?: string;
  /**
   * Optional `fetch` implementation override. Defaults to `globalThis.fetch`.
   * Useful for testing or environments that wrap fetch.
   */
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_BASE_URL =
  'https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1';

// -----------------------------------------------------------------------------
// SessionHandle event types
// -----------------------------------------------------------------------------

/**
 * Event emitted when the session is approved. Carries the verified
 * {@link ResultTokenClaims} when present, plus the raw JWT and reason code.
 */
export interface ApprovedEvent {
  jwt: string;
  jti: string;
  expiresAt: string;
  kid: string;
  reasonCode: ReasonCode;
  method: VerificationMethod;
  claims?: ResultTokenClaims;
}

/**
 * Event emitted when the session is denied. Carries the reason code and method.
 */
export interface DeniedEvent {
  reasonCode: ReasonCode;
  method: VerificationMethod;
}

/**
 * Event emitted when the verification needs human review.
 */
export interface NeedsReviewEvent {
  reasonCode: ReasonCode;
  method: VerificationMethod;
}

/**
 * Event emitted when an error occurs. Wraps {@link AgeKeyError} when known.
 */
export interface ErrorEvent {
  error: Error;
  reasonCode?: ReasonCode;
}

/**
 * Mapping from event names to their payload shapes.
 */
export interface SessionHandleEventMap {
  approved: ApprovedEvent;
  denied: DeniedEvent;
  needs_review: NeedsReviewEvent;
  error: ErrorEvent;
}

export type SessionHandleEventName = keyof SessionHandleEventMap;

/**
 * Listener callback signature for {@link SessionHandle.on}.
 */
export type SessionHandleListener<E extends SessionHandleEventName> = (
  payload: SessionHandleEventMap[E],
) => void;

// -----------------------------------------------------------------------------
// Complete payload shapes (SDK-friendly camelCase wrappers around the raw
// snake_case body the Edge Function expects).
// -----------------------------------------------------------------------------

/**
 * Input for {@link SessionHandle.completeFallback} — declared minimum age.
 */
export interface FallbackCompleteInput {
  ageAtLeast: number;
  captchaToken?: string;
  deviceFingerprint?: string;
}

/**
 * Input for {@link SessionHandle.completeVc} — VC presentation.
 */
export interface VcCompleteInput {
  credential: string;
  format: 'w3c_vc' | 'sd_jwt_vc';
  issuerDid: string;
  presentationNonce?: string;
}

/**
 * Input for {@link SessionHandle.completeZkp} — ZKP proof.
 */
export interface ZkpCompleteInput {
  proof: string;
  proofFormat?: string;
  issuerDid: string;
}

/**
 * Input for {@link SessionHandle.completeGateway} — provider attestation.
 */
export interface GatewayCompleteInput {
  attestation: string;
  provider: string;
}

// -----------------------------------------------------------------------------
// Helpers
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
// SessionHandle
// -----------------------------------------------------------------------------

/**
 * In-flight verification session — created by {@link AgeKeyClient.start}.
 *
 * Provides typed methods for completing verification via each adapter and
 * an `on(...)` listener API for terminal-state events.
 */
export class SessionHandle {
  readonly sessionId: string;
  readonly availableMethods: ReadonlyArray<VerificationMethod>;
  readonly preferredMethod: VerificationMethod;
  readonly expiresAt: string;

  private selectedMethod: VerificationMethod;
  private readonly baseUrl: string;
  private readonly locale: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly applicationId: string;
  private readonly abortController: AbortController;
  private readonly listeners: {
    [E in SessionHandleEventName]: Set<SessionHandleListener<E>>;
  };
  private settled: boolean;

  /** @internal */
  constructor(params: {
    session: SessionCreateResponse;
    baseUrl: string;
    locale: string;
    fetchImpl: typeof globalThis.fetch;
    applicationId: string;
  }) {
    this.sessionId = params.session.session_id;
    this.availableMethods = params.session.available_methods;
    this.preferredMethod = params.session.preferred_method;
    this.expiresAt = params.session.expires_at;
    this.selectedMethod = params.session.preferred_method;
    this.baseUrl = params.baseUrl;
    this.locale = params.locale;
    this.fetchImpl = params.fetchImpl;
    this.applicationId = params.applicationId;
    this.abortController = new AbortController();
    this.listeners = {
      approved: new Set<SessionHandleListener<'approved'>>(),
      denied: new Set<SessionHandleListener<'denied'>>(),
      needs_review: new Set<SessionHandleListener<'needs_review'>>(),
      error: new Set<SessionHandleListener<'error'>>(),
    };
    this.settled = false;
  }

  /**
   * Switch the active verification method. Must be one of
   * {@link availableMethods}.
   *
   * @throws {InvalidRequestError} when method is not in availableMethods.
   */
  selectMethod(method: VerificationMethod): void {
    if (!this.availableMethods.includes(method)) {
      throw new InvalidRequestError(
        `Method "${method}" not in available_methods`,
      );
    }
    this.selectedMethod = method;
  }

  /**
   * The currently selected verification method.
   */
  get method(): VerificationMethod {
    return this.selectedMethod;
  }

  /**
   * Subscribe to a session lifecycle event.
   *
   * Returns an unsubscribe function. Events are emitted at most once per
   * `complete*` call — the SDK does not retry on its own.
   */
  on<E extends SessionHandleEventName>(
    event: E,
    listener: SessionHandleListener<E>,
  ): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  /**
   * Cancel any in-flight network requests originated by this session.
   * Safe to call multiple times.
   */
  cancel(): void {
    this.abortController.abort();
  }

  /**
   * Complete the session via the `fallback` adapter — assisted self-declaration
   * with optional captcha/risk signals. Assurance level: `low`.
   */
  async completeFallback(
    input: FallbackCompleteInput,
  ): Promise<SessionCompleteResponse> {
    const signals: { captcha_token?: string; device_fingerprint?: string } = {};
    if (input.captchaToken !== undefined) {
      signals.captcha_token = input.captchaToken;
    }
    if (input.deviceFingerprint !== undefined) {
      signals.device_fingerprint = input.deviceFingerprint;
    }
    const body: SessionCompleteRequest = {
      method: 'fallback',
      declaration: { age_at_least: input.ageAtLeast, consent: true },
      signals,
    };
    return this.complete(body);
  }

  /**
   * Complete the session via the `vc` adapter — present a W3C Verifiable
   * Credential or SD-JWT-VC issued by a trusted issuer.
   */
  async completeVc(
    input: VcCompleteInput,
  ): Promise<SessionCompleteResponse> {
    const body: SessionCompleteRequest = {
      method: 'vc',
      credential: input.credential,
      format: input.format,
      issuer_did: input.issuerDid,
      ...(input.presentationNonce !== undefined
        ? { presentation_nonce: input.presentationNonce }
        : {}),
    };
    return this.complete(body);
  }

  /**
   * Complete the session via the `zkp` adapter — submit a zero-knowledge
   * proof (e.g. predicate-attestation JWS). Assurance level: `high`.
   */
  async completeZkp(
    input: ZkpCompleteInput,
  ): Promise<SessionCompleteResponse> {
    const body: SessionCompleteRequest = {
      method: 'zkp',
      proof: input.proof,
      proof_format: input.proofFormat ?? 'bls12381-bbs+',
      issuer_did: input.issuerDid,
    };
    return this.complete(body);
  }

  /**
   * Complete the session via the `gateway` adapter — submit a third-party
   * provider attestation (Yoti, Veriff, Onfido, Serpro, Unico, ...).
   */
  async completeGateway(
    input: GatewayCompleteInput,
  ): Promise<SessionCompleteResponse> {
    const body: SessionCompleteRequest = {
      method: 'gateway',
      attestation: input.attestation,
      provider: input.provider,
    };
    return this.complete(body);
  }

  /**
   * Re-fetch the public session view. Useful for polling status while the
   * user finishes an external flow (Wallet, gateway redirect).
   */
  async refresh(): Promise<SessionGetResponse> {
    const url = joinUrl(
      this.baseUrl,
      `/verifications-session-get/${encodeURIComponent(this.sessionId)}`,
    );
    const resp = await this.fetchImpl(url, {
      method: 'GET',
      signal: this.abortController.signal,
      headers: {
        Accept: 'application/json',
        'X-AgeKey-Application-Id': this.applicationId,
        'Accept-Language': this.locale,
      },
    });
    if (!resp.ok) {
      const err = await toAgeKeyError(resp);
      this.emitError(err);
      throw err;
    }
    const json = (await resp.json()) as unknown;
    return SessionGetResponseSchema.parse(json);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async complete(
    body: SessionCompleteRequest,
  ): Promise<SessionCompleteResponse> {
    if (this.settled) {
      throw new SessionAlreadyCompletedError();
    }
    const url = joinUrl(
      this.baseUrl,
      `/verifications-session-complete/${encodeURIComponent(this.sessionId)}`,
    );
    let resp: Response;
    try {
      resp = await this.fetchImpl(url, {
        method: 'POST',
        signal: this.abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-AgeKey-Application-Id': this.applicationId,
          'Accept-Language': this.locale,
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      const err =
        cause instanceof Error
          ? cause
          : new InternalError('Network failure', { cause });
      this.emitError(
        err instanceof AgeKeyError
          ? { error: err, reasonCode: err.reasonCode }
          : { error: err },
      );
      throw err;
    }

    if (!resp.ok) {
      const err = await toAgeKeyError(resp);
      this.emitError({ error: err, reasonCode: err.reasonCode });
      throw err;
    }

    const raw = (await resp.json()) as unknown;
    const parsed = SessionCompleteResponseSchema.parse(raw);
    this.settled = true;
    this.dispatchTerminal(parsed);
    return parsed;
  }

  private emitError(payload: ErrorEvent | Error): void {
    const event: ErrorEvent =
      payload instanceof Error ? { error: payload } : payload;
    for (const cb of this.listeners.error) {
      try {
        cb(event);
      } catch {
        // Listener errors must never propagate.
      }
    }
  }

  private dispatchTerminal(resp: SessionCompleteResponse): void {
    if (resp.decision === 'approved' && resp.token) {
      const event: ApprovedEvent = {
        jwt: resp.token.jwt,
        jti: resp.token.jti,
        expiresAt: resp.token.expires_at,
        kid: resp.token.kid,
        reasonCode: resp.reason_code as ReasonCode,
        method: resp.method,
      };
      for (const cb of this.listeners.approved) {
        try {
          cb(event);
        } catch {
          /* swallow */
        }
      }
      return;
    }
    if (resp.decision === 'denied') {
      const event: DeniedEvent = {
        reasonCode: resp.reason_code as ReasonCode,
        method: resp.method,
      };
      for (const cb of this.listeners.denied) {
        try {
          cb(event);
        } catch {
          /* swallow */
        }
      }
      return;
    }
    if (resp.decision === 'needs_review') {
      const event: NeedsReviewEvent = {
        reasonCode: resp.reason_code as ReasonCode,
        method: resp.method,
      };
      for (const cb of this.listeners.needs_review) {
        try {
          cb(event);
        } catch {
          /* swallow */
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// AgeKeyClient
// -----------------------------------------------------------------------------

/**
 * Browser-safe AgeKey client.
 *
 * Does NOT hold an API key — session creation must happen on the integrating
 * app's server and the resulting {@link SessionCreateResponse} is passed to
 * {@link start}.
 */
export class AgeKeyClient {
  private readonly applicationId: string;
  private readonly baseUrl: string;
  private readonly locale: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  /**
   * @param options See {@link AgeKeyClientOptions}.
   */
  constructor(options: AgeKeyClientOptions) {
    if (!options.applicationId || options.applicationId.length === 0) {
      throw new InvalidRequestError('applicationId is required');
    }
    this.applicationId = options.applicationId;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.locale = options.locale ?? 'pt-BR';
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== 'function') {
      throw new InternalError('No fetch implementation available');
    }
    this.fetchImpl = f.bind(globalThis);
  }

  /**
   * Begin an in-browser verification flow from a server-issued session.
   *
   * The integrating app must call `AgeKeyServer.createSession` (or its own
   * server route) FIRST, then pass the response to this method.
   *
   * @param params.session The {@link SessionCreateResponse} from the server.
   * @returns A {@link SessionHandle} with `complete*`, `selectMethod`, `on`,
   *          `refresh` and `cancel` methods.
   */
  start(params: { session: SessionCreateResponse }): SessionHandle {
    return new SessionHandle({
      session: params.session,
      baseUrl: this.baseUrl,
      locale: this.locale,
      fetchImpl: this.fetchImpl,
      applicationId: this.applicationId,
    });
  }
}
