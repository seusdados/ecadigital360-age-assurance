// Canonical reason-code taxonomy entrypoint for the AgeKey Core.
//
// Re-exports the runtime catalog defined in `../reason-codes.ts` (which is the
// single source of truth shared by SQL, edge functions and SDK) and adds a
// reserved namespace for the Consent and Safety modules. Reserved codes
// declare *which* identifiers the Core promises to honour once those modules
// land; they are intentionally NOT yet referenced by the policy engine.
//
// Reference: docs/specs/agekey-core-canonical-contracts.md §Reason codes.

export {
  REASON_CODES,
  POSITIVE_REASON_CODES,
  isPositive,
  type ReasonCode,
} from '../reason-codes.ts';

import { REASON_CODES, type ReasonCode } from '../reason-codes.ts';

/**
 * Reason-code categories. Used by Admin UI filters and by the audit pipeline
 * to bucket events without leaking the enum's wire spelling.
 */
export const REASON_CODE_CATEGORIES = {
  positive: 'positive',
  zkp: 'zkp',
  vc: 'vc',
  gateway: 'gateway',
  fallback: 'fallback',
  policy: 'policy',
  session: 'session',
  request: 'request',
  internal: 'internal',
  consent: 'consent',
  safety: 'safety',
} as const;

export type ReasonCodeCategory =
  (typeof REASON_CODE_CATEGORIES)[keyof typeof REASON_CODE_CATEGORIES];

export function categorizeReasonCode(code: string): ReasonCodeCategory {
  if (code.startsWith('ZKP_')) return REASON_CODE_CATEGORIES.zkp;
  if (code.startsWith('VC_')) return REASON_CODE_CATEGORIES.vc;
  if (code.startsWith('GATEWAY_')) return REASON_CODE_CATEGORIES.gateway;
  if (code.startsWith('FALLBACK_')) return REASON_CODE_CATEGORIES.fallback;
  if (code.startsWith('POLICY_')) return REASON_CODE_CATEGORIES.policy;
  if (code.startsWith('SESSION_')) return REASON_CODE_CATEGORIES.session;
  if (code.startsWith('CONSENT_')) return REASON_CODE_CATEGORIES.consent;
  if (code.startsWith('SAFETY_')) return REASON_CODE_CATEGORIES.safety;
  if (
    code === REASON_CODES.THRESHOLD_SATISFIED ||
    code === REASON_CODES.BAND_SATISFIED
  ) {
    return REASON_CODE_CATEGORIES.positive;
  }
  if (
    code === REASON_CODES.RATE_LIMIT_EXCEEDED ||
    code === REASON_CODES.INVALID_REQUEST ||
    code === REASON_CODES.EXTERNAL_USER_REF_PII_DETECTED
  ) {
    return REASON_CODE_CATEGORIES.request;
  }
  return REASON_CODE_CATEGORIES.internal;
}

/**
 * Reserved codes for future modules. Empty after Round 4 promoted both the
 * Consent and Safety code namespaces to LIVE in `../reason-codes.ts`. Kept
 * as a structural hook so future modules can declare reserved codes without
 * adjusting the index file.
 */
export const RESERVED_REASON_CODES = {} as const;

export type ReservedReasonCode =
  (typeof RESERVED_REASON_CODES)[keyof typeof RESERVED_REASON_CODES];

/** Returns true if the code is part of the live (Core-emitted) catalog. */
export function isLiveReasonCode(code: string): code is ReasonCode {
  return Object.values(REASON_CODES).includes(code as ReasonCode);
}

/** Returns true if the code is in the reserved Consent/Safety namespace. */
export function isReservedReasonCode(code: string): code is ReservedReasonCode {
  return Object.values(RESERVED_REASON_CODES).includes(
    code as ReservedReasonCode,
  );
}
