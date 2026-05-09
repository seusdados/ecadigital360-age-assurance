import { describe, expect, it } from 'vitest';
import {
  DecisionEnvelopeSchema,
  createDecisionEnvelope,
  isPendingDecision,
  isTerminalDecision,
} from '../src/decision/index.ts';
import { isPayloadSafe } from '../src/privacy/index.ts';

describe('Decision Envelope — formato canônico', () => {
  it('cria envelope com content_included/pii_included literais false', () => {
    const env = createDecisionEnvelope({
      decision_domain: 'age_verify',
      decision: 'approved',
      reason_code: 'AGE_POLICY_SATISFIED',
    });
    expect(env.content_included).toBe(false);
    expect(env.pii_included).toBe(false);
  });

  it('exige reason_code não-vazio', () => {
    expect(() =>
      createDecisionEnvelope({
        decision_domain: 'age_verify',
        decision: 'approved',
        reason_code: '',
      }),
    ).toThrow();
  });

  it('rejeita campos extras (strict)', () => {
    const malformed = {
      decision_domain: 'age_verify',
      decision: 'approved',
      reason_code: 'AGE_POLICY_SATISFIED',
      content_included: false,
      pii_included: false,
      // Campo extra:
      civil_name: 'Joao',
    };
    expect(() => DecisionEnvelopeSchema.parse(malformed)).toThrow();
  });

  it('envelope válido passa pelo privacy guard public_api_response', () => {
    const env = createDecisionEnvelope({
      decision_domain: 'parental_consent',
      decision: 'pending_guardian',
      reason_code: 'CONSENT_PENDING_GUARDIAN',
      tenant_id: '018f7b8c-dddd-eeee-ffff-2b31319d6eaf',
      application_id: '018f7b8c-2222-3333-4444-2b31319d6eaf',
      policy_id: '018f7b8c-5555-6666-7777-2b31319d6eaf',
      policy_version: '1',
      resource: 'feed/post-creation',
      parental_consent_required: true,
    });
    expect(isPayloadSafe(env, 'public_api_response')).toBe(true);
    expect(isPayloadSafe(env, 'webhook')).toBe(true);
    expect(isPayloadSafe(env, 'sdk_response')).toBe(true);
  });

  it('envelope com policy_age_threshold (regra) é seguro', () => {
    const env = {
      ...createDecisionEnvelope({
        decision_domain: 'age_verify',
        decision: 'approved',
        reason_code: 'AGE_POLICY_SATISFIED',
      }),
      // O envelope canônico não carrega policy_age_threshold em campo
      // próprio, mas não pode ser bloqueado se aparecer em payload
      // composto pelo módulo (ex.: agrupado com snapshot da policy).
    };
    expect(isPayloadSafe({ ...env, policy_age_threshold: '18+' }, 'webhook')).toBe(
      true,
    );
  });

  it('isTerminalDecision identifica estados finais', () => {
    expect(isTerminalDecision('approved')).toBe(true);
    expect(isTerminalDecision('denied')).toBe(true);
    expect(isTerminalDecision('expired')).toBe(true);
    expect(isTerminalDecision('revoked')).toBe(true);
    expect(isTerminalDecision('blocked_by_policy')).toBe(true);
    expect(isTerminalDecision('hard_blocked')).toBe(true);
    expect(isTerminalDecision('pending')).toBe(false);
  });

  it('isPendingDecision identifica estados pendentes', () => {
    expect(isPendingDecision('pending')).toBe(true);
    expect(isPendingDecision('pending_guardian')).toBe(true);
    expect(isPendingDecision('pending_verification')).toBe(true);
    expect(isPendingDecision('needs_review')).toBe(true);
    expect(isPendingDecision('step_up_required')).toBe(true);
    expect(isPendingDecision('approved')).toBe(false);
  });

  describe('expires_at — datetime com timezone offset (RFC 3339)', () => {
    function build(expiresAt: string) {
      return createDecisionEnvelope({
        decision_domain: 'parental_consent',
        decision: 'pending_guardian',
        reason_code: 'CONSENT_PENDING_GUARDIAN',
        expires_at: expiresAt,
      });
    }

    it('aceita formato Z (UTC)', () => {
      const env = build('2026-05-10T12:59:51.658Z');
      expect(env.expires_at).toBe('2026-05-10T12:59:51.658Z');
    });

    it('aceita offset +00:00 (Postgres timestamptz UTC)', () => {
      const env = build('2026-05-10T12:59:51.658+00:00');
      expect(env.expires_at).toBe('2026-05-10T12:59:51.658+00:00');
    });

    it('aceita offset positivo não-UTC', () => {
      const env = build('2026-05-10T12:59:51.658+02:00');
      expect(env.expires_at).toBe('2026-05-10T12:59:51.658+02:00');
    });

    it('aceita offset negativo', () => {
      const env = build('2026-05-10T09:59:51.658-03:00');
      expect(env.expires_at).toBe('2026-05-10T09:59:51.658-03:00');
    });

    it('aceita formato sem milissegundos', () => {
      const env = build('2026-05-10T12:59:51+00:00');
      expect(env.expires_at).toBe('2026-05-10T12:59:51+00:00');
    });

    it('rejeita string que não é datetime ISO 8601', () => {
      expect(() => build('not-a-datetime')).toThrow();
    });

    it('rejeita formato com espaço no lugar do T', () => {
      expect(() => build('2026-05-10 12:59:51+00:00')).toThrow();
    });

    it('rejeita timestamp sem timezone (naive)', () => {
      expect(() => build('2026-05-10T12:59:51')).toThrow();
    });
  });
});
