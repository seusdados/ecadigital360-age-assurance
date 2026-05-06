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

  it('routes reserved codes to their module category', () => {
    expect(categorizeReasonCode(RESERVED_REASON_CODES.CONSENT_NOT_GIVEN)).toBe(
      REASON_CODE_CATEGORIES.consent,
    );
    expect(categorizeReasonCode(RESERVED_REASON_CODES.SAFETY_RISK_FLAGGED)).toBe(
      REASON_CODE_CATEGORIES.safety,
    );
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
