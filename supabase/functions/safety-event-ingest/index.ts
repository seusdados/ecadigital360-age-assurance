// POST /v1/safety/event
//
// Auth: X-AgeKey-API-Key. Ingest principal do AgeKey Safety Signals.
//
// 1. Valida payload via privacy guard `safety_event_v1` (rejeita
//    conteúdo bruto e PII).
// 2. Resolve/cria safety_subjects para actor (e counterparty se houver).
// 3. Resolve/cria safety_interactions e deriva relationship.
// 4. Insere safety_events (metadata-only).
// 5. Atualiza aggregates relevantes.
// 6. Avalia rule engine.
// 7. Cria safety_alerts quando regra dispara.
// 8. Cria step-up (verification_session) ou parental_consent_request
//    quando ações exigirem.
// 9. Retorna decision envelope minimizado.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  jsonResponse,
  respondError,
  InvalidRequestError,
  InternalError,
  ForbiddenError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  SafetyEventIngestRequestSchema,
  type SafetyEventIngestResponse,
} from '../../../packages/shared/src/schemas/safety.ts';
import {
  assertPayloadSafe,
  PrivacyGuardForbiddenClaimError,
} from '../../../packages/shared/src/privacy/index.ts';
import {
  deriveRelationship,
  evaluateAllRules,
  type RuleConfig,
} from '../../../packages/shared/src/safety/index.ts';
import { readSafetyFlags } from '../_shared/safety/feature-flags.ts';
import { writeSafetyAudit } from '../_shared/safety/audit.ts';
import { upsertSafetySubject } from '../_shared/safety/subject-resolver.ts';
import {
  incrementAggregate,
  readAggregate,
} from '../_shared/safety/aggregates.ts';
import { createStepUpSession } from '../_shared/safety/step-up.ts';
import { requestParentalConsentCheck } from '../_shared/safety/consent-check.ts';
import { safetyPayloadHash } from '../_shared/safety/payload-hash.ts';

const FN = 'safety-event-ingest';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };
  const t0 = Date.now();

  if (req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const flags = readSafetyFlags();
    if (!flags.enabled) {
      throw new ForbiddenError(
        'AgeKey Safety Signals module is disabled (AGEKEY_SAFETY_SIGNALS_ENABLED=false).',
      );
    }

    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(
      client,
      principal.apiKeyHash,
      'safety-event-ingest',
      principal.tenantId,
    );

    const rawText = await req.text();
    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }

    // Privacy guard ANTES da validação Zod — bloqueia conteúdo bruto.
    try {
      assertPayloadSafe(body, 'safety_event_v1');
    } catch (err) {
      if (err instanceof PrivacyGuardForbiddenClaimError) {
        log.warn('safety_event_blocked_by_privacy_guard', {
          fn: FN,
          trace_id,
          tenant_id: principal.tenantId,
          violations: err.violations.map((v) => v.path),
          reason_code: err.reasonCode,
        });
        throw new InvalidRequestError(
          'Payload contains forbidden keys (Safety v1 metadata-only)',
          { reason_code: 'PRIVACY_CONTENT_NOT_ALLOWED_IN_V1' },
        );
      }
      throw err;
    }

    const parsed = SafetyEventIngestRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;

    // Privacy guard adicional na metadata (defesa em profundidade).
    assertPayloadSafe(input.metadata, 'safety_event_v1');

    const payloadHash = await safetyPayloadHash(rawText);

    // Resolve actor + counterparty.
    const actor = await upsertSafetySubject(client, {
      tenantId: principal.tenantId,
      applicationId: principal.applicationId,
      subjectRefHmac: input.actor_subject_ref_hmac,
      ageState: input.actor_age_state,
    });

    let counterparty: Awaited<ReturnType<typeof upsertSafetySubject>> | null = null;
    if (input.counterparty_subject_ref_hmac) {
      counterparty = await upsertSafetySubject(client, {
        tenantId: principal.tenantId,
        applicationId: principal.applicationId,
        subjectRefHmac: input.counterparty_subject_ref_hmac,
        ageState: input.counterparty_age_state,
      });
    }

    const relationship = deriveRelationship(
      actor.age_state,
      counterparty?.age_state ?? null,
    );

    // Upsert interaction.
    let interactionId: string | null = null;
    if (counterparty) {
      const { data: existing } = await client
        .from('safety_interactions')
        .select('id, events_count')
        .eq('tenant_id', principal.tenantId)
        .eq('application_id', principal.applicationId)
        .eq('actor_subject_id', actor.id)
        .eq('counterparty_subject_id', counterparty.id)
        .maybeSingle();
      if (existing) {
        interactionId = (existing as { id: string }).id;
        await client
          .from('safety_interactions')
          .update({
            last_seen_at: new Date().toISOString(),
            events_count:
              ((existing as { events_count: number }).events_count ?? 0) + 1,
            relationship,
          })
          .eq('id', interactionId);
      } else {
        const { data: newInt } = await client
          .from('safety_interactions')
          .insert({
            tenant_id: principal.tenantId,
            application_id: principal.applicationId,
            actor_subject_id: actor.id,
            counterparty_subject_id: counterparty.id,
            relationship,
            events_count: 1,
          })
          .select('id')
          .single();
        interactionId = (newInt as { id: string } | null)?.id ?? null;
      }
    }

    // Insere evento.
    const { data: evtRow, error: evtErr } = await client
      .from('safety_events')
      .insert({
        tenant_id: principal.tenantId,
        application_id: principal.applicationId,
        interaction_id: interactionId,
        event_type: input.event_type,
        metadata_jsonb: input.metadata,
        content_hash: input.content_hash ?? null,
        payload_hash: payloadHash,
        occurred_at: input.occurred_at ?? new Date().toISOString(),
        retention_class: flags.defaultEventRetentionClass,
      })
      .select('id')
      .single();
    if (evtErr || !evtRow) {
      throw evtErr ?? new InternalError('Failed to insert safety_event');
    }
    const eventId = (evtRow as { id: string }).id;

    // Aggregates relevantes.
    if (
      counterparty &&
      relationship === 'adult_to_minor' &&
      (input.event_type === 'message_sent' ||
        input.event_type === 'message_received')
    ) {
      await incrementAggregate(client, {
        tenantId: principal.tenantId,
        applicationId: principal.applicationId,
        subjectId: counterparty.id,
        aggregateKey: 'adult_to_minor_messages_24h',
        window: '24h',
      });
    }
    if (input.event_type === 'report_filed' && counterparty) {
      await incrementAggregate(client, {
        tenantId: principal.tenantId,
        applicationId: principal.applicationId,
        subjectId: counterparty.id, // counterparty é o ator reportado
        aggregateKey: 'reports_against_actor_7d',
        window: '7d',
      });
    }

    // Lê aggregates para regras.
    const aggregateMessages = counterparty
      ? await readAggregate(client, {
          tenantId: principal.tenantId,
          applicationId: principal.applicationId,
          subjectId: counterparty.id,
          aggregateKey: 'adult_to_minor_messages_24h',
          window: '24h',
        })
      : 0;
    const aggregateReports = counterparty
      ? await readAggregate(client, {
          tenantId: principal.tenantId,
          applicationId: principal.applicationId,
          subjectId: counterparty.id,
          aggregateKey: 'reports_against_actor_7d',
          window: '7d',
        })
      : 0;

    // Carrega rule configs (per-tenant + global default).
    const { data: ruleRows } = await client
      .from('safety_rules')
      .select('rule_code, enabled, severity, actions, config_json, tenant_id')
      .or(`tenant_id.eq.${principal.tenantId},tenant_id.is.null`);

    // Quando há override per-tenant, ele substitui o global.
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

    const hasMedia = input.event_type === 'media_upload';
    const hasExternalLink =
      input.event_type === 'external_link_shared' &&
      Boolean((input.metadata as { has_external_url?: boolean }).has_external_url);

    const evalResult = evaluateAllRules(
      {
        event_type: input.event_type,
        relationship,
        aggregates: {
          adult_to_minor_messages_24h: aggregateMessages,
          reports_against_actor_7d: aggregateReports,
        },
        content_hash: input.content_hash,
        has_media: hasMedia,
        has_external_link: hasExternalLink,
      },
      configs,
    );

    let alertId: string | null = null;
    let stepUpSessionId: string | null = null;
    let parentalConsentRequestId: string | null = null;

    if (evalResult.aggregated.triggered_rules.length > 0) {
      const primaryRuleCode = evalResult.aggregated.triggered_rules[0]!;

      // Step-up: cria verification_session.
      if (evalResult.aggregated.step_up_required) {
        // Resolve a primeira policy ativa do tenant para step-up
        // (configuração avançada fica para rodada futura).
        const { data: policyRow } = await client
          .from('policies')
          .select('id, current_version')
          .eq('tenant_id', principal.tenantId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        let resolvedVersionId: string | null = null;
        if (policyRow) {
          const { data: versionRow } = await client
            .from('policy_versions')
            .select('id')
            .eq('policy_id', (policyRow as { id: string }).id)
            .eq('version', (policyRow as { current_version: number }).current_version)
            .maybeSingle();
          if (versionRow) {
            resolvedVersionId = (versionRow as { id: string }).id;
            const stepUp = await createStepUpSession(client, {
              tenantId: principal.tenantId,
              applicationId: principal.applicationId,
              policyId: (policyRow as { id: string }).id,
              policyVersionId: resolvedVersionId,
              externalUserRef: counterparty?.id ?? actor.id,
              locale: input.locale ?? 'pt-BR',
            });
            stepUpSessionId = stepUp.session_id;
          }
        }
        if (!stepUpSessionId) {
          // No active policy or version available — record an audit
          // event so DPO/ops can see the rule fired but nothing was
          // linked, instead of a silent no-op. Ingest continues.
          log.warn('safety_step_up_skipped_no_policy', {
            fn: FN,
            trace_id,
            tenant_id: principal.tenantId,
            application_id: principal.applicationId,
            event_id: eventId,
          });
          await writeSafetyAudit({
            client,
            tenantId: principal.tenantId,
            action: 'safety.step_up_skipped_no_policy',
            resourceType: 'safety_event',
            resourceId: eventId,
            actorType: 'api_key',
            actorId: null,
            diff: {
              application_id: principal.applicationId,
              event_id: eventId,
              reason_code: 'SAFETY_STEP_UP_NO_ACTIVE_POLICY',
              rule_code: evalResult.aggregated.triggered_rules[0] ?? null,
              severity: evalResult.aggregated.severity,
              risk_category: evalResult.aggregated.risk_category,
              payload_hash: payloadHash,
            },
            traceId: trace_id,
            fn: FN,
          });
        }
      }

      // Parental consent check.
      if (
        evalResult.aggregated.parental_consent_required &&
        flags.parentalConsentEnabled &&
        counterparty
      ) {
        const { data: policyRow } = await client
          .from('policies')
          .select('id, current_version')
          .eq('tenant_id', principal.tenantId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        let resolvedConsentRequestId: string | null = null;
        if (policyRow) {
          const { data: versionRow } = await client
            .from('policy_versions')
            .select('id')
            .eq('policy_id', (policyRow as { id: string }).id)
            .eq('version', (policyRow as { current_version: number }).current_version)
            .maybeSingle();
          const { data: ctvRow } = await client
            .from('consent_text_versions')
            .select('id')
            .eq('tenant_id', principal.tenantId)
            .eq('policy_id', (policyRow as { id: string }).id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          if (versionRow && ctvRow) {
            const consent = await requestParentalConsentCheck(client, {
              tenantId: principal.tenantId,
              applicationId: principal.applicationId,
              policyId: (policyRow as { id: string }).id,
              policyVersionId: (versionRow as { id: string }).id,
              consentTextVersionId: (ctvRow as { id: string }).id,
              resource: `safety/${input.event_type}`,
              childRefHmac: counterparty.subject_ref_hmac ?? counterparty.id,
              purposeCodes: ['safety_signal_response'],
              dataCategories: ['interaction_metadata'],
              locale: input.locale ?? 'pt-BR',
            });
            parentalConsentRequestId = consent.consent_request_id;
            resolvedConsentRequestId = consent.consent_request_id;
          }
        }
        if (!resolvedConsentRequestId) {
          // No active policy / version / consent_text_version available —
          // audit explicit skip so DPO/ops can detect missing setup.
          // Ingest continues; the alert (if created below) records that
          // parental consent could not be linked.
          log.warn('safety_parental_consent_skipped_no_policy', {
            fn: FN,
            trace_id,
            tenant_id: principal.tenantId,
            application_id: principal.applicationId,
            event_id: eventId,
          });
          await writeSafetyAudit({
            client,
            tenantId: principal.tenantId,
            action: 'safety.parental_consent_skipped_no_policy',
            resourceType: 'safety_event',
            resourceId: eventId,
            actorType: 'api_key',
            actorId: null,
            diff: {
              application_id: principal.applicationId,
              event_id: eventId,
              reason_code: 'SAFETY_PARENTAL_CONSENT_NO_ACTIVE_POLICY',
              rule_code: evalResult.aggregated.triggered_rules[0] ?? null,
              severity: evalResult.aggregated.severity,
              risk_category: evalResult.aggregated.risk_category,
              payload_hash: payloadHash,
            },
            traceId: trace_id,
            fn: FN,
          });
        }
      }

      // Cria alert.
      const { data: alertRow, error: alertErr } = await client
        .from('safety_alerts')
        .insert({
          tenant_id: principal.tenantId,
          application_id: principal.applicationId,
          rule_code: primaryRuleCode,
          status: 'open',
          severity: evalResult.aggregated.severity,
          risk_category: evalResult.aggregated.risk_category,
          reason_codes: evalResult.aggregated.reason_codes,
          actions_taken: evalResult.aggregated.actions,
          actor_subject_id: actor.id,
          counterparty_subject_id: counterparty?.id ?? null,
          step_up_session_id: stepUpSessionId,
          parental_consent_request_id: parentalConsentRequestId,
          triggering_event_ids: [eventId],
        })
        .select('id')
        .single();
      if (alertErr || !alertRow) {
        throw alertErr ?? new InternalError('Failed to create alert');
      }
      alertId = (alertRow as { id: string }).id;

      await writeSafetyAudit({
        client,
        tenantId: principal.tenantId,
        action: 'safety.alert_created',
        resourceType: 'safety_alert',
        resourceId: alertId,
        actorType: 'api_key',
        actorId: null,
        diff: {
          application_id: principal.applicationId,
          event_id: eventId,
          rule_code: primaryRuleCode,
          reason_codes: evalResult.aggregated.reason_codes,
          severity: evalResult.aggregated.severity,
          risk_category: evalResult.aggregated.risk_category,
          step_up_session_id: stepUpSessionId,
          parental_consent_request_id: parentalConsentRequestId,
          payload_hash: payloadHash,
        },
        traceId: trace_id,
        fn: FN,
      });

      if (stepUpSessionId) {
        await writeSafetyAudit({
          client,
          tenantId: principal.tenantId,
          action: 'safety.step_up_linked',
          resourceType: 'safety_alert',
          resourceId: alertId,
          actorType: 'api_key',
          actorId: null,
          diff: {
            application_id: principal.applicationId,
            event_id: eventId,
            rule_code: primaryRuleCode,
            severity: evalResult.aggregated.severity,
            step_up_session_id: stepUpSessionId,
          },
          traceId: trace_id,
          fn: FN,
        });
      }

      if (parentalConsentRequestId) {
        await writeSafetyAudit({
          client,
          tenantId: principal.tenantId,
          action: 'safety.parental_consent_check_linked',
          resourceType: 'safety_alert',
          resourceId: alertId,
          actorType: 'api_key',
          actorId: null,
          diff: {
            application_id: principal.applicationId,
            event_id: eventId,
            rule_code: primaryRuleCode,
            severity: evalResult.aggregated.severity,
            parental_consent_request_id: parentalConsentRequestId,
          },
          traceId: trace_id,
          fn: FN,
        });
      }

      // Atualiza counters do counterparty (que está no centro do alerta).
      if (counterparty) {
        await client
          .from('safety_subjects')
          .update({ alerts_count: counterparty.alerts_count + 1 })
          .eq('id', counterparty.id);
      }
    }

    const response: SafetyEventIngestResponse = {
      event_id: eventId,
      actor_subject_id: actor.id,
      counterparty_subject_id: counterparty?.id ?? null,
      decision: evalResult.aggregated.decision,
      reason_codes: evalResult.aggregated.reason_codes,
      severity: evalResult.aggregated.severity,
      alert_id: alertId,
      step_up_session_id: stepUpSessionId,
      content_included: false,
      pii_included: false,
    };

    // Defesa final.
    assertPayloadSafe(response, 'public_api_response');

    log.info('safety_event_ingested', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      application_id: principal.applicationId,
      event_id: eventId,
      relationship,
      decision: evalResult.aggregated.decision,
      reason_codes: evalResult.aggregated.reason_codes,
      severity: evalResult.aggregated.severity,
      alert_id: alertId,
      step_up_session_id: stepUpSessionId,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    return jsonResponse(response, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
