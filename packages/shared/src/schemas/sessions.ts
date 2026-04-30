import { z } from 'zod';
import {
  AssuranceLevelSchema,
  ClientCapabilitiesSchema,
  LocaleSchema,
  SessionStatusSchema,
  UuidSchema,
  VerificationDecisionSchema,
  VerificationMethodSchema,
} from './common.ts';

// POST /v1/verifications/session  — corpo de criação
export const SessionCreateRequestSchema = z
  .object({
    application_slug: z.string().min(1).max(64).optional(),
    policy_slug: z.string().min(1).max(64),
    external_user_ref: z.string().max(255).optional(),
    locale: LocaleSchema.optional(),
    redirect_url: z.string().url().optional(),
    cancel_url: z.string().url().optional(),
    client_capabilities: ClientCapabilitiesSchema.optional(),
  })
  .strict();
export type SessionCreateRequest = z.infer<typeof SessionCreateRequestSchema>;

// Resposta de criação. NUNCA inclui PII.
export const SessionCreateResponseSchema = z.object({
  session_id: UuidSchema,
  status: SessionStatusSchema,
  expires_at: z.string().datetime(),
  challenge: z.object({
    nonce: z.string(),
    expires_at: z.string().datetime(),
  }),
  available_methods: z.array(VerificationMethodSchema),
  preferred_method: VerificationMethodSchema,
  policy: z.object({
    id: UuidSchema,
    slug: z.string(),
    age_threshold: z.number().int().positive(),
    required_assurance_level: AssuranceLevelSchema,
  }),
  widget_url: z.string().url().optional(),
});
export type SessionCreateResponse = z.infer<typeof SessionCreateResponseSchema>;

// POST /v1/verifications/session/:id/complete
// O corpo varia conforme o adapter; o discriminator é `method`.
const ZkpCompletePayload = z.object({
  method: z.literal('zkp'),
  proof: z.string().min(1),
  proof_format: z.string().default('bls12381-bbs+'),
  issuer_did: z.string().min(1),
});
const VcCompletePayload = z.object({
  method: z.literal('vc'),
  credential: z.string().min(1),
  format: z.enum(['w3c_vc', 'sd_jwt_vc']),
  issuer_did: z.string().min(1),
  presentation_nonce: z.string().min(1).optional(),
});
const GatewayCompletePayload = z.object({
  method: z.literal('gateway'),
  attestation: z.string().min(1),
  provider: z.string().min(1),
});
const FallbackCompletePayload = z.object({
  method: z.literal('fallback'),
  declaration: z.object({
    age_at_least: z.number().int().positive(),
    consent: z.literal(true),
  }),
  signals: z
    .object({
      captcha_token: z.string().optional(),
      device_fingerprint: z.string().optional(),
    })
    .strict()
    .default({}),
});

export const SessionCompleteRequestSchema = z.discriminatedUnion('method', [
  ZkpCompletePayload,
  VcCompletePayload,
  GatewayCompletePayload,
  FallbackCompletePayload,
]);
export type SessionCompleteRequest = z.infer<
  typeof SessionCompleteRequestSchema
>;

// Resposta de complete: decisão + (se approved) token assinado
export const SessionCompleteResponseSchema = z.object({
  session_id: UuidSchema,
  status: SessionStatusSchema,
  decision: VerificationDecisionSchema,
  reason_code: z.string(),
  method: VerificationMethodSchema,
  assurance_level: AssuranceLevelSchema,
  token: z
    .object({
      jwt: z.string(),
      jti: UuidSchema,
      expires_at: z.string().datetime(),
      kid: z.string(),
    })
    .nullable(),
});
export type SessionCompleteResponse = z.infer<
  typeof SessionCompleteResponseSchema
>;

// GET /v1/verifications/session/:id  — visão pública (sem PII, sem proofs)
export const SessionGetResponseSchema = z.object({
  session_id: UuidSchema,
  status: SessionStatusSchema,
  method: VerificationMethodSchema.nullable(),
  expires_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  decision: VerificationDecisionSchema.nullable(),
  reason_code: z.string().nullable(),
  policy: z.object({
    id: UuidSchema,
    slug: z.string(),
    age_threshold: z.number().int().positive(),
  }),
});
export type SessionGetResponse = z.infer<typeof SessionGetResponseSchema>;
