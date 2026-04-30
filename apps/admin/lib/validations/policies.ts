import { z } from 'zod';

/**
 * Mirrors PolicyWriteInput in lib/agekey/client.ts. Shared between client
 * (RHF resolver) and server (Server Action validation).
 *
 * Keep in sync if the HTTP contract changes — the Edge Function performs
 * its own canonical validation, this is a UX-grade pre-check.
 */

export const POLICY_METHODS = ['zkp', 'vc', 'gateway', 'fallback'] as const;
export type PolicyMethod = (typeof POLICY_METHODS)[number];

export const ASSURANCE_LEVELS = ['low', 'substantial', 'high'] as const;
export type AssuranceLevel = (typeof ASSURANCE_LEVELS)[number];

// Top-level jurisdictions only for the first iteration; full UFs/EU states
// can land in a follow-up once we agree on canonical codes.
export const JURISDICTION_CODES = ['BR', 'EU'] as const;
export type JurisdictionCode = (typeof JURISDICTION_CODES)[number];

export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

export const PolicyFormSchema = z
  .object({
    id: z
      .string()
      .uuid({ message: 'ID inválido.' })
      .optional()
      .or(z.literal('').transform(() => undefined)),
    slug: z
      .string()
      .min(2, { message: 'Slug muito curto.' })
      .max(64, { message: 'Slug muito longo.' })
      .regex(SLUG_REGEX, {
        message:
          'Use apenas letras minúsculas, números e hifens (kebab-case).',
      }),
    name: z
      .string()
      .min(1, { message: 'Informe um nome.' })
      .max(200, { message: 'Nome muito longo.' }),
    description: z
      .string()
      .max(2000, { message: 'Máximo de 2000 caracteres.' })
      .optional()
      .or(z.literal('').transform(() => undefined)),
    age_threshold: z.coerce
      .number({ invalid_type_error: 'Informe um número.' })
      .int({ message: 'Use um número inteiro.' })
      .min(1, { message: 'Mínimo 1.' })
      .max(120, { message: 'Máximo 120.' }),
    jurisdiction_code: z
      .enum(JURISDICTION_CODES)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    method_priority_json: z
      .array(z.enum(POLICY_METHODS))
      .min(1, { message: 'Selecione ao menos um método.' })
      .max(POLICY_METHODS.length),
    required_assurance_level: z.enum(ASSURANCE_LEVELS),
    token_ttl_seconds: z.coerce
      .number({ invalid_type_error: 'Informe um número.' })
      .int({ message: 'Use um número inteiro.' })
      .min(60, { message: 'Mínimo de 60 segundos.' })
      .max(60 * 60 * 24 * 30, { message: 'Máximo de 30 dias.' }),
    cloned_from_id: z
      .string()
      .uuid({ message: 'ID inválido.' })
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .strict();

export type PolicyFormInput = z.infer<typeof PolicyFormSchema>;

/**
 * Convert a free-form name into a kebab-case slug suggestion.
 * Strips diacritics, collapses non-alphanumerics to single hyphens, trims.
 */
export function suggestSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
