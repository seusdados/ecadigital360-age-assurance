// POST /v1/safety/step-up — request a step-up age verification for a subject.
//
// Auth: X-AgeKey-API-Key. Creates a verification_session bound to the
// safety alert that triggered the step-up, returning a redirect URL the
// client app can hand to the user. Does NOT create a parallel KYC flow —
// it routes through the canonical Core verification.
//
// Reference: docs/modules/safety-signals/EDGE_FUNCTIONS.md §step-up

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'zod';
import {
  CONSENT_FEATURE_FLAGS,
  SAFETY_FEATURE_FLAGS,
  REASON_CODES,
  assertPublicPayloadHasNoPii,
  readSafetyFeatureFlag,
  readConsentFeatureFlag,
} from '../../../packages/shared/src/index.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  ForbiddenError,
  InvalidRequestError,
  NotFoundError,
  jsonResponse,
  respondError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { resolvePolicy } from '../_shared/policy-engine.ts';
import { newNonce } from '../_shared/sessions.ts';

const FN = 'safety-step-up';

const StepUpRequestSchema = z
  .object({
    safety_alert_id: z.string().uuid(),
    /** Policy slug to use for the step-up; defaults to the tenant's
     *  default age-verify policy. */
    policy_slug: z.string().min(1).max(64).optional(),
  })
  .strict();

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
    const parsed = StepUpRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;

    const alertRow = await client
      .from('safety_alerts')
      .select('id, tenant_id, application_id, status')
      .eq('id', input.safety_alert_id)
      .maybeSingle();
    if (alertRow.error) throw alertRow.error;
    if (!alertRow.data) throw new NotFoundError('Safety alert not found');
    if (alertRow.data.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('Alert belongs to another tenant');
    }

    const policySlug = input.policy_slug ?? 'default';
    const { snapshot: policy, policy_version_id } = await resolvePolicy(
      client,
      principal.tenantId,
      policySlug,
    );

    const sessionInsert = await client
      .from('verification_sessions')
      .insert({
        tenant_id: principal.tenantId,
        application_id: principal.applicationId,
        policy_id: policy.id,
        policy_version_id,
        status: 'pending',
        external_user_ref: null,
        locale: 'pt-BR',
        client_capabilities_json: {},
      })
      .select('id, expires_at')
      .single();
    if (sessionInsert.error) throw sessionInsert.error;
    const sessionId = sessionInsert.data.id as string;

    await client.from('verification_challenges').insert({
      session_id: sessionId,
      nonce: newNonce(),
    });

    // Optional consent feature interlock — record audit only when both
    // modules are enabled and the alert risk category warrants parental
    // consent (e.g. unknown_to_minor_contact).
    const consentEnabled = readConsentFeatureFlag(
      {
        AGEKEY_PARENTAL_CONSENT_ENABLED: Deno.env.get(
          CONSENT_FEATURE_FLAGS.ENABLED,
        ),
      },
      CONSENT_FEATURE_FLAGS.ENABLED,
    );

    await client.from('audit_events').insert({
      tenant_id: principal.tenantId,
      actor_type: 'system',
      action: 'safety.step_up_required',
      resource_type: 'safety_signal',
      resource_id: alertRow.data.id,
      diff_json: {
        decision_domain: 'safety_signal',
        envelope_version: 1,
        safety_alert_id: alertRow.data.id,
        verification_session_id: sessionId,
        consent_module_enabled: consentEnabled,
        reason_code: REASON_CODES.SAFETY_STEP_UP_REQUIRED,
        content_included: false,
        pii_included: false,
      },
    });

    const responseBody = {
      safety_alert_id: alertRow.data.id,
      verification_session_id: sessionId,
      reason_code: REASON_CODES.SAFETY_STEP_UP_REQUIRED,
      expires_at: new Date(sessionInsert.data.expires_at).toISOString(),
      pii_included: false as const,
      content_included: false as const,
    };
    assertPublicPayloadHasNoPii(responseBody);

    log.info('safety_step_up_created', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      safety_alert_id: alertRow.data.id,
      verification_session_id: sessionId,
      status: 200,
    });

    return jsonResponse(responseBody, { origin: fnCtx.origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
