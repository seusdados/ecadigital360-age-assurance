// Schemas Zod e tipos públicos do AgeKey Consent (Rodada 3).
//
// Toda resposta pública deste módulo passa pelo Privacy Guard com
// perfil `webhook` ou `public_api_response`. PII do responsável
// (e-mail, telefone, nome) NUNCA aparece em payload público — só em
// `guardian_contacts` server-side, cifrado em Vault.
//
// Documentação: docs/modules/parental-consent/

import { z } from 'zod';
import { UuidSchema } from './common.ts';

// ============================================================
// ENUMS
// ============================================================

export const ParentalConsentStatusSchema = z.enum([
  'pending',
  'awaiting_guardian',
  'awaiting_verification',
  'awaiting_confirmation',
  'approved',
  'denied',
  'expired',
  'revoked',
]);
export type ParentalConsentStatus = z.infer<
  typeof ParentalConsentStatusSchema
>;

export const GuardianContactChannelSchema = z.enum(['email', 'phone']);
export type GuardianContactChannel = z.infer<
  typeof GuardianContactChannelSchema
>;

export const ParentalConsentAssuranceLevelSchema = z.enum([
  'AAL-C0',
  'AAL-C1',
  'AAL-C2',
  'AAL-C3',
  'AAL-C4',
]);
export type ParentalConsentAssuranceLevelDB = z.infer<
  typeof ParentalConsentAssuranceLevelSchema
>;

// ============================================================
// POST /v1/parental-consent/session
// Cria solicitação de consentimento. Não envia OTP ainda.
// ============================================================

export const ParentalConsentSessionCreateRequestSchema = z
  .object({
    application_slug: z.string().min(1).max(64).optional(),
    policy_slug: z.string().min(1).max(64),
    resource: z.string().min(1).max(255),
    purpose_codes: z.array(z.string().min(1).max(64)).min(1).max(32),
    data_categories: z.array(z.string().min(1).max(64)).min(1).max(32),
    locale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .default('pt-BR'),
    /**
     * Referência opaca da criança/adolescente (HMAC ou UUID gerado pelo
     * tenant). NUNCA conter PII direta — o guard rejeita.
     */
    child_ref_hmac: z.string().min(8).max(128),
    /**
     * URL para onde o responsável é redirecionado após aprovar/negar.
     * Construída pelo tenant.
     */
    redirect_url: z.string().url().optional(),
    /**
     * Texto de consentimento referenciado por hash. Versionado.
     * Quando `consent_text_version_id` não é passado, o servidor seleciona
     * a versão ativa mais recente para o par (policy, locale).
     */
    consent_text_version_id: UuidSchema.optional(),
  })
  .strict();
export type ParentalConsentSessionCreateRequest = z.infer<
  typeof ParentalConsentSessionCreateRequestSchema
>;

export const ParentalConsentSessionCreateResponseSchema = z.object({
  consent_request_id: UuidSchema,
  status: ParentalConsentStatusSchema,
  expires_at: z.string().datetime(),
  /**
   * URL pública para o painel parental. Carrega token curto e escopado.
   */
  guardian_panel_url: z.string().url(),
  /**
   * Token curto e escopado para o painel parental. Distinto do
   * `parental_consent_token` (que é emitido só após aprovação).
   */
  guardian_panel_token: z.string().min(16),
  policy: z.object({
    id: UuidSchema,
    slug: z.string(),
    version: z.number().int().positive(),
    age_threshold: z.number().int().positive(),
  }),
  consent_text: z.object({
    id: UuidSchema,
    locale: z.string(),
    text_hash: z.string().min(16),
  }),
});
export type ParentalConsentSessionCreateResponse = z.infer<
  typeof ParentalConsentSessionCreateResponseSchema
>;

// ============================================================
// POST /v1/parental-consent/:id/guardian/start
// Registra contato do responsável + envia OTP.
// ============================================================

export const ParentalGuardianStartRequestSchema = z
  .object({
    /**
     * Token do painel parental obtido em /session.
     */
    guardian_panel_token: z.string().min(16),
    /**
     * Canal do contato. Valor cifrado server-side em Vault.
     */
    contact_channel: GuardianContactChannelSchema,
    /**
     * Valor do contato (e-mail ou telefone E.164).
     * NUNCA aparece em token nem webhook. É descartado da resposta após
     * cifragem; o cliente recebe apenas um identificador opaco.
     */
    contact_value: z.string().min(3).max(254),
  })
  .strict();
export type ParentalGuardianStartRequest = z.infer<
  typeof ParentalGuardianStartRequestSchema
>;

export const ParentalGuardianStartResponseSchema = z.object({
  consent_request_id: UuidSchema,
  guardian_verification_id: UuidSchema,
  contact_channel: GuardianContactChannelSchema,
  /**
   * Mascarado para display (ex.: "r***@example.com" ou "+55 (11) 9****-1234").
   * Sem PII real.
   */
  contact_masked: z.string().min(3).max(64),
  otp_expires_at: z.string().datetime(),
  /**
   * Em ambiente dev (`AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true`),
   * o OTP cleartext é retornado para teste. Em prod, sempre `null`.
   */
  dev_otp: z.string().min(4).max(8).nullable(),
  status: ParentalConsentStatusSchema,
});
export type ParentalGuardianStartResponse = z.infer<
  typeof ParentalGuardianStartResponseSchema
>;

// ============================================================
// POST /v1/parental-consent/:id/confirm
// Verifica OTP + registra decisão do responsável (approve/deny).
// Quando approve, emite parental_consent_token assinado.
// ============================================================

export const ParentalConsentConfirmRequestSchema = z
  .object({
    guardian_panel_token: z.string().min(16),
    otp: z.string().min(4).max(8),
    /**
     * Decisão do responsável.
     */
    decision: z.enum(['approve', 'deny']),
    /**
     * Texto exibido (referenciado pelo seu hash) — força o cliente a
     * confirmar que viu a versão correta.
     */
    consent_text_version_id: UuidSchema,
  })
  .strict();
export type ParentalConsentConfirmRequest = z.infer<
  typeof ParentalConsentConfirmRequestSchema
>;

export const ParentalConsentConfirmResponseSchema = z.object({
  consent_request_id: UuidSchema,
  parental_consent_id: UuidSchema.nullable(),
  status: ParentalConsentStatusSchema,
  decision: z.enum(['approved', 'denied']),
  reason_code: z.string(),
  /**
   * Token de consentimento — só presente quando `decision === 'approved'`.
   * Mesmo formato do `result_token` do Core: ES256, JWKS comum,
   * minimizado.
   */
  token: z
    .object({
      jwt: z.string(),
      jti: UuidSchema,
      expires_at: z.string().datetime(),
      kid: z.string(),
    })
    .nullable(),
});
export type ParentalConsentConfirmResponse = z.infer<
  typeof ParentalConsentConfirmResponseSchema
>;

// ============================================================
// GET /v1/parental-consent/session/:consent_request_id
// Visão pública da solicitação. Sem PII.
// ============================================================

export const ParentalConsentSessionGetResponseSchema = z.object({
  consent_request_id: UuidSchema,
  status: ParentalConsentStatusSchema,
  resource: z.string(),
  purpose_codes: z.array(z.string()),
  data_categories: z.array(z.string()),
  policy: z.object({
    id: UuidSchema,
    slug: z.string(),
    version: z.number().int().positive(),
    age_threshold: z.number().int().positive(),
  }),
  consent_text: z.object({
    id: UuidSchema,
    locale: z.string(),
    text_hash: z.string().min(16),
  }),
  expires_at: z.string().datetime(),
  decided_at: z.string().datetime().nullable(),
  reason_code: z.string().nullable(),
});
export type ParentalConsentSessionGetResponse = z.infer<
  typeof ParentalConsentSessionGetResponseSchema
>;

// ============================================================
// GET /v1/parental-consent/:consent_request_id/text
// Texto integral do consent_text_version associado à request.
// Auth exclusivamente via guardian_panel_token (público).
// ============================================================

export const ParentalConsentTextResponseSchema = z
  .object({
    id: UuidSchema,
    locale: z.string(),
    text_hash: z.string(),
    text_body: z.string(),
    content_type: z.literal('text/plain'),
  })
  .strict();
export type ParentalConsentTextResponse = z.infer<
  typeof ParentalConsentTextResponseSchema
>;

// ============================================================
// POST /v1/parental-consent/:consent_token_id/revoke
// Revoga o consentimento e o token.
// ============================================================

export const ParentalConsentRevokeRequestSchema = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .strict();
export type ParentalConsentRevokeRequest = z.infer<
  typeof ParentalConsentRevokeRequestSchema
>;

export const ParentalConsentRevokeResponseSchema = z.object({
  parental_consent_id: UuidSchema,
  revoked_at: z.string().datetime(),
  reason_code: z.literal('CONSENT_REVOKED'),
});
export type ParentalConsentRevokeResponse = z.infer<
  typeof ParentalConsentRevokeResponseSchema
>;

// ============================================================
// POST /v1/parental-consent/token/verify
// Validação online do parental_consent_token.
// ============================================================

export const ParentalConsentTokenVerifyRequestSchema = z
  .object({
    token: z.string().min(1),
    expected_audience: z.string().optional(),
  })
  .strict();
export type ParentalConsentTokenVerifyRequest = z.infer<
  typeof ParentalConsentTokenVerifyRequestSchema
>;

export const ParentalConsentTokenVerifyResponseSchema = z.object({
  valid: z.boolean(),
  reason_code: z.string().optional(),
  revoked: z.boolean(),
  /**
   * Claims minimizados, equivalente em forma ao `result_token` mas com
   * `decision_domain: 'parental_consent'`.
   */
  claims: z
    .object({
      iss: z.string().url(),
      aud: z.string(),
      jti: UuidSchema,
      iat: z.number().int(),
      nbf: z.number().int(),
      exp: z.number().int(),
      agekey: z.object({
        decision: z.literal('approved'),
        decision_domain: z.literal('parental_consent'),
        decision_id: UuidSchema.optional(),
        reason_code: z.string(),
        policy: z.object({
          id: UuidSchema,
          slug: z.string(),
          version: z.number().int().positive(),
        }),
        tenant_id: UuidSchema,
        application_id: UuidSchema,
        purpose_codes: z.array(z.string()),
        data_categories: z.array(z.string()),
        consent_text_version_id: UuidSchema,
      }),
    })
    .optional(),
});
export type ParentalConsentTokenVerifyResponse = z.infer<
  typeof ParentalConsentTokenVerifyResponseSchema
>;

// ============================================================
// PARENTAL CONSENT TOKEN CLAIMS (formato canônico)
// ============================================================

export const ParentalConsentTokenClaimsSchema = z.object({
  iss: z.string().url(),
  aud: z.string().min(1),
  jti: UuidSchema,
  iat: z.number().int(),
  nbf: z.number().int(),
  exp: z.number().int(),
  agekey: z.object({
    decision: z.literal('approved'),
    decision_domain: z.literal('parental_consent'),
    decision_id: UuidSchema,
    reason_code: z.string().min(1),
    policy: z.object({
      id: UuidSchema,
      slug: z.string().min(1),
      version: z.number().int().positive(),
    }),
    tenant_id: UuidSchema,
    application_id: UuidSchema,
    purpose_codes: z.array(z.string().min(1).max(64)).min(1).max(32),
    data_categories: z.array(z.string().min(1).max(64)).min(1).max(32),
    consent_text_version_id: UuidSchema,
    consent_assurance_level: ParentalConsentAssuranceLevelSchema,
  }),
});
export type ParentalConsentTokenClaims = z.infer<
  typeof ParentalConsentTokenClaimsSchema
>;

// ============================================================
// LIST (Admin)
// ============================================================

export const ParentalConsentListQuerySchema = z
  .object({
    status: ParentalConsentStatusSchema.optional(),
    application_id: UuidSchema.optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    cursor: UuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type ParentalConsentListQuery = z.infer<
  typeof ParentalConsentListQuerySchema
>;

export const ParentalConsentListItemSchema = z.object({
  consent_request_id: UuidSchema,
  status: ParentalConsentStatusSchema,
  resource: z.string(),
  policy: z.object({
    id: UuidSchema,
    slug: z.string(),
    version: z.number().int().positive(),
  }),
  application: z.object({
    id: UuidSchema,
    slug: z.string(),
  }),
  /** Hash opaco da criança — nunca PII direta. */
  child_ref_hmac: z.string(),
  decided_at: z.string().datetime().nullable(),
  reason_code: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type ParentalConsentListItem = z.infer<
  typeof ParentalConsentListItemSchema
>;

export const ParentalConsentListResponseSchema = z.object({
  items: z.array(ParentalConsentListItemSchema),
  next_cursor: UuidSchema.nullable(),
  has_more: z.boolean(),
});
export type ParentalConsentListResponse = z.infer<
  typeof ParentalConsentListResponseSchema
>;
