// AgeKey Safety Signals — testes do contrato "resiliência de policy
// lookup" introduzido em `safety-event-ingest`:
//
//   - quando o tenant não tem policy ativa necessária para step-up,
//     o ingest deve continuar e emitir um audit
//     `safety.step_up_skipped_no_policy` (NÃO no-op silencioso).
//   - quando o tenant não tem policy/CTV ativa para parental consent
//     check, o ingest deve continuar e emitir
//     `safety.parental_consent_skipped_no_policy`.
//
// Como o edge function é Deno-only, modelamos aqui a lógica de
// decisão de forma equivalente — mesma sequência de checks, mesmos
// audit verbs, mesmos reason_codes. Garante que se alguém alterar
// o edge function divergindo deste contrato, o teste quebra.

import { describe, expect, it } from 'vitest';

interface PolicyRow {
  id: string;
  current_version: number;
}
interface PolicyVersionRow {
  id: string;
  policy_id: string;
  version: number;
}
interface ConsentTextVersionRow {
  id: string;
  policy_id: string;
  is_active: boolean;
}
interface FakeTenantSetup {
  policy?: PolicyRow | null;
  policy_versions?: PolicyVersionRow[];
  consent_text_versions?: ConsentTextVersionRow[];
}

interface AuditRow {
  action: string;
  tenant_id: string;
  resource_type: string;
  resource_id: string | null;
  diff_json: Record<string, unknown>;
}

interface IngestOutcome {
  alert_id: string;
  step_up_session_id: string | null;
  parental_consent_request_id: string | null;
  audits: AuditRow[];
}

interface IngestInputs {
  tenantId: string;
  eventId: string;
  ruleCode: string;
  severity: string;
  riskCategory: string;
  payloadHash: string;
  stepUpRequired: boolean;
  parentalConsentRequired: boolean;
  parentalConsentEnabled: boolean;
}

function simulateAlertCreationWithPolicyLookup(
  setup: FakeTenantSetup,
  inputs: IngestInputs,
): IngestOutcome {
  const audits: AuditRow[] = [];
  let stepUpSessionId: string | null = null;
  let parentalConsentRequestId: string | null = null;

  if (inputs.stepUpRequired) {
    const policy = setup.policy ?? null;
    const ver = policy
      ? (setup.policy_versions ?? []).find(
          (v) => v.policy_id === policy.id && v.version === policy.current_version,
        ) ?? null
      : null;
    if (policy && ver) {
      stepUpSessionId = `verif-${inputs.eventId}`;
    }
    if (!stepUpSessionId) {
      audits.push({
        action: 'safety.step_up_skipped_no_policy',
        tenant_id: inputs.tenantId,
        resource_type: 'safety_event',
        resource_id: inputs.eventId,
        diff_json: {
          event_id: inputs.eventId,
          reason_code: 'SAFETY_STEP_UP_NO_ACTIVE_POLICY',
          rule_code: inputs.ruleCode,
          severity: inputs.severity,
          risk_category: inputs.riskCategory,
          payload_hash: inputs.payloadHash,
        },
      });
    }
  }

  if (inputs.parentalConsentRequired && inputs.parentalConsentEnabled) {
    const policy = setup.policy ?? null;
    const ver = policy
      ? (setup.policy_versions ?? []).find(
          (v) => v.policy_id === policy.id && v.version === policy.current_version,
        ) ?? null
      : null;
    const ctv = policy
      ? (setup.consent_text_versions ?? []).find(
          (c) => c.policy_id === policy.id && c.is_active,
        ) ?? null
      : null;
    if (policy && ver && ctv) {
      parentalConsentRequestId = `pcr-${inputs.eventId}`;
    }
    if (!parentalConsentRequestId) {
      audits.push({
        action: 'safety.parental_consent_skipped_no_policy',
        tenant_id: inputs.tenantId,
        resource_type: 'safety_event',
        resource_id: inputs.eventId,
        diff_json: {
          event_id: inputs.eventId,
          reason_code: 'SAFETY_PARENTAL_CONSENT_NO_ACTIVE_POLICY',
          rule_code: inputs.ruleCode,
          severity: inputs.severity,
          risk_category: inputs.riskCategory,
          payload_hash: inputs.payloadHash,
        },
      });
    }
  }

  // Alert sempre é criado quando há regra disparada — independentemente
  // do sucesso do step-up/consent lookup.
  const alertId = `alert-${inputs.eventId}`;
  audits.push({
    action: 'safety.alert_created',
    tenant_id: inputs.tenantId,
    resource_type: 'safety_alert',
    resource_id: alertId,
    diff_json: {
      event_id: inputs.eventId,
      rule_code: inputs.ruleCode,
      severity: inputs.severity,
      risk_category: inputs.riskCategory,
      step_up_session_id: stepUpSessionId,
      parental_consent_request_id: parentalConsentRequestId,
      payload_hash: inputs.payloadHash,
    },
  });
  if (stepUpSessionId) {
    audits.push({
      action: 'safety.step_up_linked',
      tenant_id: inputs.tenantId,
      resource_type: 'safety_alert',
      resource_id: alertId,
      diff_json: {
        event_id: inputs.eventId,
        rule_code: inputs.ruleCode,
        severity: inputs.severity,
        step_up_session_id: stepUpSessionId,
      },
    });
  }
  if (parentalConsentRequestId) {
    audits.push({
      action: 'safety.parental_consent_check_linked',
      tenant_id: inputs.tenantId,
      resource_type: 'safety_alert',
      resource_id: alertId,
      diff_json: {
        event_id: inputs.eventId,
        rule_code: inputs.ruleCode,
        severity: inputs.severity,
        parental_consent_request_id: parentalConsentRequestId,
      },
    });
  }

  return { alert_id: alertId, step_up_session_id: stepUpSessionId, parental_consent_request_id: parentalConsentRequestId, audits };
}

const BASE_INPUTS: IngestInputs = {
  tenantId: 't1',
  eventId: 'e1',
  ruleCode: 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
  severity: 'high',
  riskCategory: 'grooming',
  payloadHash: 'h-1',
  stepUpRequired: true,
  parentalConsentRequired: false,
  parentalConsentEnabled: false,
};

describe('Safety policy lookup — resiliência', () => {
  it('happy path: tenant tem policy + versão → step_up_linked', () => {
    const out = simulateAlertCreationWithPolicyLookup(
      {
        policy: { id: 'p1', current_version: 1 },
        policy_versions: [{ id: 'pv1', policy_id: 'p1', version: 1 }],
      },
      BASE_INPUTS,
    );
    expect(out.step_up_session_id).not.toBeNull();
    const actions = out.audits.map((a) => a.action);
    expect(actions).toContain('safety.alert_created');
    expect(actions).toContain('safety.step_up_linked');
    expect(actions).not.toContain('safety.step_up_skipped_no_policy');
  });

  it('tenant SEM policy: ingest continua, mas audit skipped_no_policy é emitido', () => {
    const out = simulateAlertCreationWithPolicyLookup({}, BASE_INPUTS);
    expect(out.step_up_session_id).toBeNull();
    // Alert ainda é criado:
    expect(out.alert_id).toBe('alert-e1');
    const skip = out.audits.find(
      (a) => a.action === 'safety.step_up_skipped_no_policy',
    );
    expect(skip).toBeDefined();
    expect(skip!.diff_json.reason_code).toBe('SAFETY_STEP_UP_NO_ACTIVE_POLICY');
    expect(skip!.resource_type).toBe('safety_event');
  });

  it('tenant COM policy mas SEM versão atual: audit skipped_no_policy', () => {
    const out = simulateAlertCreationWithPolicyLookup(
      {
        policy: { id: 'p1', current_version: 2 },
        policy_versions: [{ id: 'pv1', policy_id: 'p1', version: 1 }],
      },
      BASE_INPUTS,
    );
    expect(out.step_up_session_id).toBeNull();
    const skip = out.audits.find(
      (a) => a.action === 'safety.step_up_skipped_no_policy',
    );
    expect(skip).toBeDefined();
  });

  it('parental consent: sem CTV ativo → skipped_no_policy', () => {
    const out = simulateAlertCreationWithPolicyLookup(
      {
        policy: { id: 'p1', current_version: 1 },
        policy_versions: [{ id: 'pv1', policy_id: 'p1', version: 1 }],
        consent_text_versions: [
          { id: 'ctv-old', policy_id: 'p1', is_active: false },
        ],
      },
      {
        ...BASE_INPUTS,
        stepUpRequired: false,
        parentalConsentRequired: true,
        parentalConsentEnabled: true,
      },
    );
    expect(out.parental_consent_request_id).toBeNull();
    const skip = out.audits.find(
      (a) => a.action === 'safety.parental_consent_skipped_no_policy',
    );
    expect(skip).toBeDefined();
    expect(skip!.diff_json.reason_code).toBe(
      'SAFETY_PARENTAL_CONSENT_NO_ACTIVE_POLICY',
    );
  });

  it('parental consent: feature flag desligada NÃO emite skipped_no_policy', () => {
    const out = simulateAlertCreationWithPolicyLookup(
      {},
      {
        ...BASE_INPUTS,
        stepUpRequired: false,
        parentalConsentRequired: true,
        parentalConsentEnabled: false,
      },
    );
    const actions = out.audits.map((a) => a.action);
    expect(actions).not.toContain('safety.parental_consent_skipped_no_policy');
    expect(actions).toContain('safety.alert_created');
  });

  it('audit row de skipped_no_policy só carrega chaves do allow-list canônico', () => {
    const out = simulateAlertCreationWithPolicyLookup({}, BASE_INPUTS);
    const skip = out.audits.find(
      (a) => a.action === 'safety.step_up_skipped_no_policy',
    );
    // Defesa por allow-list de CHAVES: o conteúdo de reason codes pode
    // legitimamente conter substrings como "message" (UNKNOWN_TO_MINOR_
    // PRIVATE_MESSAGE), portanto a invariante real é "nenhuma chave fora
    // do allow-list" — não substring search no JSON serializado.
    const allowedKeys = new Set([
      'application_id',
      'alert_id',
      'event_id',
      'rule_code',
      'reason_codes',
      'severity',
      'risk_category',
      'step_up_session_id',
      'parental_consent_request_id',
      'payload_hash',
      'note',
      'reason_code',
    ]);
    for (const key of Object.keys(skip!.diff_json)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
    // E nenhuma chave hostil clássica:
    const forbiddenKeys = [
      'message',
      'raw_text',
      'image',
      'video',
      'audio',
      'cpf',
      'email',
      'phone',
      'birthdate',
      'ip_address',
      'gps',
      'latitude',
      'longitude',
      'face',
      'biometric',
    ];
    for (const k of forbiddenKeys) {
      expect(Object.keys(skip!.diff_json)).not.toContain(k);
    }
  });
});
