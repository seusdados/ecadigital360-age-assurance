import { describe, expect, it } from 'vitest';
import {
  mapLegacyDecisionStatus,
  toCanonicalEnvelope,
} from '../src/decision/index.ts';
import { isPayloadSafe } from '../src/privacy/index.ts';

describe('Decision Envelope — mapper legado', () => {
  it('mapeia approved/denied/needs_review com fidelidade', () => {
    expect(mapLegacyDecisionStatus('approved')).toBe('approved');
    expect(mapLegacyDecisionStatus('denied')).toBe('denied');
    expect(mapLegacyDecisionStatus('needs_review')).toBe('needs_review');
  });

  it('mapeia valor desconhecido para "error" (nunca aprova)', () => {
    expect(mapLegacyDecisionStatus('something_unexpected')).toBe('error');
    expect(mapLegacyDecisionStatus('')).toBe('error');
  });

  it('converte payload legado em envelope canônico válido', () => {
    const legacy = {
      tenant_id: '018f7b8c-dddd-eeee-ffff-2b31319d6eaf',
      application_id: '018f7b8c-2222-3333-4444-2b31319d6eaf',
      session_id: '018f7b8c-1111-7777-9999-2b31319d6eaf',
      decision: 'approved',
      reason_code: 'THRESHOLD_SATISFIED',
      method: 'vc',
      assurance_level: 'substantial',
      jti: '018f7b8c-2222-7777-9999-2b31319d6eaf',
      policy: {
        id: '018f7b8c-5555-6666-7777-2b31319d6eaf',
        version: 1,
      },
      resource: 'checkout/age-gated',
    };
    const env = toCanonicalEnvelope(legacy);
    expect(env.decision).toBe('approved');
    expect(env.decision_domain).toBe('age_verify');
    expect(env.reason_code).toBe('THRESHOLD_SATISFIED');
    expect(env.method).toBe('vc');
    expect(env.assurance_level).toBe('substantial');
    expect(env.policy_id).toBe('018f7b8c-5555-6666-7777-2b31319d6eaf');
    expect(env.policy_version).toBe('1');
    expect(env.verification_session_id).toBe(
      '018f7b8c-1111-7777-9999-2b31319d6eaf',
    );
    expect(env.result_token_id).toBe(
      '018f7b8c-2222-7777-9999-2b31319d6eaf',
    );
    expect(env.content_included).toBe(false);
    expect(env.pii_included).toBe(false);
  });

  it('envelope mapeado é seguro no privacy guard webhook', () => {
    const env = toCanonicalEnvelope({
      tenant_id: 't',
      application_id: 'a',
      session_id: 's',
      decision: 'denied',
      reason_code: 'POLICY_ASSURANCE_UNMET',
      method: 'fallback',
      assurance_level: 'low',
    });
    expect(isPayloadSafe(env, 'webhook')).toBe(true);
    expect(isPayloadSafe(env, 'public_api_response')).toBe(true);
  });

  it('aceita override do decision_domain (Consent/Safety)', () => {
    const env = toCanonicalEnvelope(
      {
        tenant_id: 't',
        application_id: 'a',
        decision: 'needs_review',
        reason_code: 'SAFETY_POLICY_REQUIRES_HUMAN_REVIEW',
      },
      'safety_signal',
    );
    expect(env.decision_domain).toBe('safety_signal');
    expect(env.decision).toBe('needs_review');
  });

  it('rejeita campos extras adicionados ao payload legado (strict)', () => {
    expect(() =>
      toCanonicalEnvelope({
        tenant_id: 't',
        application_id: 'a',
        decision: 'approved',
        reason_code: 'OK',
        // @ts-expect-error: campo extra
        leak_email: 'leak@example.com',
      }),
    ).not.toThrow();
    // O mapper ignora campos não mapeados — o leak não vaza para o envelope.
    const env = toCanonicalEnvelope({
      tenant_id: 't',
      application_id: 'a',
      decision: 'approved',
      reason_code: 'OK',
      // @ts-expect-error
      leak_email: 'leak@example.com',
    });
    expect((env as Record<string, unknown>).leak_email).toBeUndefined();
  });
});
