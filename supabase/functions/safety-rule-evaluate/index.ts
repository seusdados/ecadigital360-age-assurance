// POST /v1/safety/rule-evaluate — re-evaluate the active rule set against
// a sample event payload (without persisting). Used by the admin UI for
// rule testing and by automated tests.
//
// Auth: X-AgeKey-API-Key. Returns the same SafetyEventIngestResponse
// shape as `/event-ingest` but never writes anything.
//
// Reference: docs/modules/safety-signals/EDGE_FUNCTIONS.md §rule-evaluate

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  SAFETY_FEATURE_FLAGS,
  SafetyEventIngestRequestSchema,
  SafetyEventIngestResponseSchema,
  assertPublicPayloadHasNoPii,
  rejectForbiddenIngestKeys,
  readSafetyFeatureFlag,
} from '../../../packages/shared/src/index.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  ForbiddenError,
  InvalidRequestError,
  jsonResponse,
  respondError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import {
  buildSafetyDecisionEnvelope,
  deriveRelationship,
  SYSTEM_SAFETY_RULES,
} from '../_shared/safety-envelope.ts';
import { consentHmacHex } from '../_shared/consent-hmac.ts';

const FN = 'safety-rule-evaluate';

function moduleEnabled(): boolean {
  return readSafetyFeatureFlag(
    {
      AGEKEY_SAFETY_SIGNALS_ENABLED: Deno.env.get(SAFETY_FEATURE_FLAGS.ENABLED),
    },
    SAFETY_FEATURE_FLAGS.ENABLED,
  );
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: req.headers.get('origin') };
  if (req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }
  if (!moduleEnabled()) {
    return respondError(
      fnCtx,
      new ForbiddenError('Safety Signals module is disabled'),
    );
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const forbidden = rejectForbiddenIngestKeys(body);
    if (forbidden) {
      throw new InvalidRequestError(
        'Forbidden keys in evaluation payload',
        forbidden,
      );
    }
    const parsed = SafetyEventIngestRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid request body', parsed.error.flatten());
    }
    const input = parsed.data;
    if (input.application_id !== principal.applicationId) {
      throw new ForbiddenError('application_id does not match API key');
    }

    const actorRefHmac = await consentHmacHex(
      client,
      principal.tenantId,
      'subject_ref',
      input.actor_external_ref,
    );
    const counterpartyRefHmac = input.counterparty_external_ref
      ? await consentHmacHex(
          client,
          principal.tenantId,
          'subject_ref',
          input.counterparty_external_ref,
        )
      : null;

    const relationship = deriveRelationship(
      input.actor_age_state,
      input.counterparty_age_state,
    );
    const envelope = buildSafetyDecisionEnvelope({
      tenant_id: principal.tenantId,
      application_id: principal.applicationId,
      safety_event_id: null,
      safety_alert_id: null,
      interaction_id: null,
      verification_session_id: null,
      consent_request_id: null,
      event_type: input.event_type,
      channel_type: input.channel_type,
      actor_age_state: input.actor_age_state,
      counterparty_age_state: input.counterparty_age_state,
      actor_ref_hmac: actorRefHmac,
      counterparty_ref_hmac: counterpartyRefHmac,
      rules: SYSTEM_SAFETY_RULES,
      context: {
        event_type: input.event_type,
        channel_type: input.channel_type,
        relationship_type: relationship,
        actor_age_state: input.actor_age_state,
        counterparty_age_state: input.counterparty_age_state,
        aggregate_24h_count: 0,
        aggregate_7d_count: 0,
        aggregate_30d_count: 0,
        aggregate_actor_reports_7d: 0,
        aggregate_link_attempts_24h: 0,
        aggregate_media_to_minor_24h: 0,
        consent_status: 'absent',
        verification_assurance_level: null,
      },
    });

    const responseBody = {
      decision: envelope.decision,
      severity: envelope.severity,
      risk_category: envelope.risk_category,
      reason_codes: envelope.reason_codes,
      safety_event_id: null,
      safety_alert_id: null,
      step_up_required: envelope.step_up_required,
      parental_consent_required: envelope.parental_consent_required,
      actions: envelope.actions,
      ttl_seconds: envelope.ttl_seconds,
      pii_included: false as const,
      content_included: false as const,
    };
    assertPublicPayloadHasNoPii(responseBody);
    const validated = SafetyEventIngestResponseSchema.parse(responseBody);

    log.info('safety_rule_evaluated', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      decision: envelope.decision,
      status: 200,
    });

    return jsonResponse(validated, { origin: fnCtx.origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
