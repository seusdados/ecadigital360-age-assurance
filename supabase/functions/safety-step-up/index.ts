// POST /v1/safety/step-up
//
// Wrapper público: cria verification_session no Core associada a um
// safety_alert. Usado quando o tenant prefere dirigir o flow de step-up
// pelo seu lado em vez de aceitar o session_id automaticamente criado
// pelo ingest.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  jsonResponse,
  respondError,
  InvalidRequestError,
  ForbiddenError,
  NotFoundError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { readSafetyFlags } from '../_shared/safety/feature-flags.ts';
import { createStepUpSession } from '../_shared/safety/step-up.ts';
import { z } from 'https://esm.sh/zod@3.23.8';
import { assertPayloadSafe } from '../../../packages/shared/src/privacy/index.ts';

const FN = 'safety-step-up';

const RequestSchema = z
  .object({
    safety_alert_id: z.string().uuid(),
    policy_slug: z.string().min(1).max(64),
    locale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .default('pt-BR'),
  })
  .strict();

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
    if (!flags.enabled) throw new ForbiddenError('Safety Signals module disabled.');

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const input = parsed.data;

    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);

    const { data: alertRow } = await client
      .from('safety_alerts')
      .select('id, tenant_id, application_id, counterparty_subject_id, actor_subject_id')
      .eq('id', input.safety_alert_id)
      .maybeSingle();
    if (!alertRow) throw new NotFoundError('alert not found');
    if (alertRow.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('cross-tenant access denied');
    }

    const { data: policyRow } = await client
      .from('policies')
      .select('id, current_version')
      .eq('tenant_id', principal.tenantId)
      .eq('slug', input.policy_slug)
      .maybeSingle();
    if (!policyRow) throw new NotFoundError('policy not found');
    const { data: versionRow } = await client
      .from('policy_versions')
      .select('id')
      .eq('policy_id', (policyRow as { id: string }).id)
      .eq('version', (policyRow as { current_version: number }).current_version)
      .single();
    if (!versionRow) throw new NotFoundError('policy_version not found');

    const externalUserRef =
      (alertRow as { counterparty_subject_id: string | null }).counterparty_subject_id ??
      (alertRow as { actor_subject_id: string }).actor_subject_id;

    const stepUp = await createStepUpSession(client, {
      tenantId: principal.tenantId,
      applicationId: principal.applicationId,
      policyId: (policyRow as { id: string }).id,
      policyVersionId: (versionRow as { id: string }).id,
      externalUserRef,
      locale: input.locale,
    });

    await client
      .from('safety_alerts')
      .update({ step_up_session_id: stepUp.session_id })
      .eq('id', input.safety_alert_id);

    const response = {
      safety_alert_id: input.safety_alert_id,
      step_up_session_id: stepUp.session_id,
      step_up_expires_at: stepUp.expires_at,
      content_included: false as const,
      pii_included: false as const,
    };
    assertPayloadSafe(response, 'public_api_response');

    log.info('safety_step_up_created', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      alert_id: input.safety_alert_id,
      session_id: stepUp.session_id,
      status: 200,
    });

    return jsonResponse(response, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
