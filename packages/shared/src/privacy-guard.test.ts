import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN_PUBLIC_KEYS,
  assertPublicPayloadHasNoPii,
  findForbiddenPublicPayloadKeys,
  redactTokenForDisplay,
} from './privacy-guard.ts';

describe('privacy-guard / FORBIDDEN_PUBLIC_KEYS', () => {
  it('contains the keys explicitly required by the AgeKey contract', () => {
    for (const k of [
      'birthdate',
      'date_of_birth',
      'dob',
      'age',
      'exact_age',
      'document',
      'cpf',
      'rg',
      'passport',
      'id_number',
      'name',
      'full_name',
      'selfie',
      'face',
      'biometric',
      'raw_id',
      'civil_id',
    ]) {
      expect(FORBIDDEN_PUBLIC_KEYS as readonly string[]).toContain(k);
    }
  });
});

describe('privacy-guard / findForbiddenPublicPayloadKeys', () => {
  it('returns an empty list for safe payloads', () => {
    const safe = {
      decision: 'approved',
      threshold_satisfied: true,
      age_threshold: 18,
      method: 'gateway',
      assurance_level: 'substantial',
      reason_code: 'THRESHOLD_SATISFIED',
      policy: { id: 'p', slug: 's', version: 1 },
    };
    expect(findForbiddenPublicPayloadKeys(safe)).toEqual([]);
  });

  it('flags top-level violations', () => {
    const v = findForbiddenPublicPayloadKeys({ birthdate: '2000-01-01' });
    expect(v).toHaveLength(1);
    expect(v[0]?.path).toBe('$.birthdate');
  });

  it('flags nested violations and reports the path', () => {
    const v = findForbiddenPublicPayloadKeys({
      agekey: { user: { dob: '2000-01-01' } },
    });
    expect(v.map((x) => x.path)).toEqual(['$.agekey.user.dob']);
  });

  it('descends into arrays', () => {
    const v = findForbiddenPublicPayloadKeys({
      results: [{ ok: true }, { selfie: 'data:image/png;base64,...' }],
    });
    expect(v[0]?.path).toBe('$.results[1].selfie');
  });

  it('matches keys regardless of casing and separator (camelCase, kebab, snake)', () => {
    const variants = {
      DateOfBirth: '2000-01-01',
      'date-of-birth': '2000-01-01',
      DATE_OF_BIRTH: '2000-01-01',
    };
    const v = findForbiddenPublicPayloadKeys(variants);
    expect(v).toHaveLength(3);
  });

  it('does not flag age_threshold (policy descriptor, not user age)', () => {
    expect(
      findForbiddenPublicPayloadKeys({
        agekey: { age_threshold: 18, age_band_min: 13, age_band_max: 17 },
      }),
    ).toEqual([]);
  });

  it('does not flag agekey.policy.version (no PII)', () => {
    expect(
      findForbiddenPublicPayloadKeys({
        policy: { id: 'p', slug: 's', version: 1 },
      }),
    ).toEqual([]);
  });

  it('flags Brazilian-specific PII keys (cpf, rg, nome_completo, telefone)', () => {
    const v = findForbiddenPublicPayloadKeys({
      cpf: '123.456.789-00',
      rg: '12.345.678-9',
      nome_completo: 'Maria',
      telefone: '+55-11-...',
    });
    expect(v).toHaveLength(4);
  });

  it('honors allowedKeys option for explicit overrides', () => {
    expect(
      findForbiddenPublicPayloadKeys({ name: 'AgeKey' }, '$', {
        allowedKeys: ['name'],
      }),
    ).toEqual([]);
  });

  it('returns no violations for primitives, null, undefined', () => {
    expect(findForbiddenPublicPayloadKeys(null)).toEqual([]);
    expect(findForbiddenPublicPayloadKeys(undefined)).toEqual([]);
    expect(findForbiddenPublicPayloadKeys('hello')).toEqual([]);
    expect(findForbiddenPublicPayloadKeys(42)).toEqual([]);
  });
});

describe('privacy-guard / assertPublicPayloadHasNoPii', () => {
  it('passes for safe payload', () => {
    expect(() =>
      assertPublicPayloadHasNoPii({ decision: 'approved' }),
    ).not.toThrow();
  });

  it('throws and lists every offending path', () => {
    expect(() =>
      assertPublicPayloadHasNoPii({
        agekey: { dob: 'x' },
        users: [{ cpf: 'y' }],
      }),
    ).toThrow(/agekey\.dob.*users\[0\]\.cpf|users\[0\]\.cpf.*agekey\.dob/);
  });
});

describe('privacy-guard / redactTokenForDisplay', () => {
  it('redacts short tokens fully', () => {
    expect(redactTokenForDisplay('abc')).toBe('***');
  });

  it('shows head and tail of long tokens', () => {
    const t = 'A'.repeat(50);
    const out = redactTokenForDisplay(t);
    expect(out.startsWith('AAAAAAAAAAAA')).toBe(true);
    expect(out.endsWith('AAAAAAAAAAAA')).toBe(true);
    expect(out).toContain('...');
  });
});
