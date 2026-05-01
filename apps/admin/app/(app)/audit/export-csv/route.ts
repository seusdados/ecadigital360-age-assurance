// GET /audit/export-csv?<filters>
//
// Browser-friendly download endpoint. Accepts the same filter shape as
// the audit page itself (date inputs in YYYY-MM-DD form, free-text
// `action`, optional `actor_id` / `resource_id`) and delegates to the
// Server Action that produced the CSV body.

import { NextResponse, type NextRequest } from 'next/server';
import {
  exportAuditCsvAction,
  type AuditCsvExportInput,
} from '../export-csv-action';
import type { AuditActorType } from '@/lib/agekey/client';

export const dynamic = 'force-dynamic';

const ACTOR_TYPES: ReadonlySet<AuditActorType> = new Set([
  'user',
  'api_key',
  'system',
  'cron',
]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readActor(value: string | null): AuditActorType | undefined {
  if (!value) return undefined;
  return ACTOR_TYPES.has(value as AuditActorType)
    ? (value as AuditActorType)
    : undefined;
}

function readUuid(value: string | null): string | undefined {
  if (!value) return undefined;
  return UUID_RE.test(value) ? value : undefined;
}

function dateToFromIso(value: string | null): string | undefined {
  if (!value || !DATE_RE.test(value)) return undefined;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function dateToToIso(value: string | null): string | undefined {
  if (!value || !DATE_RE.test(value)) return undefined;
  const t = new Date(`${value}T00:00:00.000Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString();
}

function defaultFromDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest): Promise<Response> {
  const sp = req.nextUrl.searchParams;

  const action = sp.get('action')?.trim() || undefined;
  const resource_type = sp.get('resource_type')?.trim() || undefined;
  const fromDate = sp.get('from_date') ?? defaultFromDate();
  const toDate = sp.get('to_date') ?? new Date().toISOString().slice(0, 10);

  const input: AuditCsvExportInput = {
    action,
    resource_type,
    resource_id: readUuid(sp.get('resource_id')),
    actor_type: readActor(sp.get('actor_type')),
    actor_id: readUuid(sp.get('actor_id')),
    from: dateToFromIso(fromDate),
    to: dateToToIso(toDate),
  };

  try {
    return await exportAuditCsvAction(input);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'export_failed',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}
