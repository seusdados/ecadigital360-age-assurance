'use server';

import { revalidatePath } from 'next/cache';
import { agekey, AgeKeyApiError, type PolicyWriteInput } from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import {
  PolicyFormSchema,
  type PolicyFormInput,
} from '@/lib/validations/policies';

export interface PolicyActionState {
  status: 'idle' | 'success' | 'error';
  error?: string;
  fieldErrors?: Partial<Record<keyof PolicyFormInput, string[]>>;
  result?: { id: string; version: number; status: 'created' | 'updated' };
}

// Roles permitidas a mutar policies. Tem que ser owner ou admin do tenant.
// auditor/billing/operator podem ler mas não escrever.
const POLICY_WRITE_ROLES = new Set(['owner', 'admin']);

export async function savePolicyAction(
  input: PolicyFormInput,
): Promise<PolicyActionState> {
  const ctx = await requireTenantContext();
  if (!POLICY_WRITE_ROLES.has(ctx.role)) {
    return {
      status: 'error',
      error: 'Você não tem permissão para alterar políticas. Peça a um admin do tenant.',
    };
  }

  const parsed = PolicyFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: parsed.error.flatten().fieldErrors as PolicyActionState['fieldErrors'],
    };
  }

  const data = parsed.data;
  const body: PolicyWriteInput = {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description,
    age_threshold: data.age_threshold,
    jurisdiction_code: data.jurisdiction_code ?? null,
    method_priority_json: data.method_priority_json,
    required_assurance_level: data.required_assurance_level,
    token_ttl_seconds: data.token_ttl_seconds,
    cloned_from_id: data.cloned_from_id ?? null,
  };

  try {
    const result = await agekey.policies.write(body);
    revalidatePath('/policies');
    if (data.id) {
      revalidatePath(`/policies/${data.id}`);
    } else {
      revalidatePath(`/policies/${result.id}`);
    }
    return { status: 'success', result };
  } catch (err) {
    if (err instanceof AgeKeyApiError) {
      return {
        status: 'error',
        error: `Não foi possível salvar a política (${err.reasonCode}).`,
      };
    }
    return {
      status: 'error',
      error: 'Erro inesperado ao salvar a política.',
    };
  }
}
