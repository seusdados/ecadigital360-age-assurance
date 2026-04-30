'use server';

import { revalidatePath } from 'next/cache';
import { agekey, AgeKeyApiError } from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { SharedApplicationWriteRequestSchema as ApplicationWriteRequestSchema } from '@/lib/validations/applications';

// Roles permitidas a mutar applications (criar/atualizar/rotacionar chave).
// auditor/billing/operator podem ler mas nunca escrever.
const APP_WRITE_ROLES = new Set(['owner', 'admin']);

type FieldErrors = Partial<
  Record<
    'name' | 'slug' | 'description' | 'callback_url' | 'webhook_url' | 'allowed_origins',
    string[]
  >
>;

export type CreateApplicationActionResult =
  | {
      ok: true;
      id: string;
      api_key: string;
      webhook_secret: string;
    }
  | {
      ok: false;
      error?: string;
      fieldErrors?: FieldErrors;
    };

export type UpdateApplicationActionResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors };

export type RotateKeyActionResult =
  | {
      ok: true;
      api_key: string;
      api_key_prefix: string;
      rotated_at: string;
    }
  | { ok: false; error?: string };

interface RawFormPayload {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  callback_url?: string;
  webhook_url?: string;
  allowed_origins: string[];
}

function parseFormData(formData: FormData): RawFormPayload {
  const id = formData.get('id');
  const name = formData.get('name');
  const slug = formData.get('slug');
  const description = formData.get('description');
  const callbackUrl = formData.get('callback_url');
  const webhookUrl = formData.get('webhook_url');
  const allowedOriginsRaw = formData.get('allowed_origins');

  // allowed_origins vem JSON-encoded do form. Em caso de payload corrompido
  // (cliente tampered, network glitch, etc.), JSON.parse lança SyntaxError —
  // capturamos e devolvemos array vazio pra caller tratar via Zod validation
  // (em vez de derrubar a action com 500). Codex P2.
  let allowed_origins: unknown = [];
  if (typeof allowedOriginsRaw === 'string' && allowedOriginsRaw.length > 0) {
    try {
      allowed_origins = JSON.parse(allowedOriginsRaw);
    } catch {
      allowed_origins = [];
    }
  }

  return {
    id: typeof id === 'string' && id.length > 0 ? id : undefined,
    name: typeof name === 'string' ? name : '',
    slug: typeof slug === 'string' ? slug : '',
    description:
      typeof description === 'string' && description.length > 0
        ? description
        : undefined,
    callback_url:
      typeof callbackUrl === 'string' && callbackUrl.length > 0
        ? callbackUrl
        : undefined,
    webhook_url:
      typeof webhookUrl === 'string' && webhookUrl.length > 0
        ? webhookUrl
        : undefined,
    allowed_origins: Array.isArray(allowed_origins)
      ? allowed_origins.filter((v): v is string => typeof v === 'string')
      : [],
  };
}

function mapApiError(err: unknown, defaultMessage: string): string {
  if (err instanceof AgeKeyApiError) {
    if (err.reasonCode === 'CONFLICT' || err.reasonCode === 'SLUG_TAKEN') {
      return 'Já existe uma aplicação com este slug.';
    }
    if (err.reasonCode === 'FORBIDDEN') {
      return 'Você não tem permissão para esta operação.';
    }
    if (err.reasonCode === 'NOT_FOUND') {
      return 'Aplicação não encontrada.';
    }
    return `${defaultMessage} (${err.reasonCode}).`;
  }
  return defaultMessage;
}

export async function createApplicationAction(
  formData: FormData,
): Promise<CreateApplicationActionResult> {
  // Tenant + role guard. AGEKEY_ADMIN_API_KEY tem acesso total a TODAS as
  // applications do tenant; sem este check, qualquer member autenticado podia
  // criar/editar via Server Action. Codex P1.
  const ctx = await requireTenantContext();
  if (!APP_WRITE_ROLES.has(ctx.role)) {
    return {
      ok: false,
      error: 'Você não tem permissão para criar aplicações. Peça a um admin do tenant.',
    };
  }

  const raw = parseFormData(formData);
  const parsed = ApplicationWriteRequestSchema.safeParse({
    name: raw.name,
    slug: raw.slug,
    description: raw.description,
    callback_url: raw.callback_url,
    webhook_url: raw.webhook_url,
    allowed_origins: raw.allowed_origins,
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as FieldErrors,
    };
  }

  try {
    const result = await agekey.applications.write(parsed.data);
    if (!result.api_key || !result.webhook_secret) {
      return {
        ok: false,
        error: 'O servidor não retornou os segredos. Contate o suporte.',
      };
    }
    revalidatePath('/applications');
    return {
      ok: true,
      id: result.id,
      api_key: result.api_key,
      webhook_secret: result.webhook_secret,
    };
  } catch (err) {
    return {
      ok: false,
      error: mapApiError(err, 'Falha ao criar aplicação'),
    };
  }
}

export async function updateApplicationAction(
  formData: FormData,
): Promise<UpdateApplicationActionResult> {
  const ctx = await requireTenantContext();
  if (!APP_WRITE_ROLES.has(ctx.role)) {
    return {
      ok: false,
      error: 'Você não tem permissão para editar aplicações. Peça a um admin do tenant.',
    };
  }

  const raw = parseFormData(formData);
  if (!raw.id) {
    return { ok: false, error: 'Identificador da aplicação ausente.' };
  }

  const parsed = ApplicationWriteRequestSchema.safeParse({
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    description: raw.description,
    callback_url: raw.callback_url,
    webhook_url: raw.webhook_url,
    allowed_origins: raw.allowed_origins,
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as FieldErrors,
    };
  }

  try {
    const result = await agekey.applications.write(parsed.data);
    revalidatePath('/applications');
    return { ok: true, id: result.id };
  } catch (err) {
    return {
      ok: false,
      error: mapApiError(err, 'Falha ao atualizar aplicação'),
    };
  }
}

export async function rotateKeyAction(
  applicationId: string,
): Promise<RotateKeyActionResult> {
  const ctx = await requireTenantContext();
  if (!APP_WRITE_ROLES.has(ctx.role)) {
    return {
      ok: false,
      error: 'Você não tem permissão para rotacionar chaves. Peça a um admin do tenant.',
    };
  }

  if (!applicationId) {
    return { ok: false, error: 'Identificador da aplicação ausente.' };
  }
  try {
    const result = await agekey.applications.rotateKey(applicationId);
    revalidatePath('/applications');
    return {
      ok: true,
      api_key: result.api_key,
      api_key_prefix: result.api_key_prefix,
      rotated_at: result.rotated_at,
    };
  } catch (err) {
    return {
      ok: false,
      error: mapApiError(err, 'Falha ao rotacionar chave'),
    };
  }
}
