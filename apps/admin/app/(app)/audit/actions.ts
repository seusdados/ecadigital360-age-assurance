'use server';

import {
  agekey,
  AgeKeyApiError,
  type AuditEventItem,
  type AuditListParams,
} from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';

export interface LoadMoreState {
  items: AuditEventItem[];
  next_cursor: string | null;
  has_more: boolean;
  error: string | null;
}

/**
 * Server Action invoked by the "Carregar mais" button.
 *
 * Re-runs the same filter set (passed in via formData since the URL search
 * params are not available server-side here) plus the cursor. Returns the
 * next page; the Client Component concatenates it into its local state.
 */
export async function loadMoreAuditAction(
  _prev: LoadMoreState,
  formData: FormData,
): Promise<LoadMoreState> {
  // Re-establish tenant context to ensure the user still has access.
  await requireTenantContext();

  const params: AuditListParams = {
    cursor: stringOrUndef(formData.get('cursor')),
    action: stringOrUndef(formData.get('action')),
    resource_type: stringOrUndef(formData.get('resource_type')),
    resource_id: stringOrUndef(formData.get('resource_id')),
    actor_type: actorTypeOrUndef(formData.get('actor_type')),
    actor_id: stringOrUndef(formData.get('actor_id')),
    from: stringOrUndef(formData.get('from')),
    to: stringOrUndef(formData.get('to')),
    limit: pageSizeOrUndef(formData.get('page_size')),
  };

  try {
    const result = await agekey.audit.list(params);
    return {
      items: result.items,
      next_cursor: result.next_cursor,
      has_more: result.has_more,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof AgeKeyApiError
        ? `Falha ao carregar mais eventos (${err.reasonCode}).`
        : 'Falha ao carregar mais eventos.';
    return { items: [], next_cursor: null, has_more: false, error: message };
  }
}

function stringOrUndef(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function actorTypeOrUndef(
  value: FormDataEntryValue | null,
): AuditListParams['actor_type'] {
  const v = stringOrUndef(value);
  if (v === 'user' || v === 'api_key' || v === 'system' || v === 'cron') {
    return v;
  }
  return undefined;
}

function pageSizeOrUndef(value: FormDataEntryValue | null): number | undefined {
  const v = stringOrUndef(value);
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  if (n === 50 || n === 100 || n === 500) return n;
  return undefined;
}
