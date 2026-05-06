// Canonical age-policy taxonomy.
//
// Defines the value space the Core uses when expressing policy thresholds and
// age bands. The values mirror the SQL CHECK constraints in
// `supabase/migrations/002_policies.sql` (1..120) so the database, the policy
// engine and the SDK validate the exact same range.
//
// Reference: docs/specs/agekey-core-canonical-contracts.md §Age taxonomy.

import { z } from 'zod';

/** Inclusive lower bound for `age_threshold` and band edges. */
export const AGE_THRESHOLD_MIN = 1;

/** Inclusive upper bound for `age_threshold` and band edges. */
export const AGE_THRESHOLD_MAX = 120;

/**
 * Common thresholds we ship as policy templates. Not exhaustive: any integer
 * in `[AGE_THRESHOLD_MIN, AGE_THRESHOLD_MAX]` is permitted at the schema
 * level. This list exists so the Admin UI and SDK can offer a sane default
 * picker without hard-coding it in two places.
 */
export const COMMON_AGE_THRESHOLDS = [13, 14, 16, 18, 21] as const;

export type CommonAgeThreshold = (typeof COMMON_AGE_THRESHOLDS)[number];

/**
 * Optional age band. When both edges are present the band is inclusive on
 * both sides. A `null` edge means "open on that side".
 */
export interface AgeBand {
  readonly min: number | null;
  readonly max: number | null;
}

export const AgeThresholdSchema = z
  .number()
  .int()
  .min(AGE_THRESHOLD_MIN)
  .max(AGE_THRESHOLD_MAX);

export const AgeBandSchema = z
  .object({
    min: AgeThresholdSchema.nullable(),
    max: AgeThresholdSchema.nullable(),
  })
  .strict()
  .superRefine((band, ctx) => {
    if (band.min != null && band.max != null && band.min > band.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'age_band_min must be <= age_band_max',
      });
    }
  });

export function isValidAgeThreshold(value: unknown): value is number {
  return AgeThresholdSchema.safeParse(value).success;
}

export function isValidAgeBand(band: unknown): band is AgeBand {
  return AgeBandSchema.safeParse(band).success;
}

/**
 * Returns true when the supplied band is entirely within the valid range
 * AND consistent (min <= max when both sides are present).
 */
export function bandIsConsistent(band: AgeBand): boolean {
  return AgeBandSchema.safeParse(band).success;
}

/**
 * Human-readable description of an age requirement, intended for audit logs
 * and policy version diffs. Localised in pt-BR — the Admin UI can reformat
 * for other locales.
 *
 * @example describeAgeRequirement(18) => "18 anos ou mais"
 * @example describeAgeRequirement(18, { min: 18, max: 24 }) => "18 anos ou mais (faixa 18-24)"
 */
export function describeAgeRequirement(
  threshold: number,
  band?: AgeBand,
): string {
  if (!isValidAgeThreshold(threshold)) {
    throw new RangeError(
      `age_threshold must be an integer in [${AGE_THRESHOLD_MIN}, ${AGE_THRESHOLD_MAX}]`,
    );
  }
  const base = `${threshold} anos ou mais`;
  if (!band || (band.min == null && band.max == null)) return base;
  const min = band.min ?? AGE_THRESHOLD_MIN;
  const max = band.max ?? AGE_THRESHOLD_MAX;
  return `${base} (faixa ${min}-${max})`;
}
