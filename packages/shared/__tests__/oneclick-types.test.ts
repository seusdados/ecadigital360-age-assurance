import { describe, expect, it } from 'vitest';
import {
  OneclickFeatureNotImplementedError,
  type OneclickAgePredicate,
  type OneclickDecisionSummary,
  type OneclickRequiredAction,
  type OneclickSessionType,
  type OneclickStatus,
} from '../src/oneclick/index.ts';

describe('OneClick — types', () => {
  it('OneclickSessionType cobre os 4 casos canônicos', () => {
    const all: OneclickSessionType[] = [
      'age_verification',
      'age_verification_with_parental_consent',
      'credential_issuance',
      'proof_of_age',
    ];
    expect(all).toHaveLength(4);
  });

  it('OneclickStatus cobre o ciclo de vida completo', () => {
    const all: OneclickStatus[] = [
      'created',
      'requires_action',
      'completed',
      'failed',
      'expired',
      'cancelled',
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it('OneclickRequiredAction inclui ação para evidência parental', () => {
    const evidenceAction: OneclickRequiredAction = 'collect_parental_consent_evidence';
    expect(evidenceAction).toBe('collect_parental_consent_evidence');
  });

  it('OneclickAgePredicate inclui faixas canônicas e UNDER_13', () => {
    const predicates: OneclickAgePredicate[] = [
      'OVER_18',
      'OVER_16',
      'OVER_13',
      'AGE_13_15',
      'UNDER_13',
    ];
    expect(predicates).toContain('UNDER_13');
  });

  it('OneclickDecisionSummary é projeção mínima sem PII', () => {
    const sample: OneclickDecisionSummary = {
      decision: 'approved',
      reasonCode: 'THRESHOLD_SATISFIED',
      method: 'proof',
      assuranceLevel: 'high',
    };
    // Não deve permitir nenhum campo PII conhecido sem opt-in explícito.
    expect((sample as Record<string, unknown>).birthdate).toBeUndefined();
    expect((sample as Record<string, unknown>).name).toBeUndefined();
    expect(sample.decision).toBe('approved');
  });
});

describe('OneClick — feature not implemented error', () => {
  it('mensagem aponta para spec e política no-fake-crypto', () => {
    const err = new OneclickFeatureNotImplementedError('credential_issuance');
    expect(err.name).toBe('OneclickFeatureNotImplementedError');
    expect(err.message).toContain('credential_issuance');
    expect(err.message).toContain('docs/specs/agekey-oneclick.md');
    expect(err.message).toContain('agekey-oneclick-no-fake-crypto.md');
    expect(err.message).toContain('Refusing to fabricate verification');
  });
});
