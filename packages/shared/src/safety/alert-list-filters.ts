// Server-side parsing for the Safety alerts list filters.
//
// Lives in @agekey/shared so the Next.js page and unit tests can share
// the same logic. Pure module: no React, no Next.js, no DB driver.
//
// Inputs are untrusted (they come from `searchParams`). We accept only
// enum values for `status`/`severity`, a regex-safe shape for
// `rule_code`, and an ISO-8601 instant for `since`. Pagination is
// clamped to a maximum window so a caller can never request an
// unbounded slice from the database.

export const ALERT_STATUSES = [
  'open',
  'acknowledged',
  'escalated',
  'resolved',
  'dismissed',
] as const;
export type AlertStatusFilter = (typeof ALERT_STATUSES)[number];

export const ALERT_SEVERITIES = [
  'info',
  'low',
  'medium',
  'high',
  'critical',
] as const;
export type AlertSeverityFilter = (typeof ALERT_SEVERITIES)[number];

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
export const MAX_OFFSET = 50_000;

const RULE_CODE_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

export interface AlertListFilters {
  status: AlertStatusFilter | null;
  severity: AlertSeverityFilter | null;
  ruleCode: string | null;
  since: string | null;
  pageSize: number;
  offset: number;
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === 'string') return value;
  return null;
}

function parseStatus(raw: string | null): AlertStatusFilter | null {
  if (!raw) return null;
  return (ALERT_STATUSES as readonly string[]).includes(raw)
    ? (raw as AlertStatusFilter)
    : null;
}

function parseSeverity(raw: string | null): AlertSeverityFilter | null {
  if (!raw) return null;
  return (ALERT_SEVERITIES as readonly string[]).includes(raw)
    ? (raw as AlertSeverityFilter)
    : null;
}

function parseRuleCode(raw: string | null): string | null {
  if (!raw) return null;
  return RULE_CODE_RE.test(raw) ? raw : null;
}

function parseSince(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parsePageSize(raw: string | null): number {
  if (!raw) return DEFAULT_PAGE_SIZE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

function parseOffset(raw: string | null): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_OFFSET);
}

export function parseAlertFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AlertListFilters {
  return {
    status: parseStatus(firstParam(searchParams.status)),
    severity: parseSeverity(firstParam(searchParams.severity)),
    ruleCode: parseRuleCode(firstParam(searchParams.rule_code)),
    since: parseSince(firstParam(searchParams.since)),
    pageSize: parsePageSize(firstParam(searchParams.page_size)),
    offset: parseOffset(firstParam(searchParams.offset)),
  };
}

export function buildAlertFilterQueryString(
  filters: AlertListFilters,
  override?: Partial<Pick<AlertListFilters, 'offset' | 'pageSize'>>,
): string {
  const merged: AlertListFilters = { ...filters, ...override };
  const parts: string[] = [];
  if (merged.status) parts.push(`status=${encodeURIComponent(merged.status)}`);
  if (merged.severity)
    parts.push(`severity=${encodeURIComponent(merged.severity)}`);
  if (merged.ruleCode)
    parts.push(`rule_code=${encodeURIComponent(merged.ruleCode)}`);
  if (merged.since) parts.push(`since=${encodeURIComponent(merged.since)}`);
  if (merged.pageSize !== DEFAULT_PAGE_SIZE) {
    parts.push(`page_size=${merged.pageSize}`);
  }
  if (merged.offset > 0) parts.push(`offset=${merged.offset}`);
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}
