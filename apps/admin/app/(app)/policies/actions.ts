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

export async function savePolicyAction(
  input: PolicyFormInput,
): Promise<PolicyActionState> {
  await requireTenantContext();

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
