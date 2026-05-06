import { describe, expect, it } from 'vitest';
import {
  AGE_THRESHOLD_MAX,
  AGE_THRESHOLD_MIN,
  AgeBandSchema,
  AgeThresholdSchema,
  COMMON_AGE_THRESHOLDS,
  bandIsConsistent,
  describeAgeRequirement,
  isValidAgeBand,
  isValidAgeThreshold,
} from './age-taxonomy.ts';

describe('age taxonomy', () => {
  it('accepts thresholds within [1, 120]', () => {
    expect(isValidAgeThreshold(AGE_THRESHOLD_MIN)).toBe(true);
    expect(isValidAgeThreshold(18)).toBe(true);
    expect(isValidAgeThreshold(AGE_THRESHOLD_MAX)).toBe(true);
  });

  it('rejects thresholds outside the valid range or non-integers', () => {
    expect(isValidAgeThreshold(0)).toBe(false);
    expect(isValidAgeThreshold(-1)).toBe(false);
    expect(isValidAgeThreshold(121)).toBe(false);
    expect(isValidAgeThreshold(18.5)).toBe(false);
    expect(isValidAgeThreshold('18')).toBe(false);
  });

  it('parses common thresholds via Zod', () => {
    for (const value of COMMON_AGE_THRESHOLDS) {
      expect(AgeThresholdSchema.parse(value)).toBe(value);
    }
  });

  it('accepts bands where min <= max or either side is null', () => {
    expect(isValidAgeBand({ min: 18, max: 24 })).toBe(true);
    expect(isValidAgeBand({ min: 18, max: 18 })).toBe(true);
    expect(isValidAgeBand({ min: null, max: 24 })).toBe(true);
    expect(isValidAgeBand({ min: 18, max: null })).toBe(true);
    expect(isValidAgeBand({ min: null, max: null })).toBe(true);
  });

  it('rejects bands where min > max', () => {
    expect(isValidAgeBand({ min: 25, max: 24 })).toBe(false);
    expect(bandIsConsistent({ min: 25, max: 24 })).toBe(false);
  });

  it('rejects bands with values outside the threshold range', () => {
    const result = AgeBandSchema.safeParse({ min: 0, max: 24 });
    expect(result.success).toBe(false);
  });

  it('describes thresholds and bands in pt-BR', () => {
    expect(describeAgeRequirement(18)).toBe('18 anos ou mais');
    expect(describeAgeRequirement(18, { min: 18, max: 24 })).toBe(
      '18 anos ou mais (faixa 18-24)',
    );
    expect(describeAgeRequirement(18, { min: null, max: null })).toBe(
      '18 anos ou mais',
    );
  });

  it('throws when describing an invalid threshold', () => {
    expect(() => describeAgeRequirement(0)).toThrow(RangeError);
  });
});
