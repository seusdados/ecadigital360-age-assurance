import { z } from 'zod';

export const AgeKeyForbiddenPublicClaimKeys = [
  'birthdate',
  'date_of_birth',
  'dob',
  'idade',
  'age',
  'exact_age',
  'document',
  'cpf',
  'rg',
  'passport',
  'name',
  'full_name',
  'email',
  'phone',
  'selfie',
  'face',
  'raw_id',
  'address',
] as const;

export const AgeKeyDecisionSchema = z.enum(['approved', 'denied', 'needs_review']);
export const AgeKeyMethodSchema = z.enum(['zkp', 'vc', 'gateway', 'fallback']);
export const AgeKeyAssuranceSchema = z.enum(['low', 'substantial', 'high']);

export const AgeKeyTokenPublicClaimsSchema = z.object({
  iss: z.string().url(),
  aud: z.string().min(1),
  sub: z.string().min(1).optional(),
  jti: z.string().uuid(),
  iat: z.number().int(),
  nbf: z.number().int(),
  exp: z.number().int(),
  agekey: z.object({
    decision: AgeKeyDecisionSchema,
    threshold_satisfied: z.boolean(),
    age_threshold: z.number().int().positive(),
    method: AgeKeyMethodSchema,
    assurance_level: AgeKeyAssuranceSchema,
    reason_code: z.string().min(1),
    policy: z.object({
      id: z.string().uuid(),
      slug: z.string().min(1),
      version: z.number().int().positive(),
    }),
    tenant_id: z.string().uuid(),
    application_id: z.string().uuid(),
  }),
});

export type AgeKeyTokenPublicClaims = z.infer<
  typeof AgeKeyTokenPublicClaimsSchema
>;
