'use server';

import { revalidatePath } from 'next/cache';
import { agekey, AgeKeyApiError } from '@/lib/agekey/client';
import type {
  WebhookDeliveriesListResult,
  WebhookDeliveryStatus,
  WebhookEndpointItem,
} from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';
import { WebhookEndpointWriteRequestSchema } from '@/lib/validations/webhooks';

// Same role gate as applications: owners + admins can mutate; auditor /
// operator / billing can read but never write. Mirrors RLS on
// webhook_endpoints (`has_role('admin')` for INSERT/UPDATE).
const WEBHOOK_WRITE_ROLES = new Set(['owner', 'admin']);

type FieldErrors = Partial<
  Record<
    'application_id' | 'name' | 'url' | 'event_types' | 'active',
    string[]
  >
>;

export type ListWebhooksActionResult =
  | { ok: true; items: WebhookEndpointItem[] }
  | { ok: false; error: string };

export type CreateWebhookActionResult =
  | { ok: true; id: string; raw_secret: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors };

export type UpdateWebhookActionResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors };

export type DeleteWebhookActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type RotateSecretActionResult =
  | { ok: true; raw_secret: string; rotated_at: string }
  | { ok: false; error: string };

export type ListDeliveriesActionResult =
  | { ok: true; data: WebhookDeliveriesListResult }
  | { ok: false; error: string };

interface RawWebhookFormPayload {
  id?: string;
  application_id: string;
  name: string;
  url: string;
  event_types: string[];
  active: boolean;
}

function parseFormData(formData: FormData): RawWebhookFormPayload {
  const id = formData.get('id');
  const applicationId = formData.get('application_id');
  const name = formData.get('name');
  const url = formData.get('url');
  const eventTypesRaw = formData.get('event_types');
  const active = formData.get('active');

  let event_types: unknown = [];
  if (typeof eventTypesRaw === 'string' && eventTypesRaw.length > 0) {
    try {
      event_types = JSON.parse(eventTypesRaw);
    } catch {
      event_types = [];
    }
  }

  return {
    id: typeof id === 'string' && id.length > 0 ? id : undefined,
    application_id: typeof applicationId === 'string' ? applicationId : '',
    name: typeof name === 'string' ? name : '',
    url: typeof url === 'string' ? url : '',
    event_types: Array.isArray(event_types)
      ? event_types.filter((v): v is string => typeof v === 'string')
      : [],
    active: active === 'true' || active === 'on',
  };
}

function mapApiError(err: unknown, defaultMessage: string): string {
  if (err instanceof AgeKeyApiError) {
    if (err.reasonCode === 'WEBHOOK_URL_INVALID_SCHEME') {
      return 'Webhook URL precisa usar https.';
    }
    if (err.reasonCode === 'WEBHOOK_URL_INTERNAL_BLOCKED') {
      return 'URLs internas/privadas não são permitidas.';
    }
    if (err.reasonCode === 'WEBHOOK_NOT_FOUND') {
      return 'Endpoint de webhook não encontrado.';
    }
    if (
      err.reasonCode === 'WEBHOOK_FORBIDDEN_TENANT' ||
      err.reasonCode === 'FORBIDDEN'
    ) {
      return 'Você não tem permissão para esta operação.';
    }
    if (err.reasonCode === 'NOT_FOUND') {
      return 'Recurso não encontrado.';
    }
    return `${defaultMessage} (${err.reasonCode}).`;
  }
  return defaultMessage;
}

export async function listWebhooksAction(): Promise<ListWebhooksActionResult> {
  await requireTenantContext();
  try {
    const result = await agekey.webhooks.list();
    return { ok: true, items: result.items };
  } catch (err) {
    return {
      ok: false,
      error: mapApiError(err, 'Falha ao listar webhooks'),
    };
  }
}

export async function createWebhookAction(
  formData: FormData,
): Promise<CreateWebhookActionResult> {
  const ctx = await requireTenantContext();
  if (!WEBHOOK_WRITE_ROLES.has(ctx.role)) {
    return {
      ok: false,
      error: 'Você não tem permissão para criar webhooks. Peça a um admin do tenant.',
    };
  }

  const raw = parseFormData(formData);
  const parsed = WebhookEndpointWriteRequestSchema.safeParse({
    application_id: raw.application_id,
    name: raw.name,
    url: raw.url,
    event_types: raw.event_types,
    active: raw.active,
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as FieldErrors,
    };
  }

  try {
    const result = await agekey.webhooks.write({
      application_id: parsed.data.application_id,
      name: parsed.data.name,
      url: parsed.data.url,
      event_types: parsed.data.event_types,
      active: parsed.data.active,
    });
    if (!result.raw_secret) {
      return {
        ok: false,
        error: 'O servidor não retornou o secret. Contate o suporte.',
      };
    }
    revalidatePath('/webhooks');
    return { ok: true, id: result.id, raw_secret: result.raw_secret };
  } catch (err) {
    return {
      ok: false,
      error: mapApiError(err, 'Falha ao criar webhook'),
    };
  }
}

export async function updateWebhookAction(
  formData: FormData,
): Promise<UpdateWebhookActionResult> {
  const ctx = await requireTenantContext();
  if (!WEBHOOK_WRITE_ROLES.has(ctx.role)) {
    return {
      ok: false,
      error: 'Você não tem permissão para editar webhooks. Peça a um admin do tenant.',
    };
  }

  const raw = parseFormData(formData);
  if (!raw.id) {
    return { ok: false, error: 'Identificador do webhook ausente.' };
  }

  const parsed = WebhookEndpointWriteRequestSchema.safeParse({
    id: raw.id,
    application_id: raw.application_id,
    name: raw.name,
    url: raw.url,
    event_types: raw.event_types,
    active: raw.active,
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as FieldErrors,
    };
  }

  try {
    const result = await agekey.webhooks.write({
      id: parsed.data.id,
      application_id: parsed.data.application_id,
      name: parsed.data.name,
      url: parsed.data.url,
      event_types: parsed.data.event_types,
      active: parsed.data.active,
    });
    revalidatePath('/webhooks');
    return { ok: true, id: result.id };
  } catch (err) {
    return {
      ok: false,
      error: mapApiError(err, 'Falha ao atualizar webhook'),
    };
  }
}

export async function deleteWebhookAction(
  webhookId: string,
  applicationId: string,
): Promise<DeleteWebhookActionResult> {
  const ctx = await requireTenantContext();
  if (!WEBHOOK_WRITE_ROLES.has(ctx.role)) {
    return {
      ok: false,
      error: 'Você não tem permissão para remover webhooks.',
    };
  }
  if (!webhookId) {
    return { ok: false, error: 'Identificador do webhook ausente.' };
  }
  try {
    const result = await agekey.webhooks.write({
      id: webhookId,
      application_id: applicationId,
      // The remaining required fields are unused on delete but must satisfy
      // the schema; we send canonical placeholders and the server only
      // looks at `id` + `delete: true` on the soft-delete branch.
      name: 'deleted',
      url: 'https://example.com',
      event_types: ['verification.completed'],
      delete: true,
    });
    revalidatePath('/webhooks');
    return { ok: true, id: result.id };
  } catch (err) {
    return {
      ok: false,
      error: mapApiError(err, 'Falha ao remover webhook'),
    };
  }
}

export async function rotateSecretAction(
  webhookId: string,
): Promise<RotateSecretActionResult> {
  const ctx = await requireTenantContext();
  if (!WEBHOOK_WRITE_ROLES.has(ctx.role)) {
    return {
      ok: false,
      error: 'Você não tem permissão para rotacionar secrets.',
    };
  }
  if (!webhookId) {
    return { ok: false, error: 'Identificador do webhook ausente.' };
  }
  try {
    const result = await agekey.webhooks.rotateSecret(webhookId);
    revalidatePath('/webhooks');
    return {
      ok: true,
      raw_secret: result.raw_secret,
      rotated_at: result.rotated_at,
    };
  } catch (err) {
    return {
      ok: false,
      error: mapApiError(err, 'Falha ao rotacionar secret'),
    };
  }
}

export async function listDeliveriesAction(params: {
  endpoint_id: string;
  status?: WebhookDeliveryStatus;
  limit?: number;
}): Promise<ListDeliveriesActionResult> {
  await requireTenantContext();
  if (!params.endpoint_id) {
    return { ok: false, error: 'Identificador do webhook ausente.' };
  }
  try {
    const data = await agekey.webhooks.listDeliveries({
      endpoint_id: params.endpoint_id,
      ...(params.status !== undefined ? { status: params.status } : {}),
      limit: params.limit ?? 50,
    });
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: mapApiError(err, 'Falha ao carregar entregas'),
    };
  }
}
