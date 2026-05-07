// AGENT 5 (Safety Hardening) — invariante severity↔action.
//
// Quando uma regra é avaliada como `triggered` com severity high|critical,
// a saída SEMPRE precisa carregar pelo menos uma ação de revisão humana
// (`escalate_to_human_review` ou `notify_safety_team`), mesmo se um
// override per-tenant tiver removido essas ações.
//
// Isso é defesa em profundidade contra config errado de tenant.

import { describe, expect, it } from 'vitest';
import {
  enforceSeverityActionInvariant,
  evaluateAllRules,
  type RuleConfig,
} from '../src/safety/rule-engine.ts';
import type { SafetyAction, SafetySeverity } from '../src/schemas/safety.ts';

describe('Safety rule engine — invariante severity↔action', () => {
  it('high sem human review recebe notify_safety_team automaticamente', () => {
    const out = enforceSeverityActionInvariant('high', ['log_only']);
    expect(out).toContain('notify_safety_team');
  });

  it('critical sem human review recebe notify_safety_team automaticamente', () => {
    const out = enforceSeverityActionInvariant('critical', ['log_only', 'soft_block']);
    expect(out).toContain('notify_safety_team');
  });

  it('high COM escalate_to_human_review é preservado sem alteração', () => {
    const out = enforceSeverityActionInvariant('high', [
      'escalate_to_human_review',
      'rate_limit_actor',
    ]);
    expect(out).toEqual(['escalate_to_human_review', 'rate_limit_actor']);
  });

  it('high COM notify_safety_team é preservado sem alteração', () => {
    const out = enforceSeverityActionInvariant('high', ['notify_safety_team']);
    expect(out).toEqual(['notify_safety_team']);
  });

  it('low/medium NÃO força adição de human review', () => {
    for (const sev of ['info', 'low', 'medium'] as SafetySeverity[]) {
      const out = enforceSeverityActionInvariant(sev, ['log_only']);
      expect(out).toEqual(['log_only']);
    }
  });

  it('order is preserved (audit log estabilidade)', () => {
    const input: SafetyAction[] = ['rate_limit_actor', 'soft_block', 'log_only'];
    const out = enforceSeverityActionInvariant('high', input);
    // Os 3 originais aparecem na mesma ordem; o appended é o último.
    expect(out.slice(0, 3)).toEqual(input);
    expect(out[3]).toBe('notify_safety_team');
  });
});

describe('Safety rule engine — agregação aplica invariante mesmo após override', () => {
  // Cenário: tenant configura UNKNOWN_TO_MINOR_PRIVATE_MESSAGE como
  // severity=high mas removeu ações humanas (cenário malicioso/erro).
  const CONFIGS_WITH_BAD_OVERRIDE: RuleConfig[] = [
    {
      rule_code: 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
      enabled: true,
      severity: 'high',
      // Tenant removeu notify_safety_team — invariante deve recolocar.
      actions: ['log_only'],
      config_json: {},
    },
  ];

  it('regra triggered com severity=high reinjeta notify_safety_team', () => {
    const r = evaluateAllRules(
      {
        event_type: 'message_sent',
        relationship: 'unknown_to_minor',
        aggregates: {},
      },
      CONFIGS_WITH_BAD_OVERRIDE,
    );
    expect(r.aggregated.severity).toBe('high');
    expect(r.aggregated.actions).toContain('notify_safety_team');
  });

  it('regra triggered com severity=critical reinjeta notify_safety_team', () => {
    const configs: RuleConfig[] = [
      {
        rule_code: 'MULTIPLE_REPORTS_AGAINST_ACTOR',
        enabled: true,
        severity: 'critical',
        actions: ['log_only'], // override ruim do tenant
        config_json: { threshold_reports: 1 },
      },
    ];
    const r = evaluateAllRules(
      {
        event_type: 'report_filed',
        relationship: 'unknown_to_unknown',
        aggregates: { reports_against_actor_7d: 5 },
      },
      configs,
    );
    expect(r.aggregated.severity).toBe('critical');
    expect(r.aggregated.actions).toContain('notify_safety_team');
  });

  it('agregado com severity=medium não recebe forced action', () => {
    const configs: RuleConfig[] = [
      {
        rule_code: 'MEDIA_UPLOAD_TO_MINOR',
        enabled: true,
        severity: 'medium',
        actions: ['log_only'],
        config_json: {},
      },
    ];
    const r = evaluateAllRules(
      {
        event_type: 'media_upload',
        relationship: 'adult_to_minor',
        aggregates: {},
        has_media: true,
      },
      configs,
    );
    expect(r.aggregated.severity).toBe('medium');
    expect(r.aggregated.actions).not.toContain('notify_safety_team');
    expect(r.aggregated.actions).not.toContain('escalate_to_human_review');
  });
});
