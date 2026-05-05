import { describe, expect, it } from 'vitest';
import {
  SafetyRulePatchRequestSchema,
  SafetyRuleWriteRequestSchema,
} from '../src/schemas/safety.ts';

describe('SafetyRuleWriteRequestSchema (POST)', () => {
  it('aceita body válido', () => {
    const ok = SafetyRuleWriteRequestSchema.parse({
      rule_code: 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
      enabled: true,
      severity: 'high',
      actions: ['request_step_up', 'soft_block'],
      config_json: { custom: 1 },
    });
    expect(ok.actions.length).toBe(2);
  });

  it('rejeita rule_code inválido', () => {
    expect(() =>
      SafetyRuleWriteRequestSchema.parse({
        rule_code: 'NOT_A_RULE',
        enabled: true,
        severity: 'high',
        actions: ['log_only'],
        config_json: {},
      }),
    ).toThrow();
  });

  it('rejeita severidade inválida', () => {
    expect(() =>
      SafetyRuleWriteRequestSchema.parse({
        rule_code: 'EXTERNAL_LINK_TO_MINOR',
        enabled: true,
        severity: 'extreme',
        actions: ['log_only'],
        config_json: {},
      }),
    ).toThrow();
  });

  it('rejeita actions vazio', () => {
    expect(() =>
      SafetyRuleWriteRequestSchema.parse({
        rule_code: 'EXTERNAL_LINK_TO_MINOR',
        enabled: true,
        severity: 'medium',
        actions: [],
        config_json: {},
      }),
    ).toThrow();
  });

  it('rejeita campo extra (strict)', () => {
    expect(() =>
      SafetyRuleWriteRequestSchema.parse({
        rule_code: 'EXTERNAL_LINK_TO_MINOR',
        enabled: true,
        severity: 'medium',
        actions: ['log_only'],
        config_json: {},
        tenant_id: 'tentativa-de-override',
      }),
    ).toThrow();
  });
});

describe('SafetyRulePatchRequestSchema (PATCH)', () => {
  it('aceita pelo menos um campo', () => {
    expect(() => SafetyRulePatchRequestSchema.parse({ enabled: false })).not.toThrow();
  });

  it('rejeita body vazio', () => {
    expect(() => SafetyRulePatchRequestSchema.parse({})).toThrow();
  });

  it('rejeita campo extra', () => {
    expect(() =>
      SafetyRulePatchRequestSchema.parse({
        enabled: true,
        rule_code: 'changing_rule_code_not_allowed',
      }),
    ).toThrow();
  });
});
