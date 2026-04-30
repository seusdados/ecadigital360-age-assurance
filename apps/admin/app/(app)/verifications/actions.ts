'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { agekey, AgeKeyApiError } from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';

const RevokeTokenSchema = z.object({
  jti: z.string().uuid({ message: 'JTI inválido.' }),
  reason: z
    .string()
    .min(3, { message: 'Informe um motivo (mínimo 3 caracteres).' })
    .max(500, { message: 'Motivo muito longo (máximo 500).' }),
  sessionId: z.string().uuid().optional(),
});

export type RevokeTokenActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<'jti' | 'reason', string[]>>;
};

const ALLOWED_ROLES = new Set(['owner', 'admin', 'operator']);

/**
 * Revokes the access token (jti) issued for an approved verification.
 *
 * Role gate: only owner|admin|operator. Auditor / billing must not be able
 * to mutate token state.
 */
export async function revokeTokenAction(
  _prev: RevokeTokenActionState,
  formData: FormData,
): Promise<RevokeTokenActionState> {
  const ctx = await requireTenantContext();

  if (!ALLOWED_ROLES.has(ctx.role)) {
    return {
      error:
        'Seu papel atual não permite revogar tokens. Solicite a um owner, admin ou operator.',
    };
  }

  const parsed = RevokeTokenSchema.safeParse({
    jti: formData.get('jti'),
    reason: formData.get('reason'),
    sessionId: formData.get('sessionId') || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await agekey.tokens.revoke(parsed.data.jti, parsed.data.reason);
  } catch (err) {
    if (err instanceof AgeKeyApiError) {
      return {
        error: `Falha ao revogar token (${err.reasonCode}).`,
      };
    }
    return { error: 'Falha ao revogar token. Tente novamente.' };
  }

  if (parsed.data.sessionId) {
    revalidatePath(`/verifications/${parsed.data.sessionId}`);
  }
  revalidatePath('/verifications');

  return { ok: true };
}
