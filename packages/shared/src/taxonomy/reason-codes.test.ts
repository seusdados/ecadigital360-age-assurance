import { describe, expect, it } from 'vitest';
import { REASON_CODES } from '../reason-codes.ts';
import {
  REASON_CODE_CATEGORIES,
  RESERVED_REASON_CODES,
  categorizeReasonCode,
  isLiveReasonCode,
  isReservedReasonCode,
} from './reason-codes.ts';

describe('reason-code taxonomy', () => {
  it('classifies live reason codes by prefix', () => {
    expect(categorizeReasonCode(REASON_CODES.THRESHOLD_SATISFIED)).toBe(
      REASON_CODE_CATEGORIES.positive,
    );
    expect(categorizeReasonCode(REASON_CODES.ZKP_PROOF_INVALID)).toBe(
      REASON_CODE_CATEGORIES.zkp,
    );
    expect(categorizeReasonCode(REASON_CODES.VC_SIGNATURE_INVALID)).toBe(
      REASON_CODE_CATEGORIES.vc,
    );
    expect(categorizeReasonCode(REASON_CODES.GATEWAY_PROVIDER_ERROR)).toBe(
      REASON_CODE_CATEGORIES.gateway,
    );
    expect(categorizeReasonCode(REASON_CODES.FALLBACK_RISK_HIGH)).toBe(
      REASON_CODE_CATEGORIES.fallback,
    );
    expect(categorizeReasonCode(REASON_CODES.POLICY_ASSURANCE_UNMET)).toBe(
      REASON_CODE_CATEGORIES.policy,
    );
    expect(categorizeReasonCode(REASON_CODES.SESSION_EXPIRED)).toBe(
      REASON_CODE_CATEGORIES.session,
    );
    expect(categorizeReasonCode(REASON_CODES.RATE_LIMIT_EXCEEDED)).toBe(
      REASON_CODE_CATEGORIES.request,
    );
    expect(categorizeReasonCode(REASON_CODES.INTERNAL_ERROR)).toBe(
      REASON_CODE_CATEGORIES.internal,
    );
  });

  it('routes promoted parental_consent codes to the consent category', () => {
    // Round 3 promoted CONSENT_* from RESERVED to LIVE.
    expect(categorizeReasonCode(REASON_CODES.CONSENT_GRANTED)).toBe(
      REASON_CODE_CATEGORIES.consent,
    );
    expect(categorizeReasonCode(REASON_CODES.CONSENT_REVOKED)).toBe(
      REASON_CODE_CATEGORIES.consent,
    );
    expect(isLiveReasonCode(REASON_CODES.CONSENT_GRANTED)).toBe(true);
    expect(isReservedReasonCode(REASON_CODES.CONSENT_GRANTED)).toBe(false);
  });

  it('routes promoted safety_signals codes to the safety category', () => {
    // Round 4 promoted SAFETY_* from RESERVED to LIVE.
    expect(categorizeReasonCode(REASON_CODES.SAFETY_RISK_FLAGGED)).toBe(
      REASON_CODE_CATEGORIES.safety,
    );
    expect(categorizeReasonCode(REASON_CODES.SAFETY_STEP_UP_REQUIRED)).toBe(
      REASON_CODE_CATEGORIES.safety,
    );
    expect(isLiveReasonCode(REASON_CODES.SAFETY_RISK_FLAGGED)).toBe(true);
    expect(isReservedReasonCode(REASON_CODES.SAFETY_RISK_FLAGGED)).toBe(false);
  });

  it('separates live and reserved namespaces', () => {
    for (const code of Object.values(REASON_CODES)) {
      expect(isLiveReasonCode(code)).toBe(true);
      expect(isReservedReasonCode(code)).toBe(false);
    }
    for (const code of Object.values(RESERVED_REASON_CODES)) {
      expect(isReservedReasonCode(code)).toBe(true);
      expect(isLiveReasonCode(code)).toBe(false);
    }
  });

  it('does not collide between live and reserved codes', () => {
    const live = new Set(Object.values(REASON_CODES));
    for (const reserved of Object.values(RESERVED_REASON_CODES)) {
      expect(live.has(reserved as never)).toBe(false);
    }
  });
});
