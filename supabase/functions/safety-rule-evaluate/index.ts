// POST /v1/safety/rule-evaluate
//
// Read-only: avalia o que ACONTECERIA para um par {actor, counterparty,
// event_type} sem persistir nada. Usado pelo SDK
// `agekey.safety.getDecision()` e pelo dashboard admin.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  jsonResponse,
  respondError,
  InvalidRequestError,
  ForbiddenError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import {
  SafetyGetDecisionRequestSchema,
  type SafetyGetDecisionResponse,
} from '../../../packages/shared/src/schemas/safety.ts';
import {
  deriveRelationship,
  evaluateAllRules,
  type RuleConfig,
} from '../../../packages/shared/src/safety/index.ts';
import { readSafetyFlags } from '../_shared/safety/feature-flags.ts';
import { assertPayloadSafe } from '../../../packages/shared/src/privacy/index.ts';

const FN = 'safety-rule-evaluate';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };

  if (req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const flags = readSafetyFlags();
    if (!flags.enabled) {
      throw new ForbiddenError('Safety Signals module disabled.');
    }

    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    assertPayloadSafe(body, 'safety_event_v1');
    const parsed = SafetyGetDecisionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const input = parsed.data;

    const relationship = deriveRelationship(
      input.actor_age_state ?? null,
      input.counterparty_age_state ?? null,
    );

    // Aggregates: lê pelo subject_ref_hmac. Se não há subject ainda,
    // usa zeros (caller faz pré-flight antes de qualquer evento).
    let messages = 0;
    let reports = 0;
    if (input.counterparty_subject_ref_hmac) {
      const { data: counterparty } = await client
        .from('safety_subjects')
        .select('id')
        .eq('tenant_id', principal.tenantId)
        .eq('application_id', principal.applicationId)
        .eq('subject_ref_hmac', input.counterparty_subject_ref_hmac)
        .maybeSingle();
      if (counterparty) {
        const { data: aggA } = await client
          .from('safety_aggregates')
          .select('value')
          .eq('subject_id', (counterparty as { id: string }).id)
          .eq('aggregate_key', 'adult_to_minor_messages_24h')
          .eq('window', '24h')
          .maybeSingle();
        const { data: aggR } = await client
          .from('safety_aggregates')
          .select('value')
          .eq('subject_id', (counterparty as { id: string }).id)
          .eq('aggregate_key', 'reports_against_actor_7d')
          .eq('window', '7d')
          .maybeSingle();
        messages = ((aggA as { value?: number } | null)?.value ?? 0) as number;
        reports = ((aggR as { value?: number } | null)?.value ?? 0) as number;
      }
    }

    const { data: ruleRows } = await client
      .from('safety_rules')
      .select('rule_code, enabled, severity, actions, config_json, tenant_id')
      .or(`tenant_id.eq.${principal.tenantId},tenant_id.is.null`);

    const byCode = new Map<string, RuleConfig>();
    for (const r of (ruleRows ?? []) as Array<{
      rule_code: string;
      enabled: boolean;
      severity: string;
      actions: string[];
      config_json: Record<string, unknown>;
      tenant_id: string | null;
    }>) {
      const existing = byCode.get(r.rule_code);
      if (!existing || (existing && r.tenant_id !== null)) {
        byCode.set(r.rule_code, {
          rule_code: r.rule_code as RuleConfig['rule_code'],
          enabled: r.enabled,
          severity: r.severity as RuleConfig['severity'],
          actions: r.actions as RuleConfig['actions'],
          config_json: r.config_json,
        });
      }
    }
    const configs = Array.from(byCode.values());

    const evalResult = evaluateAllRules(
      {
        event_type: input.event_type,
        relationship,
        aggregates: {
          adult_to_minor_messages_24h: messages,
          reports_against_actor_7d: reports,
        },
        has_media: input.event_type === 'media_upload',
        has_external_link: input.event_type === 'external_link_shared',
      },
      configs,
    );

    const response: SafetyGetDecisionResponse = {
      decision:
        evalResult.aggregated.decision === 'no_risk_signal'
          ? 'no_risk_signal'
          : evalResult.aggregated.decision === 'logged'
          ? 'no_risk_signal'
          : evalResult.aggregated.decision === 'needs_review'
          ? 'soft_blocked'
          : (evalResult.aggregated.decision as SafetyGetDecisionResponse['decision']),
      reason_codes: evalResult.aggregated.reason_codes,
      severity: evalResult.aggregated.severity,
      risk_category:
        evalResult.aggregated.risk_category as SafetyGetDecisionResponse['risk_category'],
      actions: evalResult.aggregated
        .actions as SafetyGetDecisionResponse['actions'],
      step_up_required: evalResult.aggregated.step_up_required,
      parental_consent_required:
        evalResult.aggregated.parental_consent_required,
      content_included: false,
      pii_included: false,
    };

    assertPayloadSafe(response, 'public_api_response');

    log.info('safety_rule_evaluated', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      relationship,
      decision: response.decision,
      status: 200,
    });

    return jsonResponse(response, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
