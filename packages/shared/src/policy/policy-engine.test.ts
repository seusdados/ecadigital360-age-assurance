import { describe, expect, it } from 'vitest';
import {
  type AdapterAvailability,
  buildDecisionEnvelope,
  deriveAdapterAvailability,
  evaluatePolicy,
  meetsAssurance,
  selectAdapterMethod,
} from './policy-engine.ts';
import type { PolicyDefinition } from './policy-types.ts';
import { REASON_CODES } from '../reason-codes.ts';
import { DECISION_ENVELOPE_VERSION } from '../decision/decision-envelope.ts';

const POLICY: PolicyDefinition = {
  id: '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf',
  tenant_id: '018f7b8c-dddd-eeee-ffff-2b31319d6eaf',
  slug: 'br-18-plus',
  name: 'Brazil 18+',
  age_threshold: 18,
  age_band: null,
  jurisdiction_code: 'BR',
  method_priority: ['zkp', 'vc', 'gateway', 'fallback'],
  required_assurance_level: 'substantial',
  token_ttl_seconds: 3600,
  current_version: 1,
  is_template: false,
};

const TENANT = POLICY.tenant_id!;
const APPLICATION = '018f7b8c-2222-3333-4444-2b31319d6eaf';
const SESSION = '018f7b8c-aaaa-1111-2222-2b31319d6eaf';

const FULL_AVAILABILITY: AdapterAvailability = {
  zkp: true,
  vc: true,
  gateway: true,
  fallback: true,
};

describe('selectAdapterMethod', () => {
  it('returns the first available method in priority order', () => {
    expect(selectAdapterMethod(POLICY, FULL_AVAILABILITY)).toBe('zkp');
    expect(
      selectAdapterMethod(POLICY, { ...FULL_AVAILABILITY, zkp: false }),
    ).toBe('vc');
    expect(
      selectAdapterMethod(POLICY, {
        zkp: false,
        vc: false,
        gateway: false,
        fallback: true,
      }),
    ).toBe('fallback');
  });

  it('returns null when nothing is available', () => {
    expect(
      selectAdapterMethod(POLICY, {
        zkp: false,
        vc: false,
        gateway: false,
        fallback: false,
      }),
    ).toBeNull();
  });
});

describe('deriveAdapterAvailability', () => {
  it('treats wallet-less clients as zkp-unavailable', () => {
    expect(deriveAdapterAvailability({})).toMatchObject({
      zkp: false,
      gateway: true,
      fallback: true,
    });
  });

  it('enables zkp when a wallet is reported', () => {
    expect(deriveAdapterAvailability({ wallet_present: true })).toMatchObject({
      zkp: true,
      vc: true,
    });
  });

  it('enables vc via the digital credentials API even without a wallet', () => {
    expect(
      deriveAdapterAvailability({ digital_credentials_api: true }),
    ).toMatchObject({ zkp: false, vc: true });
  });
});

describe('meetsAssurance', () => {
  it('respects the low < substantial < high ladder', () => {
    expect(meetsAssurance('high', 'substantial')).toBe(true);
    expect(meetsAssurance('substantial', 'substantial')).toBe(true);
    expect(meetsAssurance('low', 'substantial')).toBe(false);
  });
});

describe('evaluatePolicy', () => {
  it('approves when threshold satisfied and assurance met', () => {
    const result = evaluatePolicy(POLICY, {
      method: 'gateway',
      threshold_satisfied: true,
      reported_assurance: 'substantial',
      reason_code: REASON_CODES.THRESHOLD_SATISFIED,
      evidence: {},
    });
    expect(result.decision).toBe('approved');
    expect(result.reason_code).toBe(REASON_CODES.THRESHOLD_SATISFIED);
  });

  it('denies when adapter says threshold not satisfied (preserves adapter reason)', () => {
    const result = evaluatePolicy(POLICY, {
      method: 'vc',
      threshold_satisfied: false,
      reported_assurance: 'substantial',
      reason_code: REASON_CODES.VC_EXPIRED,
      evidence: {},
    });
    expect(result.decision).toBe('denied');
    expect(result.reason_code).toBe(REASON_CODES.VC_EXPIRED);
  });

  it('denies and rewrites reason_code when assurance is below required', () => {
    const result = evaluatePolicy(POLICY, {
      method: 'fallback',
      threshold_satisfied: true,
      reported_assurance: 'low',
      reason_code: REASON_CODES.FALLBACK_DECLARATION_ACCEPTED,
      evidence: {},
    });
    expect(result.decision).toBe('denied');
    expect(result.reason_code).toBe(REASON_CODES.POLICY_ASSURANCE_UNMET);
  });

  it('denies when threshold_satisfied is null (neutral)', () => {
    const result = evaluatePolicy(POLICY, {
      method: 'zkp',
      threshold_satisfied: null,
      reported_assurance: 'substantial',
      reason_code: REASON_CODES.ZKP_PROOF_INVALID,
      evidence: {},
    });
    expect(result.decision).toBe('denied');
  });
});

describe('buildDecisionEnvelope', () => {
  it('builds a valid public-safe envelope for an approved decision', () => {
    const envelope = buildDecisionEnvelope({
      policy: POLICY,
      tenant_id: TENANT,
      application_id: APPLICATION,
      session_id: SESSION,
      attestation: {
        method: 'gateway',
        threshold_satisfied: true,
        reported_assurance: 'substantial',
        reason_code: REASON_CODES.THRESHOLD_SATISFIED,
        evidence: { format: 'jws' },
      },
      external_user_ref: null,
      now_seconds: 1_780_000_000,
    });
    expect(envelope.envelope_version).toBe(DECISION_ENVELOPE_VERSION);
    expect(envelope.decision).toBe('approved');
    expect(envelope.expires_at).toBe(1_780_000_000 + POLICY.token_ttl_seconds);
    expect(envelope.policy.version).toBe(POLICY.current_version);
  });

  it('throws when evidence carries a PII key', () => {
    expect(() =>
      buildDecisionEnvelope({
        policy: POLICY,
        tenant_id: TENANT,
        application_id: APPLICATION,
        session_id: SESSION,
        attestation: {
          method: 'gateway',
          threshold_satisfied: true,
          reported_assurance: 'substantial',
          reason_code: REASON_CODES.THRESHOLD_SATISFIED,
          evidence: { extra: { cpf: '12345678909' } },
        },
        external_user_ref: null,
        now_seconds: 1_780_000_000,
      }),
    ).toThrow(/forbidden PII-like keys/);
  });
});
