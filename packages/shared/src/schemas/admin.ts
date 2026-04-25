import { z } from 'zod';
import {
  AssuranceLevelSchema,
  JurisdictionCodeSchema,
  SessionStatusSchema,
  UuidSchema,
  VerificationDecisionSchema,
  VerificationMethodSchema,
} from './common.ts';

// ============================================================
// VERIFICATIONS LIST
// GET /v1/verifications-list?status=&decision=&...
// ============================================================
export const VerificationsListQuerySchema = z
  .object({
    status: SessionStatusSchema.optional(),
    decision: VerificationDecisionSchema.optional(),
    method: VerificationMethodSchema.optional(),
    application_id: UuidSchema.optional(),
    policy_id: UuidSchema.optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    cursor: UuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type VerificationsListQuery = z.infer<typeof VerificationsListQuerySchema>;

export const VerificationListItemSchema = z.object({
  session_id: UuidSchema,
  status: SessionStatusSchema,
  method: VerificationMethodSchema.nullable(),
  policy: z.object({
    id: UuidSchema,
    slug: z.string(),
    age_threshold: z.number().int().positive(),
    version: z.number().int().positive(),
  }),
  application: z.object({
    id: UuidSchema,
    slug: z.string(),
  }),
  decision: VerificationDecisionSchema.nullable(),
  reason_code: z.string().nullable(),
  assurance_level: AssuranceLevelSchema.nullable(),
  jti: UuidSchema.nullable(),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
});
export type VerificationListItem = z.infer<typeof VerificationListItemSchema>;

export const VerificationsListResponseSchema = z.object({
  items: z.array(VerificationListItemSchema),
  next_cursor: UuidSchema.nullable(),
  has_more: z.boolean(),
});
export type VerificationsListResponse = z.infer<
  typeof VerificationsListResponseSchema
>;

// ============================================================
// APPLICATIONS
// ============================================================
export const ApplicationListItemSchema = z.object({
  id: UuidSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']),
  api_key_prefix: z.string(),
  callback_url: z.string().nullable(),
  webhook_url: z.string().nullable(),
  allowed_origins: z.array(z.string()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type ApplicationListItem = z.infer<typeof ApplicationListItemSchema>;

export const ApplicationsListResponseSchema = z.object({
  items: z.array(ApplicationListItemSchema),
});

export const ApplicationWriteRequestSchema = z
  .object({
    id: UuidSchema.optional(),
    name: z.string().min(1).max(255),
    slug: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/, {
        message:
          'Slug deve ser kebab-case (a-z, 0-9, -), iniciar/terminar com alfanumérico.',
      }),
    description: z.string().max(2000).optional(),
    callback_url: z.string().url().optional(),
    webhook_url: z.string().url().optional(),
    allowed_origins: z.array(z.string().url()).max(50).default([]),
  })
  .strict();
export type ApplicationWriteRequest = z.infer<typeof ApplicationWriteRequestSchema>;

export const ApplicationWriteResponseSchema = z.object({
  id: UuidSchema,
  status: z.enum(['created', 'updated']),
  // Raw secrets are returned ONLY on create. On update both fields are null.
  api_key: z.string().nullable(),
  webhook_secret: z.string().nullable(),
});
export type ApplicationWriteResponse = z.infer<
  typeof ApplicationWriteResponseSchema
>;

// Rotate api_key — returns new raw key once.
export const ApplicationRotateKeyRequestSchema = z
  .object({
    application_id: UuidSchema,
  })
  .strict();
export const ApplicationRotateKeyResponseSchema = z.object({
  application_id: UuidSchema,
  api_key: z.string(),
  api_key_prefix: z.string(),
  rotated_at: z.string().datetime(),
});
export type ApplicationRotateKeyResponse = z.infer<
  typeof ApplicationRotateKeyResponseSchema
>;

// ============================================================
// TENANT BOOTSTRAP
// POST /v1/tenant-bootstrap — creates tenant + first owner role + first app
// atomically. Uses Supabase Auth JWT (NOT X-AgeKey-API-Key).
// ============================================================
export const TenantBootstrapRequestSchema = z
  .object({
    tenant: z.object({
      name: z.string().min(1).max(255),
      slug: z
        .string()
        .min(3)
        .max(63)
        .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/),
      jurisdiction_code: JurisdictionCodeSchema.optional(),
    }),
    application: z.object({
      name: z.string().min(1).max(255),
      slug: z
        .string()
        .min(1)
        .max(64)
        .regex(/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/),
      description: z.string().max(500).optional(),
    }),
  })
  .strict();
export type TenantBootstrapRequest = z.infer<typeof TenantBootstrapRequestSchema>;

export const TenantBootstrapResponseSchema = z.object({
  tenant_id: UuidSchema,
  tenant_slug: z.string(),
  application_id: UuidSchema,
  application_slug: z.string(),
  api_key: z.string(),         // raw — show once
  api_key_prefix: z.string(),
  webhook_secret: z.string(),  // raw — show once
});
export type TenantBootstrapResponse = z.infer<
  typeof TenantBootstrapResponseSchema
>;

// ============================================================
// AUDIT LIST
// ============================================================
export const AuditListQuerySchema = z
  .object({
    action: z.string().optional(),
    resource_type: z.string().optional(),
    actor_type: z.enum(['user', 'api_key', 'system', 'cron']).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    cursor: UuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

export const AuditEventItemSchema = z.object({
  id: UuidSchema,
  actor_type: z.enum(['user', 'api_key', 'system', 'cron']),
  actor_id: UuidSchema.nullable(),
  action: z.string(),
  resource_type: z.string(),
  resource_id: UuidSchema.nullable(),
  diff_json: z.record(z.unknown()),
  client_ip: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type AuditEventItem = z.infer<typeof AuditEventItemSchema>;

export const AuditListResponseSchema = z.object({
  items: z.array(AuditEventItemSchema),
  next_cursor: UuidSchema.nullable(),
  has_more: z.boolean(),
});
