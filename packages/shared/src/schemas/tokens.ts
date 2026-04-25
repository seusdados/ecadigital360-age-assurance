import { z } from 'zod';
import {
  AssuranceLevelSchema,
  UuidSchema,
  VerificationDecisionSchema,
  VerificationMethodSchema,
} from './common.ts';

// Claims do JWT de resultado emitido pelo AgeKey.
// Assinatura ES256, kid = crypto_keys.kid, iss = "https://agekey.com.br".
export const ResultTokenClaimsSchema = z.object({
  iss: z.string().url(),
  aud: z.string().min(1), // application slug ou domínio do cliente
  sub: z.string().min(1).optional(), // external_user_ref opaco se fornecido
  jti: UuidSchema,
  iat: z.number().int(),
  nbf: z.number().int(),
  exp: z.number().int(),

  // Claims AgeKey (namespace)
  agekey: z.object({
    decision: VerificationDecisionSchema,
    threshold_satisfied: z.boolean(),
    age_threshold: z.number().int().positive(),
    method: VerificationMethodSchema,
    assurance_level: AssuranceLevelSchema,
    reason_code: z.string(),
    policy: z.object({
      id: UuidSchema,
      slug: z.string(),
      version: z.number().int().positive(),
    }),
    tenant_id: UuidSchema,
    application_id: UuidSchema,
  }),
});

export type ResultTokenClaims = z.infer<typeof ResultTokenClaimsSchema>;

// POST /v1/verifications/token/verify
export const TokenVerifyRequestSchema = z
  .object({
    token: z.string().min(1),
    expected_audience: z.string().optional(),
  })
  .strict();
export type TokenVerifyRequest = z.infer<typeof TokenVerifyRequestSchema>;

export const TokenVerifyResponseSchema = z.object({
  valid: z.boolean(),
  reason_code: z.string().optional(),
  claims: ResultTokenClaimsSchema.optional(),
  revoked: z.boolean(),
});
export type TokenVerifyResponse = z.infer<typeof TokenVerifyResponseSchema>;

// POST /v1/verifications/token/revoke
export const TokenRevokeRequestSchema = z
  .object({
    jti: UuidSchema,
    reason: z.string().min(1).max(500),
  })
  .strict();
export type TokenRevokeRequest = z.infer<typeof TokenRevokeRequestSchema>;
