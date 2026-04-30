import { describe, it, expect } from 'vitest';
import {
  EXTERNAL_USER_REF_MAX_LENGTH,
  EXTERNAL_USER_REF_MIN_LENGTH,
  TRIVIAL_REFS,
  detectPiiInRef,
  explainPiiRejection,
} from './external-user-ref.ts';
import { SessionCreateRequestSchema } from './schemas/sessions.ts';

// 30+ synthetic PII values that MUST be rejected.
const PII_REJECTIONS: ReadonlyArray<{ value: string; expectedCode: string }> = [
  // Email
  { value: 'alice@example.com', expectedCode: 'EMAIL_LIKE' },
  { value: 'bob.smith+tag@empresa.com.br', expectedCode: 'EMAIL_LIKE' },
  { value: 'user@subdomain.example.co.uk', expectedCode: 'EMAIL_LIKE' },
  { value: 'maria_silva@corp.io', expectedCode: 'EMAIL_LIKE' },
  { value: 'noreply@agekey.com.br', expectedCode: 'EMAIL_LIKE' },
  // CPF (with and without separators)
  { value: '123.456.789-09', expectedCode: 'CPF_LIKE' },
  { value: '12345678909', expectedCode: 'CPF_LIKE' },
  { value: '111.222.333-44', expectedCode: 'CPF_LIKE' },
  { value: '00000000191', expectedCode: 'CPF_LIKE' },
  { value: '987.654.321-00', expectedCode: 'CPF_LIKE' },
  // CNPJ
  { value: '12.345.678/0001-95', expectedCode: 'CNPJ_LIKE' },
  { value: '12345678000195', expectedCode: 'CNPJ_LIKE' },
  { value: '00.000.000/0001-91', expectedCode: 'CNPJ_LIKE' },
  // Phone BR
  { value: '+5511999998888', expectedCode: 'PHONE_LIKE' },
  // Bare 11 digits: ambiguous with CPF; we default to CPF detection.
  { value: '11999998888', expectedCode: 'CPF_LIKE' },
  { value: '(11) 99999-8888', expectedCode: 'PHONE_LIKE' },
  { value: '+55 11 9 9999-8888', expectedCode: 'PHONE_LIKE' },
  { value: '21 98888-7777', expectedCode: 'PHONE_LIKE' },
  // RG
  { value: '12.345.678-9', expectedCode: 'RG_LIKE' },
  { value: '1.234.567-X', expectedCode: 'RG_LIKE' },
  { value: '99.999.999-9', expectedCode: 'RG_LIKE' },
  // Trivial / placeholders
  { value: 'admin', expectedCode: 'TOO_SHORT' }, // 5 chars
  { value: 'administrator', expectedCode: 'TRIVIAL' },
  { value: 'password', expectedCode: 'TRIVIAL' },
  { value: 'changeme', expectedCode: 'TRIVIAL' },
  { value: '12345678', expectedCode: 'TRIVIAL' }, // 8 chars, in trivial list
  { value: 'anonymous', expectedCode: 'TRIVIAL' },
  { value: 'undefined', expectedCode: 'TRIVIAL' },
  { value: '00000000', expectedCode: 'TRIVIAL' },
  { value: '11111111', expectedCode: 'TRIVIAL' },
  { value: '123456789', expectedCode: 'TRIVIAL' },
  { value: '1234567890', expectedCode: 'TRIVIAL' },
  // Empty / too short
  { value: '', expectedCode: 'EMPTY' },
  { value: 'abc', expectedCode: 'TOO_SHORT' },
  { value: '   alice@example.com   ', expectedCode: 'WHITESPACE' },
];

// 10+ opaque values that MUST be accepted.
const OPAQUE_ACCEPTED: ReadonlyArray<string> = [
  // UUID v4
  '6f9619ff-8b86-d011-b42d-00c04fc964ff',
  '550e8400-e29b-41d4-a716-446655440000',
  // SHA256 hex (64 chars)
  'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
  // SHA1 hex (40 chars) — NOT 11/14 digits, fully alphanumeric
  'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
  // base64-ish opaque token
  'hmac-v1.bX9vcGFxdWUtcmVmLW5vbi1waWk',
  // KSUID-style
  '1srOrx2ZWZBpBUvZwXKQmoEYga2',
  // ULID
  '01F8MECHZX3TBDSZ7XRADM79XV',
  // Anonymous slug + nonce
  'tenant-xyz-user-9f3a2b1c',
  // Custom HMAC tag
  'usr_8f3c4a2b9d1e6f0c5a7b3d8e9f1c2a4b',
  // Long opaque hex
  '0123456789abcdef0123456789abcdef',
  // External system pseudo-id (long enough, alphanumeric, no PII)
  'shopify-customer-9871234abc',
  // Hex with prefix
  '0xdeadbeefcafebabefeedface00112233',
];

describe('detectPiiInRef / rejections', () => {
  it.each(PII_REJECTIONS)(
    'rejects $value as $expectedCode',
    ({ value, expectedCode }) => {
      const r = detectPiiInRef(value);
      expect(r.ok).toBe(false);
      expect(r.code).toBe(expectedCode);
      expect(r.reason).toBeTruthy();
    },
  );

  it('rejects non-string types', () => {
    expect(detectPiiInRef(undefined).ok).toBe(false);
    expect(detectPiiInRef(null).ok).toBe(false);
    expect(detectPiiInRef(42).ok).toBe(false);
    expect(detectPiiInRef({}).ok).toBe(false);
    expect(detectPiiInRef([]).ok).toBe(false);
  });

  it('rejects values exceeding MAX_LENGTH', () => {
    const tooLong = 'a'.repeat(EXTERNAL_USER_REF_MAX_LENGTH + 1);
    const r = detectPiiInRef(tooLong);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('TOO_LONG');
  });

  it('rejects values shorter than MIN_LENGTH', () => {
    const r = detectPiiInRef('a'.repeat(EXTERNAL_USER_REF_MIN_LENGTH - 1));
    expect(r.ok).toBe(false);
    expect(r.code).toBe('TOO_SHORT');
  });

  it('rejects whitespace-padded values', () => {
    expect(detectPiiInRef(' usr_abcdef12345 ').code).toBe('WHITESPACE');
    expect(detectPiiInRef('usr_abcdef12345\n').code).toBe('WHITESPACE');
  });

  it('TRIVIAL_REFS set contains expected sentinels', () => {
    for (const k of ['admin', 'test', 'user', '1234', '0000', 'anonymous']) {
      expect(TRIVIAL_REFS.has(k)).toBe(true);
    }
  });
});

describe('detectPiiInRef / acceptances', () => {
  it.each(OPAQUE_ACCEPTED.map((v) => ({ value: v })))(
    'accepts $value',
    ({ value }) => {
      const r = detectPiiInRef(value);
      expect(r.ok).toBe(true);
      expect(r.reason).toBeUndefined();
    },
  );

  it('accepts a minimum-length opaque hex', () => {
    expect(detectPiiInRef('a1b2c3d4').ok).toBe(true);
  });
});

describe('explainPiiRejection', () => {
  it('returns empty string for ok detection', () => {
    expect(explainPiiRejection({ ok: true })).toBe('');
  });
  it('embeds the reason in a client-safe message and never leaks the regex', () => {
    const msg = explainPiiRejection(
      detectPiiInRef('alice@example.com'),
    );
    expect(msg).toContain('email');
    expect(msg).toContain('opaque');
    expect(msg).not.toMatch(/\\\d|\\s|\[\^/); // no raw regex syntax
  });
});

describe('SessionCreateRequestSchema integration', () => {
  const baseValid = {
    policy_slug: 'kids-13plus',
  };

  it('accepts a body without external_user_ref', () => {
    const r = SessionCreateRequestSchema.safeParse(baseValid);
    expect(r.success).toBe(true);
  });

  it('accepts an opaque external_user_ref', () => {
    const r = SessionCreateRequestSchema.safeParse({
      ...baseValid,
      external_user_ref: 'usr_8f3c4a2b9d1e6f0c5a7b3d8e9f1c2a4b',
    });
    expect(r.success).toBe(true);
  });

  it('rejects an email-shaped external_user_ref', () => {
    const r = SessionCreateRequestSchema.safeParse({
      ...baseValid,
      external_user_ref: 'alice@example.com',
    });
    expect(r.success).toBe(false);
  });

  it('rejects a CPF-shaped external_user_ref', () => {
    const r = SessionCreateRequestSchema.safeParse({
      ...baseValid,
      external_user_ref: '123.456.789-09',
    });
    expect(r.success).toBe(false);
  });

  it('rejects a trivial external_user_ref', () => {
    const r = SessionCreateRequestSchema.safeParse({
      ...baseValid,
      external_user_ref: 'admin',
    });
    expect(r.success).toBe(false);
  });

  it('rejects a phone-shaped external_user_ref', () => {
    const r = SessionCreateRequestSchema.safeParse({
      ...baseValid,
      external_user_ref: '+5511999998888',
    });
    expect(r.success).toBe(false);
  });

  it('rejects a CNPJ-shaped external_user_ref', () => {
    const r = SessionCreateRequestSchema.safeParse({
      ...baseValid,
      external_user_ref: '12.345.678/0001-95',
    });
    expect(r.success).toBe(false);
  });

  it('attaches the reason_code in issue params for telemetry', () => {
    const r = SessionCreateRequestSchema.safeParse({
      ...baseValid,
      external_user_ref: 'alice@example.com',
    });
    if (r.success) throw new Error('expected failure');
    const issue = r.error.issues.find((i) =>
      Array.isArray(i.path) && i.path.includes('external_user_ref'),
    );
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('email');
  });
});

describe('detectPiiInRef / coverage sanity', () => {
  it('exercises every category at least once', () => {
    const categories = new Set(
      PII_REJECTIONS.map((c) => c.expectedCode),
    );
    for (const code of [
      'EMAIL_LIKE',
      'CPF_LIKE',
      'CNPJ_LIKE',
      'PHONE_LIKE',
      'RG_LIKE',
      'TRIVIAL',
      'TOO_SHORT',
      'EMPTY',
      'WHITESPACE',
    ]) {
      expect(categories.has(code)).toBe(true);
    }
  });

  it('rejects 30+ PII synthetic cases and accepts 10+ opaque cases', () => {
    expect(PII_REJECTIONS.length).toBeGreaterThanOrEqual(30);
    expect(OPAQUE_ACCEPTED.length).toBeGreaterThanOrEqual(10);
  });
});
