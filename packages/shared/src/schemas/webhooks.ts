// Schemas for webhook endpoint management (AK-P1-08).
//
// Anti-SSRF policy:
//   - URL scheme MUST be `https`. Plain `http` is rejected even on local
//     IP ranges (defense-in-depth — an http endpoint to a public IP can
//     be MITM'd; webhooks carry signed payloads so we double down).
//   - Hostname MUST NOT resolve to a private/loopback/link-local block.
//     We reject anything that *looks* internal at the URL level — full
//     DNS resolution check happens later in the worker, but the URL
//     filter blocks the obvious vectors:
//       127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
//       169.254.0.0/16 (link-local), ::1, fe80::/10, fc00::/7,
//       hostnames `localhost`, `*.local`, `*.internal`.
//
// Raw secret reveal-once: the response of `webhooks-write` (CREATE only)
// and `webhooks-rotate-secret` includes a `raw_secret` field. Persistence
// only stores `sha256_hex(raw_secret)` in `webhook_endpoints.secret_hash`.

import { z } from 'zod';
import { UuidSchema } from './common.ts';

// ============================================================
// Anti-SSRF validators (pure — easy to unit test)
// ============================================================

/**
 * Returns `true` when the host portion of a URL looks internal/private.
 * Conservative — false positives are fine (we reject), false negatives
 * are NOT (would allow SSRF).
 */
export function isInternalHost(host: string): boolean {
  if (!host) return true;
  const lower = host.toLowerCase();

  // Hostname-level blocklist.
  if (lower === 'localhost') return true;
  if (lower === 'ip6-localhost' || lower === 'ip6-loopback') return true;
  if (lower.endsWith('.local')) return true;
  if (lower.endsWith('.localhost')) return true;
  if (lower.endsWith('.internal')) return true;

  // IPv6 — strip surrounding brackets if URL provided them.
  if (lower.startsWith('[') && lower.endsWith(']')) {
    return isInternalHost(lower.slice(1, -1));
  }
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true;
  // ULA fc00::/7 — covers fc00..fdff prefixes.
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) → check the v4 tail.
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped?.[1]) return isInternalHost(mapped[1]);

  // IPv4 dotted quad ranges. Anything with letters (other than v6) is a
  // hostname and falls through to the public bucket.
  if (/^[0-9.]+$/.test(lower)) {
    const parts = lower.split('.').map((p) => Number.parseInt(p, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      // Not a valid v4 — treat as suspicious.
      return true;
    }
    const [a, b] = parts as [number, number, number, number];
    if (a === 127) return true;             // 127.0.0.0/8 loopback
    if (a === 10) return true;              // 10.0.0.0/8
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. AWS metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 0) return true;               // 0.0.0.0/8 — "this host"
    if (a >= 224) return true;              // multicast / reserved
    return false;
  }

  return false;
}

export type WebhookUrlValidationError =
  | 'invalid_url'
  | 'invalid_scheme'
  | 'internal_host';

/**
 * Validates a webhook URL string against the anti-SSRF policy.
 * Returns `null` on success, or the specific error reason on failure.
 */
export function validateWebhookUrl(value: string): WebhookUrlValidationError | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'invalid_url';
  }
  if (parsed.protocol !== 'https:') return 'invalid_scheme';
  if (isInternalHost(parsed.hostname)) return 'internal_host';
  return null;
}

const WebhookUrlSchema = z
  .string()
  .min(1)
  .max(2048)
  .superRefine((value, ctx) => {
    const err = validateWebhookUrl(value);
    if (err === 'invalid_url') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL inválida.',
      });
    } else if (err === 'invalid_scheme') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Webhook URL precisa usar https.',
        params: { reason_code: 'WEBHOOK_URL_INVALID_SCHEME' },
      });
    } else if (err === 'internal_host') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URLs internas/privadas não são permitidas.',
        params: { reason_code: 'WEBHOOK_URL_INTERNAL_BLOCKED' },
      });
    }
  });

// ============================================================
// Event types
// ============================================================
//
// Keep this list in sync with `verifications.events` emitted by the worker.
// Empty `event_types` array at the DB level means "subscribe to all", but
// the panel always sends at least one explicit event for clarity.
export const WebhookEventTypeSchema = z.enum([
  'verification.created',
  'verification.completed',
  'verification.expired',
  'verification.cancelled',
  'token.revoked',
  'policy.updated',
  'application.suspended',
]);
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;

export const WEBHOOK_EVENT_TYPES: ReadonlyArray<WebhookEventType> = [
  'verification.created',
  'verification.completed',
  'verification.expired',
  'verification.cancelled',
  'token.revoked',
  'policy.updated',
  'application.suspended',
];

// ============================================================
// Endpoint resource
// ============================================================
export const WebhookEndpointSchema = z.object({
  id: UuidSchema,
  tenant_id: UuidSchema,
  application_id: UuidSchema,
  name: z.string(),
  url: z.string(),
  status: z.enum(['active', 'inactive', 'suspended']),
  event_types: z.array(z.string()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Optional rollup populated by webhooks-list when DB joined the latest delivery.
  last_delivery_status: z
    .enum(['pending', 'delivered', 'failed', 'dead_letter'])
    .nullable()
    .optional(),
  last_delivery_at: z.string().datetime().nullable().optional(),
});
export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;

export const WebhookListResponseSchema = z.object({
  items: z.array(WebhookEndpointSchema),
});
export type WebhookListResponse = z.infer<typeof WebhookListResponseSchema>;

// ============================================================
// List query
// ============================================================
export const WebhookListQuerySchema = z
  .object({
    application_id: UuidSchema.optional(),
    active: z.boolean().optional(),
    event_type: WebhookEventTypeSchema.optional(),
  })
  .strict();
export type WebhookListQuery = z.infer<typeof WebhookListQuerySchema>;

// ============================================================
// Write request (create / update)
// ============================================================
//
// `id` present → update existing endpoint (cannot move it across applications).
// `id` absent  → create new endpoint scoped to `application_id`.
// `delete: true` performs a soft-delete (sets deleted_at) — kept here so the
// admin surface can issue a single POST for all mutations and stay close to
// the applications-write contract.
export const WebhookEndpointWriteRequestSchema = z
  .object({
    id: UuidSchema.optional(),
    application_id: UuidSchema,
    name: z.string().min(1).max(120),
    url: WebhookUrlSchema,
    event_types: z
      .array(WebhookEventTypeSchema)
      .min(1, { message: 'Selecione ao menos um tipo de evento.' })
      .max(32)
      .superRefine((values, ctx) => {
        const seen = new Set<string>();
        for (const v of values) {
          if (seen.has(v)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Tipo de evento duplicado: ${v}`,
            });
            return;
          }
          seen.add(v);
        }
      }),
    active: z.boolean().default(true),
    delete: z.boolean().optional(),
  })
  .strict();
export type WebhookEndpointWriteRequest = z.infer<
  typeof WebhookEndpointWriteRequestSchema
>;

export const WebhookEndpointWriteResponseSchema = z.object({
  id: UuidSchema,
  status: z.enum(['created', 'updated', 'deleted']),
  // Raw secret returned ONLY on create. Update / delete return null.
  raw_secret: z.string().nullable(),
});
export type WebhookEndpointWriteResponse = z.infer<
  typeof WebhookEndpointWriteResponseSchema
>;

// ============================================================
// Rotate secret
// ============================================================
export const WebhookRotateSecretRequestSchema = z
  .object({
    id: UuidSchema,
  })
  .strict();
export type WebhookRotateSecretRequest = z.infer<
  typeof WebhookRotateSecretRequestSchema
>;

export const WebhookRotateSecretResponseSchema = z.object({
  id: UuidSchema,
  raw_secret: z.string(),
  rotated_at: z.string().datetime(),
});
export type WebhookRotateSecretResponse = z.infer<
  typeof WebhookRotateSecretResponseSchema
>;

// ============================================================
// Deliveries
// ============================================================
export const WebhookDeliveryStatusSchema = z.enum([
  'pending',
  'delivered',
  'failed',
  'dead_letter',
]);
// NOTE: The matching `WebhookDeliveryStatus` string-literal type already
// lives in `types.ts` and is re-exported by the package root; we avoid
// re-exporting an inferred alias here to keep `@agekey/shared` exports
// unambiguous.

export const WebhookDeliverySchema = z.object({
  id: UuidSchema,
  endpoint_id: UuidSchema,
  tenant_id: UuidSchema,
  event_type: z.string(),
  payload_json: z.record(z.unknown()),
  idempotency_key: UuidSchema,
  status: WebhookDeliveryStatusSchema,
  attempts: z.number().int().min(0),
  next_attempt_at: z.string().datetime(),
  last_response_code: z.number().int().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;

export const WebhookDeliveriesListRequestSchema = z
  .object({
    endpoint_id: UuidSchema,
    status: WebhookDeliveryStatusSchema.optional(),
    since: z.string().datetime().optional(),
    cursor: UuidSchema.optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();
export type WebhookDeliveriesListRequest = z.infer<
  typeof WebhookDeliveriesListRequestSchema
>;

export const WebhookDeliveriesListResponseSchema = z.object({
  items: z.array(WebhookDeliverySchema),
  next_cursor: UuidSchema.nullable(),
  has_more: z.boolean(),
});
export type WebhookDeliveriesListResponse = z.infer<
  typeof WebhookDeliveriesListResponseSchema
>;
