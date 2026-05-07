// POST /v1/safety/event-ingest — accept a metadata-only safety event.
//
// Auth: X-AgeKey-API-Key. The function:
//   1. Hard-rejects raw content / PII keys before parsing.
//   2. Validates the request with the canonical schema.
//   3. Hashes actor / counterparty / IP / device with the per-tenant HMAC.
//   4. Upserts safety_subjects + interaction + inserts a safety_events row.
//   5. Loads aggregates and evaluates the active rule set.
//   6. Builds a SafetyDecisionEnvelope, persists alerts when applicable.
//   7. Returns the canonical decision; a SQL trigger fans out webhooks.
//
// METADATA-ONLY contract is enforced at three layers:
//   - boundary key check (rejectForbiddenIngestKeys),
//   - SafetyEventIngestRequestSchema (literal `content_processed/stored=false`),
//   - SQL CHECK constraints on safety_events.
//
// Reference: docs/modules/safety-signals/EDGE_FUNCTIONS.md
//            docs/modules/safety-signals/PRIVACY_GUARD.md

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  SAFETY_FEATURE_FLAGS,
  REASON_CODES,
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
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  buildSafetyDecisionEnvelope,
  computeSafetyEnvelopePayloadHash,
  deriveRelationship,
  SYSTEM_SAFETY_RULES,
  safetyEnvelopeAuditDiff,
} from '../_shared/safety-envelope.ts';
import { consentHmacHex } from '../_shared/consent-hmac.ts';

const FN = 'safety-event-ingest';

function moduleEnabled(): boolean {
  return readSafetyFeatureFlag(
    {
      AGEKEY_SAFETY_SIGNALS_ENABLED: Deno.env.get(SAFETY_FEATURE_FLAGS.ENABLED),
    },
    SAFETY_FEATURE_FLAGS.ENABLED,
  );
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  let hex = '';
  for (const b of new Uint8Array(buf)) hex += b.toString(16).padStart(2, '0');
  return hex;
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: req.headers.get('origin') };
  const t0 = Date.now();

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
    await checkRateLimit(
      client,
      principal.apiKeyHash,
      'safety-event-ingest',
      principal.tenantId,
    );

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }

    // Boundary check FIRST — before Zod, so we can return the dedicated
    // reason_code instead of the generic INVALID_REQUEST.
    const forbidden = rejectForbiddenIngestKeys(body);
    if (forbidden) {
      throw new InvalidRequestError(
        forbidden.reasonCode === REASON_CODES.SAFETY_RAW_CONTENT_REJECTED
          ? 'Safety v1 is metadata-only; raw content is not accepted.'
          : 'PII keys are not accepted on the safety ingest path.',
        {
          reason_code: forbidden.reasonCode,
          offending: forbidden.offending,
        },
      );
    }

    const parsed = SafetyEventIngestRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
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
    const ipRefHmac = input.ip
      ? await consentHmacHex(client, principal.tenantId, 'actor_ref', input.ip)
      : null;
    const deviceRefHmac = input.device_external_ref
      ? await consentHmacHex(
          client,
          principal.tenantId,
          'actor_ref',
          input.device_external_ref,
        )
      : null;
    const userAgentHash = input.user_agent
      ? await sha256Hex(input.user_agent)
      : null;

    // Upsert subjects.
    const ensureSubject = async (
      ref: string,
      ageState: typeof input.actor_age_state,
    ) => {
      const sel = await client
        .from('safety_subjects')
        .select('id')
        .eq('tenant_id', principal.tenantId)
        .eq('application_id', principal.applicationId)
        .eq('subject_ref_hmac', ref)
        .maybeSingle();
      if (sel.error) throw sel.error;
      if (sel.data) {
        await client
          .from('safety_subjects')
          .update({
            current_age_state: ageState,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', sel.data.id);
        return sel.data.id as string;
      }
      const ins = await client
        .from('safety_subjects')
        .insert({
          tenant_id: principal.tenantId,
          application_id: principal.applicationId,
          subject_ref_hmac: ref,
          current_age_state: ageState,
        })
        .select('id')
        .single();
      if (ins.error) throw ins.error;
      return ins.data.id as string;
    };

    const actorSubjectId = await ensureSubject(
      actorRefHmac,
      input.actor_age_state,
    );
    const counterpartySubjectId = counterpartyRefHmac
      ? await ensureSubject(counterpartyRefHmac, input.counterparty_age_state)
      : null;

    const relationship = deriveRelationship(
      input.actor_age_state,
      input.counterparty_age_state,
    );

    // Insert safety_event row (the SQL CHECK forbids content_processed=true).
    const eventInsert = await client
      .from('safety_events')
      .insert({
        tenant_id: principal.tenantId,
        application_id: principal.applicationId,
        event_type: input.event_type,
        occurred_at: input.occurred_at,
        interaction_ref: input.interaction_ref ?? null,
        actor_subject_id: actorSubjectId,
        counterparty_subject_id: counterpartySubjectId,
        actor_ref_hmac: actorRefHmac,
        counterparty_ref_hmac: counterpartyRefHmac,
        actor_age_state: input.actor_age_state,
        counterparty_age_state: input.counterparty_age_state,
        relationship_type: relationship,
        channel_type: input.channel_type,
        ip_ref_hmac: ipRefHmac,
        device_ref_hmac: deviceRefHmac,
        user_agent_hash: userAgentHash,
        duration_ms: input.duration_ms ?? null,
        content_processed: false,
        content_stored: false,
        artifact_hash: input.artifact_hash ?? null,
        artifact_type: input.artifact_type ?? null,
        client_event_id: input.client_event_id ?? null,
        metadata: input.metadata ?? {},
      })
      .select('id')
      .single();
    if (eventInsert.error) throw eventInsert.error;
    const safetyEventId = eventInsert.data.id as string;

    // Load aggregate counters used by rules.
    // For MVP we compute on-the-fly using simple count(*) windows.
    const sinceIso24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const sinceIso7d = new Date(
      Date.now() - 7 * 24 * 3600 * 1000,
    ).toISOString();
    const sinceIso30d = new Date(
      Date.now() - 30 * 24 * 3600 * 1000,
    ).toISOString();

    const c24 = await client
      .from('safety_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', principal.tenantId)
      .eq('actor_ref_hmac', actorRefHmac)
      .gte('occurred_at', sinceIso24h);
    if (c24.error) throw c24.error;
    const c7 = await client
      .from('safety_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', principal.tenantId)
      .eq('actor_ref_hmac', actorRefHmac)
      .gte('occurred_at', sinceIso7d);
    if (c7.error) throw c7.error;
    const c30 = await client
      .from('safety_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', principal.tenantId)
      .eq('actor_ref_hmac', actorRefHmac)
      .gte('occurred_at', sinceIso30d);
    if (c30.error) throw c30.error;

    const reportsAgainstActor = await client
      .from('safety_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', principal.tenantId)
      .eq('counterparty_ref_hmac', actorRefHmac)
      .eq('event_type', 'report_submitted')
      .gte('occurred_at', sinceIso7d);
    if (reportsAgainstActor.error) throw reportsAgainstActor.error;

    const linkAttempts24h = await client
      .from('safety_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', principal.tenantId)
      .eq('actor_ref_hmac', actorRefHmac)
      .eq('event_type', 'external_link_attempt')
      .gte('occurred_at', sinceIso24h);
    if (linkAttempts24h.error) throw linkAttempts24h.error;

    const mediaToMinor24h = await client
      .from('safety_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', principal.tenantId)
      .eq('actor_ref_hmac', actorRefHmac)
      .eq('relationship_type', 'adult_to_minor')
      .eq('event_type', 'media_upload_attempt')
      .gte('occurred_at', sinceIso24h);
    if (mediaToMinor24h.error) throw mediaToMinor24h.error;

    // Tenant rules layered on top of system rules. The tenant copy can
    // disable a system rule by inserting a row with the same `rule_key`
    // and `enabled = false`.
    const tenantRulesQ = await client
      .from('safety_rules')
      .select(
        'rule_key, name, description, risk_category, severity, condition_json, action_json, enabled, is_system_rule',
      )
      .eq('tenant_id', principal.tenantId)
      .eq('enabled', true);
    if (tenantRulesQ.error) throw tenantRulesQ.error;
    type TenantRuleRow = {
      rule_key: string;
      name: string;
      description: string | null;
      risk_category: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      condition_json: unknown;
      action_json: unknown;
      enabled: boolean;
      is_system_rule: boolean;
    };
    const tenantRules = ((tenantRulesQ.data ?? []) as TenantRuleRow[]).map(
      (r) => ({
        id: r.rule_key,
        name: r.name,
        description: r.description ?? undefined,
        enabled: r.enabled,
        is_system_rule: r.is_system_rule,
        risk_category: r.risk_category,
        severity: r.severity,
        condition: r.condition_json as never,
        actions: r.action_json as never,
      }),
    );

    const envelope = buildSafetyDecisionEnvelope({
      tenant_id: principal.tenantId,
      application_id: principal.applicationId,
      safety_event_id: safetyEventId,
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
      rules: [
        ...SYSTEM_SAFETY_RULES,
        ...(tenantRules as unknown as typeof SYSTEM_SAFETY_RULES),
      ],
      context: {
        event_type: input.event_type,
        channel_type: input.channel_type,
        relationship_type: relationship,
        actor_age_state: input.actor_age_state,
        counterparty_age_state: input.counterparty_age_state,
        aggregate_24h_count: c24.count ?? 0,
        aggregate_7d_count: c7.count ?? 0,
        aggregate_30d_count: c30.count ?? 0,
        aggregate_actor_reports_7d: reportsAgainstActor.count ?? 0,
        aggregate_link_attempts_24h: linkAttempts24h.count ?? 0,
        aggregate_media_to_minor_24h: mediaToMinor24h.count ?? 0,
        consent_status: 'absent',
        verification_assurance_level: null,
      },
    });

    let safetyAlertId: string | null = null;
    if (envelope.actions.includes('create_alert') ||
        envelope.actions.includes('queue_for_human_review') ||
        envelope.severity === 'high' ||
        envelope.severity === 'critical') {
      const ains = await client
        .from('safety_alerts')
        .insert({
          tenant_id: principal.tenantId,
          application_id: principal.applicationId,
          severity: envelope.severity,
          risk_category: envelope.risk_category,
          actor_subject_id: actorSubjectId,
          counterparty_subject_id: counterpartySubjectId,
          interaction_id: null,
          reason_codes: envelope.reason_codes,
          event_ids: [safetyEventId],
          score: envelope.score,
          human_review_required: envelope.actions.includes(
            'queue_for_human_review',
          ),
        })
        .select('id')
        .single();
      if (ains.error) throw ains.error;
      safetyAlertId = ains.data.id as string;
    }

    // Audit row (additive — the SQL trigger also writes one).
    const payloadHash = await computeSafetyEnvelopePayloadHash({
      ...envelope,
      safety_alert_id: safetyAlertId,
    });
    const auditDiff = safetyEnvelopeAuditDiff(
      { ...envelope, safety_alert_id: safetyAlertId },
      payloadHash,
    );
    await client.from('audit_events').insert({
      tenant_id: principal.tenantId,
      actor_type: 'system',
      action: 'safety.event_evaluated',
      resource_type: 'safety_signal',
      resource_id: safetyEventId,
      diff_json: auditDiff,
    });

    const responseBody = {
      decision: envelope.decision,
      severity: envelope.severity,
      risk_category: envelope.risk_category,
      reason_codes: envelope.reason_codes,
      safety_event_id: safetyEventId,
      safety_alert_id: safetyAlertId,
      step_up_required: envelope.step_up_required,
      parental_consent_required: envelope.parental_consent_required,
      actions: envelope.actions,
      ttl_seconds: envelope.ttl_seconds,
      pii_included: false as const,
      content_included: false as const,
    };
    assertPublicPayloadHasNoPii(responseBody);
    const validated = SafetyEventIngestResponseSchema.parse(responseBody);

    log.info('safety_event_ingested', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      application_id: principal.applicationId,
      safety_event_id: safetyEventId,
      safety_alert_id: safetyAlertId,
      decision: envelope.decision,
      severity: envelope.severity,
      relationship: relationship,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    return jsonResponse(validated, { origin: fnCtx.origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
