// audit-csv.ts
//
// RFC 4180 compatible CSV serializer for the audit-events export.
//
// Why inline (no third-party CSV lib):
//   - The audit export is the only consumer.
//   - Format is dead-simple (10 fixed columns, no nested escaping beyond
//     the spec).
//   - Avoiding a runtime dep keeps the admin bundle and the Edge Function
//     surface lean.
//
// Spec compliance highlights (RFC 4180):
//   - CRLF (\r\n) terminates every record, including the last.
//   - A field is quoted when it contains DQUOTE, COMMA or CR/LF.
//   - DQUOTE inside a quoted field is escaped by doubling it.
//   - Header row is required.
//   - The text is UTF-8 (caller sets Content-Type accordingly).

export const AUDIT_CSV_COLUMNS = [
  'created_at_utc',
  'tenant_id',
  'actor_type',
  'actor_id',
  'action',
  'resource_type',
  'resource_id',
  'client_ip',
  'user_agent',
  'diff_json',
] as const;

export type AuditCsvColumn = (typeof AUDIT_CSV_COLUMNS)[number];

export interface AuditCsvRowInput {
  readonly created_at: string;
  readonly tenant_id: string;
  readonly actor_type: string;
  readonly actor_id: string | null;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string | null;
  readonly client_ip: string | null;
  readonly user_agent: string | null;
  readonly diff_json: unknown;
}

const CRLF = '\r\n';
const NEEDS_QUOTING = /[",\r\n]/;

/**
 * Escape a single CSV field per RFC 4180.
 *
 * - `null` / `undefined` collapse to an empty (unquoted) field. We make a
 *   conscious choice to NOT serialize `null` literally — spreadsheets read
 *   that back as the string "null", which is misleading.
 * - Numbers/booleans are stringified.
 * - Anything else (including objects) is JSON-encoded so the cell contains
 *   parseable JSON. Callers should JSON-stringify upstream when they want
 *   custom formatting.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str: string;
  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    str = String(value);
  } else {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  }

  if (NEEDS_QUOTING.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a single CSV record (without trailing CRLF).
 */
export function buildCsvRecord(values: readonly unknown[]): string {
  return values.map(escapeCsvField).join(',');
}

/**
 * Convert one audit row to its CSV-ready cell tuple, in the order defined
 * by `AUDIT_CSV_COLUMNS`. The `diff_json` cell is JSON-stringified ahead
 * of time so the caller can inspect / redact it before passing through.
 */
export function auditRowToCells(
  row: AuditCsvRowInput,
): readonly unknown[] {
  const diffSerialized = (() => {
    try {
      return JSON.stringify(row.diff_json ?? {});
    } catch {
      return '{}';
    }
  })();

  return [
    row.created_at,
    row.tenant_id,
    row.actor_type,
    row.actor_id,
    row.action,
    row.resource_type,
    row.resource_id,
    row.client_ip,
    row.user_agent,
    diffSerialized,
  ];
}

/**
 * Build the full CSV body (header + records) from a list of audit rows.
 *
 * The function does NOT enforce the 10k cap; the caller is expected to
 * have already truncated to keep the cap server-side (see export action).
 */
export function buildAuditCsv(rows: readonly AuditCsvRowInput[]): string {
  const header = buildCsvRecord(AUDIT_CSV_COLUMNS);
  if (rows.length === 0) return `${header}${CRLF}`;
  const body = rows.map((r) => buildCsvRecord(auditRowToCells(r))).join(CRLF);
  return `${header}${CRLF}${body}${CRLF}`;
}

/**
 * Hard cap exposed as a constant so the cap is auditable in one place.
 */
export const AUDIT_CSV_MAX_ROWS = 10_000;
