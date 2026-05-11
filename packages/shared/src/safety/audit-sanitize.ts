// Pure sanitization helpers for the Safety Signals audit pipeline.
// Lives in @agekey/shared so both the edge function helper
// (supabase/functions/_shared/safety/audit.ts) and the vitest suite
// share a single source of truth.
//
// Invariants:
//   - audit rows for safety.* actions NEVER contain raw content
//     (message/raw_text/image/video/audio/...).
//   - audit rows for safety.* actions NEVER contain PII (name/cpf/email
//     /phone/birthdate/face/biometric/...).
//   - audit rows for safety.* actions NEVER contain raw IP or GPS.
//   - keys outside the SAFETY_AUDIT_ALLOWED_KEYS allow-list are dropped.
//
// The diff is a plain Record<string, unknown> persisted into
// `audit_events.diff_json` — JSONB. We restrict to scalar values and
// arrays of strings.

export type SafetyAuditAction =
  | 'safety.alert_created'
  | 'safety.step_up_linked'
  | 'safety.step_up_skipped_no_policy'
  | 'safety.parental_consent_check_linked'
  | 'safety.parental_consent_skipped_no_policy'
  | 'safety.alert_acknowledged'
  | 'safety.alert_escalated'
  | 'safety.alert_resolved'
  | 'safety.alert_dismissed';

export interface SafetyAuditDiff {
  application_id?: string | null;
  alert_id?: string | null;
  event_id?: string | null;
  rule_code?: string | null;
  reason_codes?: string[];
  severity?: string | null;
  risk_category?: string | null;
  step_up_session_id?: string | null;
  parental_consent_request_id?: string | null;
  payload_hash?: string | null;
  note?: string;
  reason_code?: string;
}

export const SAFETY_AUDIT_ALLOWED_KEYS: ReadonlySet<keyof SafetyAuditDiff> =
  new Set([
    'application_id',
    'alert_id',
    'event_id',
    'rule_code',
    'reason_codes',
    'severity',
    'risk_category',
    'step_up_session_id',
    'parental_consent_request_id',
    'payload_hash',
    'note',
    'reason_code',
  ]);

export const SAFETY_AUDIT_FORBIDDEN_SUBSTRINGS = [
  'message',
  'raw_text',
  'image',
  'video',
  'audio',
  'cpf',
  'rg',
  'passport',
  'email',
  'phone',
  'birthdate',
  'dob',
  'face',
  'biometric',
  'selfie',
  'ip_address',
  'gps',
  'latitude',
  'longitude',
] as const;

export function isSuspectKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SAFETY_AUDIT_FORBIDDEN_SUBSTRINGS.some((s) => lower.includes(s));
}

// Cap the length of any string/array element so a careless caller
// can't push huge blobs into JSONB.
const MAX_STRING_LENGTH = 256;
const MAX_ARRAY_LENGTH = 32;

function safeScalar(val: unknown): string | number | boolean | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    return val.length <= MAX_STRING_LENGTH ? val : val.slice(0, MAX_STRING_LENGTH);
  }
  return null;
}

export function sanitizeSafetyAuditDiff(
  diff: SafetyAuditDiff,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(diff)) {
    // The key allow-list is the primary defense: anything outside this
    // set is dropped. We do not substring-match values, because
    // canonical reason codes legitimately contain words like "message"
    // (e.g. UNKNOWN_TO_MINOR_PRIVATE_MESSAGE) without being raw content.
    if (!SAFETY_AUDIT_ALLOWED_KEYS.has(key as keyof SafetyAuditDiff)) continue;
    // Belt-and-suspenders: if the key itself happens to be on the
    // forbidden-substring list, drop it. Today this is unreachable
    // because the allow-list is curated, but it guards against future
    // edits that try to add a forbidden key.
    if (isSuspectKey(key)) continue;
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      const filtered: string[] = [];
      for (const v of val) {
        if (typeof v !== 'string') continue;
        const trimmed = v.length <= MAX_STRING_LENGTH ? v : v.slice(0, MAX_STRING_LENGTH);
        filtered.push(trimmed);
        if (filtered.length >= MAX_ARRAY_LENGTH) break;
      }
      if (filtered.length > 0) safe[key] = filtered;
      continue;
    }
    const scalar = safeScalar(val);
    if (scalar !== null) safe[key] = scalar;
  }
  return safe;
}
