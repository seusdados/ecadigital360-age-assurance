// PII detection for the `external_user_ref` field passed by clients on
// session creation. The contract (see docs/specs/sdk-public-contract.md and
// docs/audit/current-state.md §Risk 1) is that this field is an OPAQUE
// reference (HMAC, hash, UUID, anonymous slug) — NEVER PII.
//
// This module is the single source of truth used by:
//   - Zod refinement in packages/shared/src/schemas/sessions.ts
//   - Edge Function supabase/functions/verifications-session-create/index.ts
//   - Public SDKs that wish to fail fast before hitting the wire
//
// We intentionally implement detection on the boundary, in addition to the
// more general PII guard at response time, because rejecting PII on input
// is the only way to keep it out of the database and out of operational
// logs.

/** Minimum length for an opaque reference. Real opaque refs (UUID, hex
 * hash, base64 hash, kSUID, ULID, custom HMAC tag) are all >= 8 chars.
 * Anything shorter is overwhelmingly likely to be a trivial value
 * (`test`, `1`, `admin`) that is also a privacy/security risk. */
export const EXTERNAL_USER_REF_MIN_LENGTH = 8;

/** Maximum length kept in sync with the column type / Zod schema. */
export const EXTERNAL_USER_REF_MAX_LENGTH = 255;

// ---------------------------------------------------------------------------
// Patterns. Each pattern carries a stable code (used in error messages and
// telemetry) and a short reason. We never expose the regex itself — the
// human-readable reason is enough for the client.
// ---------------------------------------------------------------------------

interface PiiPattern {
  code: string;
  reason: string;
  test(value: string): boolean;
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// CPF: 11 digits, with optional `.` and `-` separators. We require exactly
// 11 digits when stripped of separators to avoid catching hashes.
const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
// CNPJ: 14 digits with optional separators.
const CNPJ_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/;
// BR phone: optional +55, optional area code in parens, optional 9, then
// 4-4 digits. We allow extra spaces between groups since clients format
// phones liberally.
const PHONE_BR_RE = /(?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?[\s-]?\d{4}[\s-]?\d{4}/;
// Generic RG (8-10 digits with optional separators). RG numbering varies by
// state so we use a deliberately loose pattern.
const RG_RE = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dxX]\b/;

/** Returns true if `value` consists only of digits and phone-syntax
 * separators (`+`, `(`, `)`, ` `, `-`, `.`). Used to distinguish a phone
 * number from an opaque token that happens to contain digits. */
function isPhoneShaped(value: string): boolean {
  if (!/^[\d().\s+-]+$/.test(value)) return false;
  const digits = value.replace(/\D+/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

/** Trivial / placeholder strings that must never be accepted as opaque
 * refs. Comparison is case-insensitive. */
export const TRIVIAL_REFS: ReadonlySet<string> = new Set([
  'test',
  'tests',
  'testing',
  'admin',
  'administrator',
  'root',
  'user',
  'users',
  'guest',
  'demo',
  'sample',
  'example',
  'foo',
  'bar',
  'baz',
  'qux',
  '0000',
  '1111',
  '1234',
  '12345',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '00000000',
  '11111111',
  'password',
  'changeme',
  'null',
  'undefined',
  'none',
  'n/a',
  'na',
  'unknown',
  'anonymous',
  'anon',
  'cpf',
  'rg',
  'email',
  'phone',
]);

const PATTERNS: readonly PiiPattern[] = [
  {
    code: 'EMAIL_LIKE',
    reason: 'looks like an email address',
    test: (v) => EMAIL_RE.test(v),
  },
  // Phone is checked BEFORE CPF/CNPJ because Brazilian mobile numbers
  // (DDD + 9 + 8 digits = 11 digits) collide with CPF length. We
  // disambiguate by requiring phone-syntax separators or a 10/12/13 digit
  // count, falling through to CPF/CNPJ otherwise.
  {
    code: 'PHONE_LIKE',
    reason: 'looks like a phone number',
    test: (v) => {
      if (!isPhoneShaped(v)) return false;
      const digits = v.replace(/\D+/g, '');
      // 10 = landline (DDD + 8), 11 = mobile (DDD + 9 + 8),
      // 12 = +55 + landline, 13 = +55 + mobile.
      if (digits.length === 11 && !/[+().\s-]/.test(v)) return false; // bare 11 digits → CPF
      return PHONE_BR_RE.test(v);
    },
  },
  {
    code: 'CNPJ_LIKE',
    reason: 'looks like a Brazilian CNPJ',
    test: (v) => {
      if (!CNPJ_RE.test(v)) return false;
      const digits = v.replace(/\D+/g, '');
      return digits.length === 14;
    },
  },
  {
    code: 'CPF_LIKE',
    reason: 'looks like a Brazilian CPF',
    test: (v) => {
      if (!CPF_RE.test(v)) return false;
      const digits = v.replace(/\D+/g, '');
      return digits.length === 11;
    },
  },
  {
    code: 'RG_LIKE',
    reason: 'looks like a Brazilian RG / civil ID',
    test: (v) => {
      // RG patterns are noisy; only flag them if the value ALSO has
      // dot/dash separators OR is a short value (<= 14 chars). This keeps
      // long opaque hashes from being mis-flagged.
      if (!RG_RE.test(v)) return false;
      if (/[.\-/]/.test(v)) return true;
      return v.length <= 14;
    },
  },
];

export interface PiiDetection {
  ok: boolean;
  /** Stable machine-readable code (e.g. `EMAIL_LIKE`, `TRIVIAL`). */
  code?: string;
  /** Short human-readable reason. Safe to bubble up to clients. */
  reason?: string;
}

/** Detect whether `value` looks like PII (email/CPF/CNPJ/phone/RG) or a
 * trivial / placeholder string. Returns `{ ok: true }` for opaque values.
 *
 * Order of checks:
 *   1. Type / length / whitespace
 *   2. Trivial / placeholder list
 *   3. PII regexes
 *
 * The function never throws and never logs. The caller decides how to
 * surface the rejection. */
export function detectPiiInRef(value: unknown): PiiDetection {
  if (typeof value !== 'string') {
    return { ok: false, code: 'NOT_A_STRING', reason: 'must be a string' };
  }
  // Reject leading/trailing whitespace early — opaque hashes never have it.
  if (value !== value.trim()) {
    return {
      ok: false,
      code: 'WHITESPACE',
      reason: 'contains leading or trailing whitespace',
    };
  }
  if (value.length === 0) {
    return { ok: false, code: 'EMPTY', reason: 'must not be empty' };
  }
  if (value.length < EXTERNAL_USER_REF_MIN_LENGTH) {
    return {
      ok: false,
      code: 'TOO_SHORT',
      reason: `must be at least ${EXTERNAL_USER_REF_MIN_LENGTH} characters`,
    };
  }
  if (value.length > EXTERNAL_USER_REF_MAX_LENGTH) {
    return {
      ok: false,
      code: 'TOO_LONG',
      reason: `must be at most ${EXTERNAL_USER_REF_MAX_LENGTH} characters`,
    };
  }

  // Trivial placeholders.
  if (TRIVIAL_REFS.has(value.toLowerCase())) {
    return {
      ok: false,
      code: 'TRIVIAL',
      reason: 'is a trivial / placeholder value',
    };
  }

  // PII patterns.
  for (const p of PATTERNS) {
    if (p.test(value)) {
      return { ok: false, code: p.code, reason: p.reason };
    }
  }

  return { ok: true };
}

/** Convenience guard used by the Edge Function. Returns the message that
 * should be surfaced via 400 + reason_code EXTERNAL_USER_REF_PII_DETECTED. */
export function explainPiiRejection(detection: PiiDetection): string {
  if (detection.ok) return '';
  return `external_user_ref ${detection.reason ?? 'is invalid'} — must be an opaque reference (e.g. HMAC or hash), never PII`;
}
