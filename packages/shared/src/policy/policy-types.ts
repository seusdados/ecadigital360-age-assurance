// Policy types — the in-memory shape of a tenant policy.
//
// Mirrors the columns of `public.policies` (see
// `supabase/migrations/002_policies.sql`). The Core builds a `PolicyDefinition`
// from a Postgres row; the policy engine consumes it without touching the
// database, so it can run inside edge functions, the SDK or the test suite.
//
// Reference: docs/specs/agekey-core-canonical-contracts.md §Policy types.

import { z } from 'zod';
import {
  AssuranceLevelSchema,
  JurisdictionCodeSchema,
  UuidSchema,
  VerificationMethodSchema,
} from '../schemas/common.ts';
import { AgeBandSchema, AgeThresholdSchema } from '../taxonomy/age-taxonomy.ts';

/** Default ordering when a policy does not set an explicit method priority. */
export const DEFAULT_METHOD_PRIORITY = [
  'zkp',
  'vc',
  'gateway',
  'fallback',
] as const;

export const PolicyDefinitionSchema = z
  .object({
    id: UuidSchema,
    /** `null` for global templates. */
    tenant_id: UuidSchema.nullable(),
    slug: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/, {
        message:
          'slug must be kebab-case, alphanumeric on both ends, max 64 chars',
      }),
    name: z.string().min(1).max(255),

    age_threshold: AgeThresholdSchema,
    age_band: AgeBandSchema.nullable(),

    jurisdiction_code: JurisdictionCodeSchema.nullable(),
    method_priority: z
      .array(VerificationMethodSchema)
      .min(1, { message: 'method_priority must contain at least one method' }),
    required_assurance_level: AssuranceLevelSchema,

    /** Result-token TTL. Mirrors `policies.token_ttl_seconds`. */
    token_ttl_seconds: z.number().int().positive(),

    /** Monotonic version counter; bumped by the audit trigger. */
    current_version: z.number().int().positive(),

    is_template: z.boolean(),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (policy.is_template && policy.tenant_id != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'global templates must have tenant_id = null',
        path: ['tenant_id'],
      });
    }
    if (!policy.is_template && policy.tenant_id == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'tenant policies must have tenant_id set',
        path: ['tenant_id'],
      });
    }
  });

export type PolicyDefinition = z.infer<typeof PolicyDefinitionSchema>;
