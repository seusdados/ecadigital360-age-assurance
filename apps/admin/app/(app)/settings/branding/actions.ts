'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/agekey/tenant';

export interface BrandingActionState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<
    Record<'primary_color' | 'logo_url' | 'support_email' | 'retention_days', string[]>
  >;
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const BrandingSchema = z.object({
  primary_color: z
    .string()
    .trim()
    .regex(HEX_COLOR_RE, 'Use um valor hexadecimal (#rgb ou #rrggbb).')
    .or(z.literal('').transform(() => undefined))
    .optional(),
  logo_url: z
    .string()
    .trim()
    .url('Informe uma URL válida (https://…).')
    .or(z.literal('').transform(() => undefined))
    .optional(),
  support_email: z
    .string()
    .trim()
    .email('E-mail de suporte inválido.')
    .or(z.literal('').transform(() => undefined))
    .optional(),
  retention_days: z.coerce
    .number({ invalid_type_error: 'Informe um número.' })
    .int('Use um valor inteiro.')
    .min(30, 'Mínimo 30 dias.')
    .max(365, 'Máximo 365 dias.'),
});

export async function updateBrandingAction(
  _prev: BrandingActionState,
  formData: FormData,
): Promise<BrandingActionState> {
  const ctx = await requireTenantContext();

  if (
    ctx.role !== 'owner' &&
    ctx.role !== 'admin'
  ) {
    return {
      ok: false,
      error: 'Apenas owner ou admin podem alterar o branding do tenant.',
      fieldErrors: {},
    };
  }

  const parsed = BrandingSchema.safeParse({
    primary_color: formData.get('primary_color'),
    logo_url: formData.get('logo_url'),
    support_email: formData.get('support_email'),
    retention_days: formData.get('retention_days'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: null,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const branding: Record<string, string> = {};
  if (parsed.data.primary_color) {
    branding.primary_color = parsed.data.primary_color;
  }
  if (parsed.data.logo_url) {
    branding.logo_url = parsed.data.logo_url;
  }
  if (parsed.data.support_email) {
    branding.support_email = parsed.data.support_email;
  }

  const supabase = await createClient();
  // Cast: the auto-generated `Database` type is currently a permissive
  // placeholder (see types/database.ts), so the Update generic resolves to
  // `never`. Domain code casts at the query site until `supabase gen types`
  // produces the real schema.
  const update: { branding_json: Record<string, string>; retention_days: number } = {
    branding_json: branding,
    retention_days: parsed.data.retention_days,
  };
  const { error } = await supabase
    .from('tenants')
    .update(update as never)
    .eq('id', ctx.tenantId);

  if (error) {
    return {
      ok: false,
      // Common case: RLS rejects (e.g., role insufficient).
      error: `Falha ao salvar branding: ${error.message}`,
      fieldErrors: {},
    };
  }

  revalidatePath('/settings/branding');
  return { ok: true, error: null, fieldErrors: {} };
}
