'use server';

// Server Action: export of audit_events as CSV.
//
// Returns a `Response` with `text/csv; charset=utf-8` body and a
// `Content-Disposition: attachment; filename=…` header. Downloads are
// usually triggered through the GET Route Handler at
// `./export-csv/route.ts` (cleaner browser semantics). This action is
// kept around for callers that prefer a typed server-side invocation
// (e.g. from another Server Component flow that needs to materialize
// the same CSV body).
//
// Design points worth knowing:
//   * Hard cap of `AUDIT_CSV_MAX_ROWS` (10 000) is enforced server-side
//     by the Edge Function via `limit` AND defensively here by slicing
//     the array — never trust the client to limit itself.
//   * `assertPublicPayloadHasNoPii` walks every `diff_json` BEFORE
//     serialization. If a row leaks PII (it should not — triggers strip
//     PII at write time) we replace it with `{ pii_redacted: true }`
//     and log a server-side warning. This is a defense-in-depth layer,
//     not a substitute for trigger-side hygiene.
//   * The 10 000-row scan is single-shot — for very large tenants the
//     Edge Function may take a few seconds. A streaming server-side
//     pagination (chunks of 1k) is intentionally future work; see
//     pending-work-backlog.

import {
  AUDIT_CSV_MAX_ROWS,
  buildAuditCsv,
  findForbiddenPublicPayloadKeys,
  type AuditCsvRowInput,
} from '@agekey/shared';
import {
  agekey,
  AgeKeyApiError,
  type AuditEventItem,
  type AuditListParams,
} from '@/lib/agekey/client';
import { requireTenantContext } from '@/lib/agekey/tenant';

export interface AuditCsvExportInput {
  action?: string;
  resource_type?: string;
  resource_id?: string;
  actor_type?: AuditListParams['actor_type'];
  actor_id?: string;
  from?: string;
  to?: string;
}

const PII_REDACTED_MARKER: Record<string, unknown> = { pii_redacted: true };

/**
 * Sanitize a `diff_json` payload before it is written into the CSV. If the
 * payload contains any forbidden PII-like keys, we replace it wholesale
 * with `{ pii_redacted: true }`. We do NOT attempt to trim individual
 * fields — `diff_json` is a small object emitted by triggers, and any
 * unexpected key shape signals a deeper bug that operators should see in
 * server logs.
 */
function sanitizeDiffForExport(
  eventId: string,
  diff: unknown,
): unknown {
  const violations = findForbiddenPublicPayloadKeys(diff, '$diff_json');
  if (violations.length === 0) return diff ?? {};
  // eslint-disable-next-line no-console
  console.warn('[audit-csv] PII redacted in diff_json', {
    audit_event_id: eventId,
    keys: violations.map((v) => v.key),
  });
  return PII_REDACTED_MARKER;
}

/**
 * Pull at most AUDIT_CSV_MAX_ROWS rows from the audit-list Edge Function.
 * The Edge Function honors the same RLS policy the panel relies on
 * (`auditor` role), so an unauthorized caller would simply receive an
 * empty list. We still go through `requireTenantContext()` first to keep
 * a clean 302 → /login flow on the panel side.
 */
export async function fetchAuditRowsForExport(
  input: AuditCsvExportInput,
): Promise<{ rows: AuditEventItem[]; truncated: boolean }> {
  await requireTenantContext();

  const params: AuditListParams = {
    action: input.action,
    resource_type: input.resource_type,
    resource_id: input.resource_id,
    actor_type: input.actor_type,
    actor_id: input.actor_id,
    from: input.from,
    to: input.to,
    limit: AUDIT_CSV_MAX_ROWS,
  };

  const result = await agekey.audit.list(params);
  const rows = result.items.slice(0, AUDIT_CSV_MAX_ROWS);
  // The Edge Function over-fetches by 1 to compute `has_more`. If it
  // signaled has_more AND we already hold the cap, the export is
  // truncated and the UI should warn the operator.
  const truncated = result.has_more || rows.length >= AUDIT_CSV_MAX_ROWS;
  return { rows, truncated };
}

/**
 * Materialize the CSV body for the supplied filter set.
 *
 * Pure: no Response, no headers — useful in tests and from the GET Route
 * Handler that wraps it.
 */
export async function buildAuditCsvBody(
  input: AuditCsvExportInput,
): Promise<{ csv: string; truncated: boolean; rowCount: number }> {
  const { rows, truncated } = await fetchAuditRowsForExport(input);

  const csvRows: AuditCsvRowInput[] = rows.map((r) => ({
    created_at: r.created_at,
    tenant_id: r.tenant_id,
    actor_type: r.actor_type,
    actor_id: r.actor_id,
    action: r.action,
    resource_type: r.resource_type,
    resource_id: r.resource_id,
    client_ip: r.client_ip,
    user_agent: r.user_agent,
    diff_json: sanitizeDiffForExport(r.id, r.diff_json),
  }));

  return {
    csv: buildAuditCsv(csvRows),
    truncated,
    rowCount: csvRows.length,
  };
}

function buildFilenameSuffix(input: AuditCsvExportInput): string {
  const slugDate = (iso: string | undefined): string => {
    if (!iso) return 'all';
    return iso.slice(0, 10);
  };
  return `${slugDate(input.from)}-${slugDate(input.to)}`;
}

/**
 * Server Action wrapper: returns a `Response` with the CSV body so the
 * caller can stream it straight to the browser. The tenant slug is
 * resolved here so the filename is deterministic and human-readable.
 */
export async function exportAuditCsvAction(
  input: AuditCsvExportInput,
): Promise<Response> {
  const tenant = await requireTenantContext();

  let body: { csv: string; truncated: boolean; rowCount: number };
  try {
    body = await buildAuditCsvBody(input);
  } catch (err) {
    const reason =
      err instanceof AgeKeyApiError
        ? `Falha ao exportar (${err.reasonCode}).`
        : 'Falha ao exportar auditoria.';
    return new Response(reason, {
      status: err instanceof AgeKeyApiError ? err.status : 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const filename = `audit-${tenant.tenantSlug}-${buildFilenameSuffix(input)}.csv`;

  return new Response(body.csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
      // Surface to the client whether the export was capped at 10k rows
      // so the FilterBar can show a non-blocking warning.
      'x-agekey-truncated': body.truncated ? 'true' : 'false',
      'x-agekey-row-count': String(body.rowCount),
    },
  });
}
