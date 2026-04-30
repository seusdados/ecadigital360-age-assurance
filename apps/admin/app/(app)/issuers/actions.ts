'use server';

import { revalidatePath } from 'next/cache';
import {
  agekey,
  AgeKeyApiError,
  type IssuerRegisterInput,
} from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import {
  IssuerFormSchema,
  type IssuerFormInput,
} from '@/lib/validations/issuers';

export interface IssuerActionState {
  status: 'idle' | 'success' | 'error';
  error?: string;
  fieldErrors?: Partial<Record<keyof IssuerFormInput, string[]>>;
  result?: { id: string; status: 'created' | 'updated' };
}

// Roles permitidas a mutar issuers. Tem que ser owner ou admin do tenant.
const ISSUER_WRITE_ROLES = new Set(['owner', 'admin']);

export async function saveIssuerAction(
  input: IssuerFormInput,
): Promise<IssuerActionState> {
  const ctx = await requireTenantContext();
  if (!ISSUER_WRITE_ROLES.has(ctx.role)) {
    return {
      status: 'error',
      error: 'Você não tem permissão para registrar/atualizar emissores. Peça a um admin do tenant.',
    };
  }

  const parsed = IssuerFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: parsed.error.flatten()
        .fieldErrors as IssuerActionState['fieldErrors'],
    };
  }

  const data = parsed.data;
  const body: IssuerRegisterInput = {
    issuer_did: data.issuer_did,
    name: data.name,
    supports_formats: data.supports_formats,
    ...(data.jwks_uri ? { jwks_uri: data.jwks_uri } : {}),
    ...(data.public_keys_json
      ? { public_keys_json: data.public_keys_json }
      : {}),
    ...(data.metadata_json ? { metadata_json: data.metadata_json } : {}),
  };

  try {
    const result = await agekey.issuers.register(body);
    revalidatePath('/issuers');
    return { status: 'success', result };
  } catch (err) {
    if (err instanceof AgeKeyApiError) {
      return {
        status: 'error',
        error: `Não foi possível registrar o emissor (${err.reasonCode}).`,
      };
    }
    return {
      status: 'error',
      error: 'Erro inesperado ao registrar o emissor.',
    };
  }
}
