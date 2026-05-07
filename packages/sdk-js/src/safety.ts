// =============================================================================
// @agekey/sdk-js/safety — Safety Signals helper (server-side)
// =============================================================================
//
// MVP wrapper around the Safety Signals ingest endpoint. The SDK does NOT
// process content — it accepts only the same metadata shape declared by
// `SafetyEventIngestRequestSchema` in `@agekey/shared`. Calling
// `beforeSendMessage` / `beforeUploadMedia` with raw content throws at
// runtime so the integrator is forced to keep the content in their own
// data plane.
//
// The honest stubs make the v1 contract explicit:
//   * `trackEvent(event)`    — sends the metadata to the AgeKey ingest API.
//   * `getDecision(eventId)` — convenience read-back (P3, not implemented).
//   * `beforeSendMessage()`  — refuses if `text/body/message` is provided.
//   * `beforeUploadMedia()`  — refuses if `bytes/blob/file` is provided.
//
// Any future content-aware analysis must ship behind a new feature flag and
// a coordinated round.

import {
  REASON_CODES,
  type SafetyEventIngestRequest,
  type SafetyEventIngestResponse,
} from '@agekey/shared';

const DEFAULT_BASE_URL = 'https://staging.agekey.com.br/v1';

export interface SafetyClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export interface BeforeSendInput {
  /** Same opaque ref the relying party uses for the actor. */
  actor_external_ref: string;
  /** Optional opaque ref for the counterparty. */
  counterparty_external_ref?: string;
  /** Bounded metadata. PII and content are rejected. */
  metadata?: Record<string, string | number | boolean | null>;
}

export class AgeKeySafetyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: SafetyClientOptions) {
    if (!options.apiKey) throw new Error('apiKey is required');
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== 'function') {
      throw new Error('No fetch implementation available');
    }
    this.fetchImpl = f.bind(globalThis);
  }

  /**
   * Send a metadata-only safety event. The server applies the canonical
   * privacy guard; any forbidden key returns a 400 with reason
   * `SAFETY_RAW_CONTENT_REJECTED` or `SAFETY_PII_DETECTED`.
   */
  async trackEvent(
    event: SafetyEventIngestRequest,
  ): Promise<SafetyEventIngestResponse> {
    const res = await this.fetchImpl(`${this.baseUrl}/safety/event-ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgeKey-API-Key': this.apiKey,
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`safety ingest failed: ${res.status} ${body}`);
    }
    return (await res.json()) as SafetyEventIngestResponse;
  }

  /**
   * Lookup helper. **Not implemented in MVP** — returns a 501-style
   * indication so integrators don't depend on a missing surface.
   */
  async getDecision(
    _safetyEventId: string,
  ): Promise<{ implemented: false; reason_code: string }> {
    return {
      implemented: false,
      reason_code: REASON_CODES.SAFETY_OK,
    };
  }

  /**
   * Pre-send guard for messages. **Stub** — Safety v1 is metadata-only and
   * the `text` argument is **rejected** to make this contract explicit.
   * Use `trackEvent({ event_type: 'message_send_attempt', ... })` instead.
   */
  async beforeSendMessage(input: BeforeSendInput & { text?: never }): Promise<{
    decision: 'approved';
    reason_code: string;
    note: string;
  }> {
    if ((input as unknown as Record<string, unknown>).text != null) {
      throw new Error(
        'beforeSendMessage refuses raw text in Safety v1 (metadata-only). ' +
          'Use trackEvent with metadata-only fields.',
      );
    }
    return {
      decision: 'approved',
      reason_code: REASON_CODES.SAFETY_OK,
      note: 'Safety v1 is metadata-only — call trackEvent instead.',
    };
  }

  /**
   * Pre-upload guard for media. **Stub** — Safety v1 does not analyse
   * media bytes. Provide an `artifact_hash` in trackEvent for the
   * tamper-evidence anchor and keep the bytes on your side.
   */
  async beforeUploadMedia(
    input: BeforeSendInput & { bytes?: never; blob?: never; file?: never },
  ): Promise<{ decision: 'approved'; reason_code: string; note: string }> {
    for (const k of ['bytes', 'blob', 'file']) {
      if ((input as unknown as Record<string, unknown>)[k] != null) {
        throw new Error(
          `beforeUploadMedia refuses raw ${k} in Safety v1 (metadata-only).`,
        );
      }
    }
    return {
      decision: 'approved',
      reason_code: REASON_CODES.SAFETY_OK,
      note: 'Safety v1 does not analyse media bytes. Pass artifact_hash in trackEvent.',
    };
  }
}
