// =============================================================================
// @agekey/sdk-js — Safety Signals helpers
// =============================================================================
//
// Stubs honestos para apps cliente (browser ou React Native) chamarem
// AgeKey Safety. **Nada deste módulo envia conteúdo bruto ao servidor**:
//
//   - `agekey.safety.trackEvent(...)` — envia metadata-only.
//   - `agekey.safety.getDecision(...)` — pre-flight read-only.
//   - `beforeSendMessage(metadata)` — recebe metadata da mensagem (tipo,
//     comprimento, recipient, has_external_url) e retorna decisão.
//     **Nunca recebe o texto.**
//   - `beforeUploadMedia(metadata)` — idem para mídia.
//
// O endpoint de upload da app cliente fica responsável por respeitar a
// decisão (allow / soft_block / hard_block / step_up_required).
//
// IMPORTANT: API key tenant fica server-side. Estes helpers chamam um
// endpoint proxy do app cliente, não diretamente o AgeKey. O proxy é
// configurado via `safetyEndpointBase` (URL do app cliente) que repassa
// para o AgeKey adicionando `X-AgeKey-API-Key`.

export type SafetyEventType =
  | 'message_sent'
  | 'message_received'
  | 'media_upload'
  | 'external_link_shared'
  | 'profile_view'
  | 'follow_request'
  | 'report_filed'
  | 'private_chat_started';

export type SafetySubjectAgeState =
  | 'minor'
  | 'teen'
  | 'adult'
  | 'unknown'
  | 'eligible_under_policy'
  | 'not_eligible_under_policy'
  | 'blocked_under_policy';

export type SafetyDecision =
  | 'no_risk_signal'
  | 'logged'
  | 'soft_blocked'
  | 'hard_blocked'
  | 'step_up_required'
  | 'parental_consent_required'
  | 'needs_review';

export type SafetyShortDecision =
  | 'no_risk_signal'
  | 'soft_blocked'
  | 'hard_blocked'
  | 'step_up_required'
  | 'parental_consent_required';

export interface TrackEventInput {
  eventType: SafetyEventType;
  actorSubjectRefHmac: string;
  counterpartySubjectRefHmac?: string;
  actorAgeState?: SafetySubjectAgeState;
  counterpartyAgeState?: SafetySubjectAgeState;
  /**
   * Metadata SEM conteúdo. Permitido: tamanho, tipo, has_external_url,
   * has_media, mime_type, duration_seconds, width, height, count,
   * timestamps, language_hint.
   * NUNCA incluir: message, raw_text, image, video, audio, birthdate,
   * email, phone, name, document.
   */
  metadata?: Record<string, unknown>;
  /** Hash SHA-256 hex computado client-side. Opcional. */
  contentHash?: string;
  locale?: string;
  occurredAt?: string;
}

export interface TrackEventResult {
  eventId: string;
  decision: SafetyDecision;
  reasonCodes: string[];
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  alertId: string | null;
  stepUpSessionId: string | null;
}

export interface GetDecisionInput {
  eventType: SafetyEventType;
  actorSubjectRefHmac: string;
  counterpartySubjectRefHmac?: string;
  actorAgeState?: SafetySubjectAgeState;
  counterpartyAgeState?: SafetySubjectAgeState;
}

export interface GetDecisionResult {
  decision: SafetyShortDecision;
  reasonCodes: string[];
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  riskCategory: string;
  actions: string[];
  stepUpRequired: boolean;
  parentalConsentRequired: boolean;
}

export interface SafetyClientOptions {
  /**
   * URL do proxy do app cliente que repassa para AgeKey adicionando
   * X-AgeKey-API-Key. Ex.: 'https://app.example.com/api/agekey'.
   */
  safetyEndpointBase: string;
  fetch?: typeof globalThis.fetch;
}

const FORBIDDEN_METADATA_KEYS = new Set<string>([
  'message',
  'raw_text',
  'message_body',
  'image',
  'image_data',
  'video',
  'video_data',
  'audio',
  'audio_data',
  'birthdate',
  'date_of_birth',
  'dob',
  'age',
  'exact_age',
  'name',
  'full_name',
  'civil_name',
  'cpf',
  'rg',
  'passport',
  'document',
  'email',
  'phone',
  'selfie',
  'face',
  'biometric',
  'address',
  'ip',
  'gps',
  'latitude',
  'longitude',
]);

function assertMetadataSafe(metadata: Record<string, unknown> | undefined): void {
  if (!metadata) return;
  function visit(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${path}[${i}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const norm = key.toLowerCase().replace(/-/g, '_');
      if (FORBIDDEN_METADATA_KEYS.has(norm)) {
        throw new Error(
          `AgeKey Safety: metadata key "${path}.${key}" is forbidden in v1 (metadata-only).`,
        );
      }
      visit(child, `${path}.${key}`);
    }
  }
  visit(metadata, '$');
}

export class AgeKeySafetyClient {
  private readonly base: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(opts: SafetyClientOptions) {
    if (!opts.safetyEndpointBase) {
      throw new Error('safetyEndpointBase is required');
    }
    this.base = opts.safetyEndpointBase.replace(/\/+$/, '');
    const f = opts.fetch ?? globalThis.fetch;
    if (typeof f !== 'function') throw new Error('No fetch implementation');
    this.fetchImpl = f.bind(globalThis);
  }

  /**
   * Track an event. Sends metadata only; never content.
   *
   * The proxy URL `${base}/safety-event-ingest` receives the body and
   * relays to AgeKey adding the tenant's API key.
   */
  async trackEvent(input: TrackEventInput): Promise<TrackEventResult> {
    assertMetadataSafe(input.metadata);

    const body = {
      event_type: input.eventType,
      actor_subject_ref_hmac: input.actorSubjectRefHmac,
      ...(input.counterpartySubjectRefHmac
        ? { counterparty_subject_ref_hmac: input.counterpartySubjectRefHmac }
        : {}),
      ...(input.actorAgeState ? { actor_age_state: input.actorAgeState } : {}),
      ...(input.counterpartyAgeState
        ? { counterparty_age_state: input.counterpartyAgeState }
        : {}),
      metadata: input.metadata ?? {},
      ...(input.contentHash ? { content_hash: input.contentHash } : {}),
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.occurredAt ? { occurred_at: input.occurredAt } : {}),
    };

    const resp = await this.fetchImpl(`${this.base}/safety-event-ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`AgeKey Safety trackEvent failed: ${resp.status} ${text}`);
    }
    const data = (await resp.json()) as {
      event_id: string;
      decision: SafetyDecision;
      reason_codes: string[];
      severity: TrackEventResult['severity'];
      alert_id: string | null;
      step_up_session_id: string | null;
    };
    return {
      eventId: data.event_id,
      decision: data.decision,
      reasonCodes: data.reason_codes,
      severity: data.severity,
      alertId: data.alert_id,
      stepUpSessionId: data.step_up_session_id,
    };
  }

  async getDecision(input: GetDecisionInput): Promise<GetDecisionResult> {
    const body = {
      event_type: input.eventType,
      actor_subject_ref_hmac: input.actorSubjectRefHmac,
      ...(input.counterpartySubjectRefHmac
        ? { counterparty_subject_ref_hmac: input.counterpartySubjectRefHmac }
        : {}),
      ...(input.actorAgeState ? { actor_age_state: input.actorAgeState } : {}),
      ...(input.counterpartyAgeState
        ? { counterparty_age_state: input.counterpartyAgeState }
        : {}),
    };
    const resp = await this.fetchImpl(`${this.base}/safety-rule-evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`AgeKey Safety getDecision failed: ${resp.status} ${text}`);
    }
    const data = (await resp.json()) as {
      decision: SafetyShortDecision;
      reason_codes: string[];
      severity: GetDecisionResult['severity'];
      risk_category: string;
      actions: string[];
      step_up_required: boolean;
      parental_consent_required: boolean;
    };
    return {
      decision: data.decision,
      reasonCodes: data.reason_codes,
      severity: data.severity,
      riskCategory: data.risk_category,
      actions: data.actions,
      stepUpRequired: data.step_up_required,
      parentalConsentRequired: data.parental_consent_required,
    };
  }

  // ====================================================================
  // Stubs honestos (V2/V3) — delegam para getDecision com metadata
  // explícita. NÃO recebem texto, imagem, vídeo ou áudio.
  // ====================================================================

  /**
   * Hook para chamar ANTES de enviar uma mensagem. **Nunca passa o
   * texto da mensagem.** O caller informa apenas:
   *  - destinatário (subject_ref_hmac);
   *  - estado etário do destinatário (se conhecido);
   *  - se a mensagem contém link externo (boolean);
   *  - locale.
   *
   * Devolve a decisão (allow / soft_block / step_up). O caller é
   * responsável por respeitá-la.
   */
  async beforeSendMessage(input: {
    senderSubjectRefHmac: string;
    senderAgeState?: SafetySubjectAgeState;
    recipientSubjectRefHmac: string;
    recipientAgeState?: SafetySubjectAgeState;
    hasExternalLink?: boolean;
    locale?: string;
  }): Promise<GetDecisionResult> {
    return this.getDecision({
      eventType: input.hasExternalLink
        ? 'external_link_shared'
        : 'message_sent',
      actorSubjectRefHmac: input.senderSubjectRefHmac,
      counterpartySubjectRefHmac: input.recipientSubjectRefHmac,
      ...(input.senderAgeState ? { actorAgeState: input.senderAgeState } : {}),
      ...(input.recipientAgeState
        ? { counterpartyAgeState: input.recipientAgeState }
        : {}),
    });
  }

  /**
   * Hook para chamar ANTES de fazer upload de mídia. **Nunca recebe os
   * bytes.** Caller informa apenas mime_type, size_bytes e o
   * destinatário.
   */
  async beforeUploadMedia(input: {
    senderSubjectRefHmac: string;
    senderAgeState?: SafetySubjectAgeState;
    recipientSubjectRefHmac: string;
    recipientAgeState?: SafetySubjectAgeState;
    mimeType?: string;
    sizeBytes?: number;
    locale?: string;
  }): Promise<GetDecisionResult> {
    return this.getDecision({
      eventType: 'media_upload',
      actorSubjectRefHmac: input.senderSubjectRefHmac,
      counterpartySubjectRefHmac: input.recipientSubjectRefHmac,
      ...(input.senderAgeState ? { actorAgeState: input.senderAgeState } : {}),
      ...(input.recipientAgeState
        ? { counterpartyAgeState: input.recipientAgeState }
        : {}),
    });
  }
}
