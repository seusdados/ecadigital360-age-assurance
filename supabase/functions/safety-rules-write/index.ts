// POST   /v1/safety/rules        — create/upsert override per-tenant
// PATCH  /v1/safety/rules/:id    — update override
// DELETE /v1/safety/rules/:id    — delete override (volta para global)
//
// Auth: X-AgeKey-API-Key (admin do tenant).
// RLS: tenant_id sempre = principal.tenantId. NUNCA aceita override de tenant_id no body.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  jsonResponse,
  respondError,
  InvalidRequestError,
  ForbiddenError,
  NotFoundError,
  InternalError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { writeAuditEvent } from '../_shared/audit.ts';
import { readSafetyFlags } from '../_shared/safety/feature-flags.ts';
import {
  SafetyRulePatchRequestSchema,
  SafetyRuleWriteRequestSchema,
  type SafetyRuleWriteResponse,
} from '../../../packages/shared/src/schemas/safety.ts';
import { assertPayloadSafe } from '../../../packages/shared/src/privacy/index.ts';

const FN = 'safety-rules-write';

function extractRuleId(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i] ?? '';
    if (/^[0-9a-f-]{36}$/i.test(seg)) return seg;
  }
  return null;
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };

  try {
    const flags = readSafetyFlags();
    if (!flags.enabled) throw new ForbiddenError('Safety Signals module disabled.');

    if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'DELETE') {
      throw new InvalidRequestError('Method not allowed');
    }

    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);

    const url = new URL(req.url);

    // POST: create/upsert override per-tenant
    if (req.method === 'POST') {
      let body: unknown;
      try { body = await req.json(); } catch { throw new InvalidRequestError('Invalid JSON body'); }
      assertPayloadSafe(body, 'admin_minimized_view');
      const parsed = SafetyRuleWriteRequestSchema.safeParse(body);
      if (!parsed.success) {
        throw new InvalidRequestError('Invalid body', parsed.error.flatten());
      }
      const input = parsed.data;

      // UPSERT por (tenant_id, rule_code).
      const { data: existing } = await client
        .from('safety_rules')
        .select('id')
        .eq('tenant_id', principal.tenantId)
        .eq('rule_code', input.rule_code)
        .maybeSingle();

      let resultId: string;
      let status: 'created' | 'updated';

      if (existing) {
        const { data: upd, error: updErr } = await client
          .from('safety_rules')
          .update({
            enabled: input.enabled,
            severity: input.severity,
            actions: input.actions,
            config_json: input.config_json,
            updated_at: new Date().toISOString(),
          })
          .eq('id', (existing as { id: string }).id)
          .select('id')
          .single();
        if (updErr || !upd) throw updErr ?? new InternalError('update failed');
        resultId = (upd as { id: string }).id;
        status = 'updated';
      } else {
        const { data: ins, error: insErr } = await client
          .from('safety_rules')
          .insert({
            tenant_id: principal.tenantId,
            rule_code: input.rule_code,
            enabled: input.enabled,
            severity: input.severity,
            actions: input.actions,
            config_json: input.config_json,
          })
          .select('id')
          .single();
        if (insErr || !ins) throw insErr ?? new InternalError('insert failed');
        resultId = (ins as { id: string }).id;
        status = 'created';
      }

      await writeAuditEvent(client, {
        tenantId: principal.tenantId,
        actorType: 'api_key',
        action: `safety.rule.${status}`,
        resourceType: 'safety_rules',
        resourceId: resultId,
        diff: {
          rule_code: input.rule_code,
          enabled: input.enabled,
          severity: input.severity,
        },
      });

      const response: SafetyRuleWriteResponse = {
        id: resultId,
        rule_code: input.rule_code,
        tenant_id: principal.tenantId,
        status,
      };
      assertPayloadSafe(response, 'public_api_response');
      log.info('safety_rule_write', { fn: FN, trace_id, tenant_id: principal.tenantId, rule_code: input.rule_code, status });
      return jsonResponse(response, { origin });
    }

    // PATCH/DELETE require :id
    const ruleId = extractRuleId(url);
    if (!ruleId) throw new InvalidRequestError('Invalid rule id');

    // Carrega regra e valida ownership.
    const { data: rule } = await client
      .from('safety_rules')
      .select('id, tenant_id, rule_code')
      .eq('id', ruleId)
      .maybeSingle();
    if (!rule) throw new NotFoundError('rule not found');

    // SAFETY: nunca permitir editar regra global (tenant_id NULL).
    if ((rule as { tenant_id: string | null }).tenant_id === null) {
      throw new ForbiddenError('Cannot edit global rule. Create a per-tenant override via POST.');
    }
    if ((rule as { tenant_id: string }).tenant_id !== principal.tenantId) {
      throw new ForbiddenError('cross-tenant access denied');
    }

    if (req.method === 'PATCH') {
      let body: unknown;
      try { body = await req.json(); } catch { throw new InvalidRequestError('Invalid JSON body'); }
      assertPayloadSafe(body, 'admin_minimized_view');
      const parsed = SafetyRulePatchRequestSchema.safeParse(body);
      if (!parsed.success) {
        throw new InvalidRequestError('Invalid body', parsed.error.flatten());
      }
      const input = parsed.data;

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.enabled !== undefined) update.enabled = input.enabled;
      if (input.severity !== undefined) update.severity = input.severity;
      if (input.actions !== undefined) update.actions = input.actions;
      if (input.config_json !== undefined) update.config_json = input.config_json;

      const { error: updErr } = await client
        .from('safety_rules')
        .update(update)
        .eq('id', ruleId);
      if (updErr) throw updErr;

      await writeAuditEvent(client, {
        tenantId: principal.tenantId,
        actorType: 'api_key',
        action: 'safety.rule.updated',
        resourceType: 'safety_rules',
        resourceId: ruleId,
        diff: input as Record<string, unknown>,
      });

      const response: SafetyRuleWriteResponse = {
        id: ruleId,
        rule_code: (rule as { rule_code: SafetyRuleWriteResponse['rule_code'] }).rule_code,
        tenant_id: principal.tenantId,
        status: 'updated',
      };
      assertPayloadSafe(response, 'public_api_response');
      return jsonResponse(response, { origin });
    }

    // DELETE
    const { error: delErr } = await client
      .from('safety_rules')
      .delete()
      .eq('id', ruleId);
    if (delErr) throw delErr;

    await writeAuditEvent(client, {
      tenantId: principal.tenantId,
      actorType: 'api_key',
      action: 'safety.rule.deleted',
      resourceType: 'safety_rules',
      resourceId: ruleId,
      diff: { rule_code: (rule as { rule_code: string }).rule_code },
    });

    const response: SafetyRuleWriteResponse = {
      id: ruleId,
      rule_code: (rule as { rule_code: SafetyRuleWriteResponse['rule_code'] }).rule_code,
      tenant_id: principal.tenantId,
      status: 'deleted',
    };
    return jsonResponse(response, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
