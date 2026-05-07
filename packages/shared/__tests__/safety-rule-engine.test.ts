import { describe, expect, it } from 'vitest';
import {
  evaluateAllRules,
  type RuleConfig,
} from '../src/safety/rule-engine.ts';

const ALL_RULES_DEFAULT: RuleConfig[] = [
  {
    rule_code: 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
    enabled: true,
    severity: 'high',
    actions: ['request_step_up', 'soft_block', 'notify_safety_team'],
    config_json: {},
  },
  {
    rule_code: 'ADULT_MINOR_HIGH_FREQUENCY_24H',
    enabled: true,
    severity: 'high',
    actions: ['notify_safety_team', 'escalate_to_human_review', 'rate_limit_actor'],
    config_json: { threshold_messages: 20 },
  },
  {
    rule_code: 'MEDIA_UPLOAD_TO_MINOR',
    enabled: true,
    severity: 'medium',
    actions: ['log_only', 'request_parental_consent_check'],
    config_json: {},
  },
  {
    rule_code: 'EXTERNAL_LINK_TO_MINOR',
    enabled: true,
    severity: 'medium',
    actions: ['log_only', 'soft_block'],
    config_json: {},
  },
  {
    rule_code: 'MULTIPLE_REPORTS_AGAINST_ACTOR',
    enabled: true,
    severity: 'critical',
    actions: ['notify_safety_team', 'escalate_to_human_review', 'rate_limit_actor'],
    config_json: { threshold_reports: 3 },
  },
];

describe('Safety rule engine — UNKNOWN_TO_MINOR_PRIVATE_MESSAGE', () => {
  it('mensagem privada de unknown→minor dispara step-up', () => {
    const r = evaluateAllRules(
      {
        event_type: 'message_sent',
        relationship: 'unknown_to_minor',
        aggregates: {},
      },
      ALL_RULES_DEFAULT,
    );
    expect(r.aggregated.decision).toBe('step_up_required');
    expect(r.aggregated.reason_codes).toContain(
      'SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
    );
    expect(r.aggregated.step_up_required).toBe(true);
  });

  it('mensagem privada adult→adult não dispara nada', () => {
    const r = evaluateAllRules(
      {
        event_type: 'message_sent',
        relationship: 'adult_to_adult',
        aggregates: {},
      },
      ALL_RULES_DEFAULT,
    );
    expect(r.aggregated.decision).toBe('no_risk_signal');
    expect(r.aggregated.triggered_rules).toEqual([]);
  });
});

describe('Safety rule engine — ADULT_MINOR_HIGH_FREQUENCY_24H', () => {
  it('adulto-menor com volume acima do threshold escala para revisão', () => {
    const r = evaluateAllRules(
      {
        event_type: 'message_sent',
        relationship: 'adult_to_minor',
        aggregates: { adult_to_minor_messages_24h: 25 },
      },
      ALL_RULES_DEFAULT,
    );
    expect(r.aggregated.triggered_rules).toContain(
      'ADULT_MINOR_HIGH_FREQUENCY_24H',
    );
    expect(r.aggregated.actions).toContain('escalate_to_human_review');
    expect(r.aggregated.decision).toBe('needs_review');
  });

  it('adulto-menor abaixo do threshold não dispara high-frequency', () => {
    const r = evaluateAllRules(
      {
        event_type: 'message_sent',
        relationship: 'adult_to_minor',
        aggregates: { adult_to_minor_messages_24h: 5 },
      },
      ALL_RULES_DEFAULT,
    );
    expect(r.aggregated.triggered_rules).not.toContain(
      'ADULT_MINOR_HIGH_FREQUENCY_24H',
    );
  });
});

describe('Safety rule engine — MEDIA_UPLOAD_TO_MINOR', () => {
  it('upload de mídia para menor exige parental consent check', () => {
    const r = evaluateAllRules(
      {
        event_type: 'media_upload',
        relationship: 'adult_to_minor',
        aggregates: {},
        has_media: true,
      },
      ALL_RULES_DEFAULT,
    );
    expect(r.aggregated.parental_consent_required).toBe(true);
    expect(r.aggregated.actions).toContain('request_parental_consent_check');
  });
});

describe('Safety rule engine — EXTERNAL_LINK_TO_MINOR', () => {
  it('link externo para menor → soft_block', () => {
    const r = evaluateAllRules(
      {
        event_type: 'external_link_shared',
        relationship: 'adult_to_minor',
        aggregates: {},
        has_external_link: true,
      },
      ALL_RULES_DEFAULT,
    );
    expect(r.aggregated.actions).toContain('soft_block');
    expect(r.aggregated.decision).toBe('soft_blocked');
  });
});

describe('Safety rule engine — MULTIPLE_REPORTS_AGAINST_ACTOR', () => {
  it('reports contra ator acima do threshold escala para revisão', () => {
    const r = evaluateAllRules(
      {
        event_type: 'message_sent',
        relationship: 'adult_to_adult',
        aggregates: { reports_against_actor_7d: 5 },
      },
      ALL_RULES_DEFAULT,
    );
    expect(r.aggregated.triggered_rules).toContain(
      'MULTIPLE_REPORTS_AGAINST_ACTOR',
    );
    expect(r.aggregated.severity).toBe('critical');
  });
});

describe('Safety rule engine — sem dados', () => {
  it('contexto vazio retorna no_risk_signal', () => {
    const r = evaluateAllRules(
      {
        event_type: 'profile_view',
        relationship: 'unknown_to_unknown',
        aggregates: {},
      },
      ALL_RULES_DEFAULT,
    );
    expect(r.aggregated.decision).toBe('no_risk_signal');
    expect(r.aggregated.severity).toBe('info');
  });
});

describe('Safety rule engine — regra desabilitada', () => {
  it('regra com enabled=false não dispara', () => {
    const disabled = ALL_RULES_DEFAULT.map((r) =>
      r.rule_code === 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE'
        ? { ...r, enabled: false }
        : r,
    );
    const r = evaluateAllRules(
      {
        event_type: 'message_sent',
        relationship: 'unknown_to_minor',
        aggregates: {},
      },
      disabled,
    );
    expect(r.aggregated.triggered_rules).not.toContain(
      'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
    );
  });
});
