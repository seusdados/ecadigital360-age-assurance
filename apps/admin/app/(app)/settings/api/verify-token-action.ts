'use server';

import { TokenVerifyResponseSchema } from '@agekey/shared';
import { agekey, AgeKeyApiError } from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';

/**
 * Result returned to the Client Component. We deliberately keep this
 * narrow: success = a parsed TokenVerifyResponse; failure = a redacted
 * `error` string with no stack trace. The raw JWT is never returned.
 */
export interface VerifyTokenActionResult {
  ok: boolean;
  /** Set when ok=true. Validated against TokenVerifyResponseSchema. */
  response: {
    valid: boolean;
    reason_code: string | null;
    claims: Record<string, unknown> | null;
    revoked: boolean;
  } | null;
  /** Set when ok=false. Operator-friendly message; no PII / no stack. */
  error: string | null;
}

/**
 * Server Action consumed by `<TokenVerifyForm />` on Settings/API.
 *
 * - Re-asserts tenant context (admin-only page).
 * - Forwards `{ token, expected_audience }` to the
 *   `verifications-token-verify` Edge Function via the shared admin client.
 * - Validates the response with `TokenVerifyResponseSchema` so the UI can
 *   trust the shape.
 * - NEVER logs the raw JWT, neither on success nor on error. The Edge
 *   Function already logs `{ valid, tenant_id, trace_id }` server-side.
 */
export async function verifyTokenAction(input: {
  token: string;
  expected_audience?: string;
}): Promise<VerifyTokenActionResult> {
  await requireTenantContext();

  const token = typeof input.token === 'string' ? input.token.trim() : '';
  if (token.length === 0) {
    return {
      ok: false,
      response: null,
      error: 'Informe um JWT para verificar.',
    };
  }

  const audience =
    typeof input.expected_audience === 'string' &&
    input.expected_audience.trim().length > 0
      ? input.expected_audience.trim()
      : undefined;

  try {
    const raw = await agekey.tokens.verify({
      token,
      ...(audience ? { expected_audience: audience } : {}),
    });

    // Re-validate via the canonical Zod schema. We intentionally fall back
    // to a permissive shape if the schema rejects (e.g. a `reason_code`
    // came back on an invalid token without `claims`) — the schema treats
    // claims/reason_code as optional, so this should always succeed for
    // well-behaved responses.
    const parsed = TokenVerifyResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        response: null,
        error: 'Resposta inesperada do servidor de verificação.',
      };
    }

    return {
      ok: true,
      response: {
        valid: parsed.data.valid,
        reason_code: parsed.data.reason_code ?? null,
        claims: (parsed.data.claims as Record<string, unknown> | undefined) ?? null,
        revoked: parsed.data.revoked,
      },
      error: null,
    };
  } catch (err) {
    if (err instanceof AgeKeyApiError) {
      return {
        ok: false,
        response: null,
        error: `Falha na verificação (${err.reasonCode}).`,
      };
    }
    return {
      ok: false,
      response: null,
      error: 'Falha ao contatar o serviço de verificação.',
    };
  }
}
