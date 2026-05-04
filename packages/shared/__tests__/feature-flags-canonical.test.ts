import { describe, expect, it } from 'vitest';
import {
  AGEKEY_FEATURE_DISABLED_REASON_CODES,
  AGEKEY_FEATURE_FLAG_DEFAULTS,
  AGEKEY_FEATURE_FLAG_KEYS,
  isFlagOn,
  readFeatureFlags,
} from '../src/feature-flags/index.ts';

describe('Feature flags canônicas — defaults', () => {
  it('todas as flags começam desligadas', () => {
    for (const key of AGEKEY_FEATURE_FLAG_KEYS) {
      expect(AGEKEY_FEATURE_FLAG_DEFAULTS[key]).toBe(false);
    }
  });

  it('cada flag tem um reason code de fallback honesto', () => {
    for (const key of AGEKEY_FEATURE_FLAG_KEYS) {
      const code = AGEKEY_FEATURE_DISABLED_REASON_CODES[key];
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    }
  });
});

describe('Feature flags canônicas — isFlagOn', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    ['True', true],
    ['1', true],
    ['on', true],
    ['ON', true],
    ['yes', true],
    [' true ', true],
    ['false', false],
    ['0', false],
    ['off', false],
    ['no', false],
    ['', false],
    ['random', false],
  ])('isFlagOn(%j) === %s', (input, expected) => {
    expect(isFlagOn(input)).toBe(expected);
  });

  it('isFlagOn(undefined) === false', () => {
    expect(isFlagOn(undefined)).toBe(false);
  });

  it('isFlagOn(null) === false', () => {
    expect(isFlagOn(null)).toBe(false);
  });
});

describe('Feature flags canônicas — readFeatureFlags', () => {
  it('aplica defaults quando todas as envs estão ausentes', () => {
    const flags = readFeatureFlags(() => undefined);
    for (const key of AGEKEY_FEATURE_FLAG_KEYS) {
      expect(flags[key]).toBe(false);
    }
  });

  it('respeita opt-in via env explícita', () => {
    const env = new Map<string, string>([
      ['AGEKEY_CREDENTIAL_MODE_ENABLED', 'true'],
      ['AGEKEY_ZKP_BBS_ENABLED', 'false'],
    ]);
    const flags = readFeatureFlags((name) => env.get(name));
    expect(flags.AGEKEY_CREDENTIAL_MODE_ENABLED).toBe(true);
    expect(flags.AGEKEY_ZKP_BBS_ENABLED).toBe(false);
    expect(flags.AGEKEY_PARENTAL_CONSENT_ENABLED).toBe(false);
  });

  it('valor inválido em env é tratado como desligado', () => {
    const flags = readFeatureFlags(() => 'maybe');
    for (const key of AGEKEY_FEATURE_FLAG_KEYS) {
      expect(flags[key]).toBe(false);
    }
  });
});
