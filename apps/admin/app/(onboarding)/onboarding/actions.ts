'use server';

import {
  TenantBootstrapRequestSchema,
  type TenantBootstrapRequest,
  type TenantBootstrapResponse,
} from '@agekey/shared';
import { agekeyEnv } from '@/lib/agekey/env';
import { createClient } from '@/lib/supabase/server';

export type BootstrapActionResult =
  | {
      ok: true;
      data: TenantBootstrapResponse;
    }
  | {
      ok: false;
      error: string;
      reasonCode?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * Calls /tenant-bootstrap with the *user's* Supabase JWT (Authorization: Bearer)
 * — NOT the admin API key. This Edge Function is the only place the panel
 * provisions a brand-new tenant, and it requires user identity to install
 * the calling user as the tenant owner.
 *
 * Returns the raw api_key + webhook_secret on success — caller is responsible
 * for the one-time exposure UX (caller never persists or logs them).
 */
export async function bootstrapTenantAction(
  input: TenantBootstrapRequest,
): Promise<BootstrapActionResult> {
  const parsed = TenantBootstrapRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Dados inválidos. Revise os campos abaixo.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      ok: false,
      error: 'Sessão expirada. Faça login novamente.',
    };
  }

  const url = new URL(`${agekeyEnv.apiBase()}/tenant-bootstrap`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return {
      ok: false,
      error: 'Não foi possível contatar o serviço. Tente novamente.',
    };
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const body =
      isJson && payload && typeof payload === 'object'
        ? (payload as {
            reason_code?: string;
            message?: string;
          })
        : null;
    return {
      ok: false,
      reasonCode: body?.reason_code ?? 'INTERNAL_ERROR',
      error:
        body?.message ??
        `Falha ao criar tenant (HTTP ${response.status}). Verifique os campos e tente novamente.`,
    };
  }

  return {
    ok: true,
    data: payload as TenantBootstrapResponse,
  };
}
