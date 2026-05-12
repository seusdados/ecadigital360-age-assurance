// =============================================================================
// @agekey/sdk-js — OneClick Client (PREVIEW / EXPERIMENTAL)
// =============================================================================
//
// This module ships **contract-ready** types and a thin client that does NOT
// promise operational OneClick endpoints. Until the orchestrator edge
// functions land (next PR, depends on PR #88 merging), every call here will
// short-circuit to `OneclickEndpointUnavailableError` unless explicitly
// configured against a base URL that already exposes the OneClick endpoints.
//
// **Do NOT use in production.** Surface marked `@experimental`. See
// docs/specs/agekey-oneclick.md and
// docs/security/agekey-oneclick-no-fake-crypto.md.
//
// =============================================================================

import type {
  OneclickCompleteInput,
  OneclickCompleteResult,
  OneclickStartInput,
  OneclickStartResult,
} from '@agekey/shared';

/**
 * Error returned when a OneClick endpoint is not reachable. The client never
 * fabricates a success — it surfaces this error so callers can degrade
 * gracefully or trigger a fallback path.
 */
export class OneclickEndpointUnavailableError extends Error {
  readonly code: 'endpoint_unavailable';
  readonly status?: number;
  readonly cause?: unknown;

  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message);
    this.name = 'OneclickEndpointUnavailableError';
    this.code = 'endpoint_unavailable';
    if (options?.status !== undefined) this.status = options.status;
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

/**
 * @experimental Constructor options for {@link OneclickClient}.
 *
 * The client requires an explicit `baseUrl` (no production default) so that
 * accidental traffic to unrelated environments is impossible while the
 * orchestrator is still in development.
 */
export interface OneclickClientOptions {
  /** Base URL of the OneClick orchestrator (next-PR feature). REQUIRED. */
  baseUrl: string;
  /** Application slug or UUID identifying the integrating tenant application. */
  applicationId: string;
  /** Optional fetch override. */
  fetch?: typeof globalThis.fetch;
  /** Bearer token provider invoked per request. */
  tokenProvider?: () => Promise<string> | string;
  /** Request timeout in milliseconds (default 15000). */
  timeoutMs?: number;
}

const ONECLICK_PATHS = Object.freeze({
  start: '/agekey-oneclick-start',
  complete: '/agekey-oneclick-complete',
});

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * @experimental OneClick client. PREVIEW only.
 *
 * The client returns {@link OneclickEndpointUnavailableError} when the
 * endpoint is unreachable, returns 404, or the configured `baseUrl` does not
 * advertise the OneClick orchestrator. It NEVER fabricates a success.
 */
export class OneclickClient {
  private readonly baseUrl: string;
  private readonly applicationId: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly tokenProvider?: () => Promise<string> | string;
  private readonly timeoutMs: number;

  /** Stable marker so consumers know this surface is preview. */
  readonly experimental = true as const;

  constructor(options: OneclickClientOptions) {
    if (!options.baseUrl || options.baseUrl.length === 0) {
      throw new OneclickEndpointUnavailableError(
        'OneclickClient requires an explicit baseUrl (no production default).',
      );
    }
    if (!options.applicationId || options.applicationId.length === 0) {
      throw new OneclickEndpointUnavailableError(
        'OneclickClient requires applicationId.',
      );
    }
    this.baseUrl = options.baseUrl;
    this.applicationId = options.applicationId;
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== 'function') {
      throw new OneclickEndpointUnavailableError(
        'No fetch implementation available.',
      );
    }
    this.fetchImpl = f.bind(globalThis);
    if (options.tokenProvider) this.tokenProvider = options.tokenProvider;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  /**
   * @experimental Start a OneClick session.
   *
   * Returns the orchestrator response when reachable, otherwise throws
   * {@link OneclickEndpointUnavailableError}.
   */
  async start(input: OneclickStartInput): Promise<OneclickStartResult> {
    return this.request<OneclickStartResult>(ONECLICK_PATHS.start, input);
  }

  /**
   * @experimental Complete a OneClick session with collected action payloads.
   *
   * Returns the orchestrator response when reachable, otherwise throws
   * {@link OneclickEndpointUnavailableError}.
   */
  async complete(
    input: OneclickCompleteInput,
  ): Promise<OneclickCompleteResult> {
    return this.request<OneclickCompleteResult>(ONECLICK_PATHS.complete, input);
  }

  private async request<R>(path: string, body: unknown): Promise<R> {
    const url = joinUrl(this.baseUrl, path);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-AgeKey-Application-Id': this.applicationId,
    };
    if (this.tokenProvider) {
      const token = await this.tokenProvider();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    let resp: Response;
    try {
      resp = await this.fetchImpl(url, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new OneclickEndpointUnavailableError(
        `OneClick request to ${url} failed at the transport layer.`,
        { cause },
      );
    } finally {
      clearTimeout(timeout);
    }
    if (resp.status === 404) {
      throw new OneclickEndpointUnavailableError(
        `OneClick endpoint not found at ${url}. Orchestrator likely not deployed.`,
        { status: 404 },
      );
    }
    if (!resp.ok) {
      throw new OneclickEndpointUnavailableError(
        `OneClick endpoint at ${url} returned HTTP ${resp.status}.`,
        { status: resp.status },
      );
    }
    return (await resp.json()) as R;
  }
}
