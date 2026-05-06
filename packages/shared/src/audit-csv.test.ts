import { describe, it, expect } from 'vitest';
import {
  AUDIT_CSV_COLUMNS,
  AUDIT_CSV_MAX_ROWS,
  auditRowToCells,
  buildAuditCsv,
  buildCsvRecord,
  escapeCsvField,
  type AuditCsvRowInput,
} from './audit-csv.ts';

const baseRow: AuditCsvRowInput = {
  created_at: '2026-05-01T00:00:00.000Z',
  tenant_id: '00000000-0000-0000-0000-000000000001',
  actor_type: 'user',
  actor_id: '00000000-0000-0000-0000-0000000000aa',
  action: 'policy.update',
  resource_type: 'policy',
  resource_id: '00000000-0000-0000-0000-0000000000bb',
  client_ip: '203.0.113.42',
  user_agent: 'Mozilla/5.0',
  diff_json: { fields: ['name'] },
};

describe('audit-csv / escapeCsvField', () => {
  it('returns empty string for null/undefined (does not write the literal "null")', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('passes plain ASCII through unquoted', () => {
    expect(escapeCsvField('policy.update')).toBe('policy.update');
  });

  it('quotes and doubles inner quotes (RFC 4180)', () => {
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('quotes a field containing a comma', () => {
    expect(escapeCsvField('Vinhedo, SP')).toBe('"Vinhedo, SP"');
  });

  it('quotes a field containing CR or LF', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('coerces numbers and booleans to strings', () => {
    expect(escapeCsvField(42)).toBe('42');
    expect(escapeCsvField(true)).toBe('true');
  });

  it('JSON-encodes plain objects (and quotes for the embedded comma)', () => {
    expect(escapeCsvField({ k: 'v', n: 1 })).toBe('"{""k"":""v"",""n"":1}"');
  });
});

describe('audit-csv / buildCsvRecord', () => {
  it('joins fields with comma — no trailing newline', () => {
    expect(buildCsvRecord(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('escapes per-cell when joining', () => {
    expect(buildCsvRecord(['a,b', null, 'c"d'])).toBe('"a,b",,"c""d"');
  });
});

describe('audit-csv / buildAuditCsv', () => {
  it('emits header + a single record terminated by CRLF', () => {
    const csv = buildAuditCsv([baseRow]);
    const expectedHeader = AUDIT_CSV_COLUMNS.join(',');
    expect(csv.startsWith(`${expectedHeader}\r\n`)).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    // Header + 1 data line ⇒ exactly 2 records terminated by CRLF.
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(2);
  });

  it('serializes diff_json as JSON inside a quoted cell', () => {
    const csv = buildAuditCsv([baseRow]);
    // diff_json contains a comma → quoted, with doubled inner quotes.
    expect(csv).toContain('"{""fields"":[""name""]}"');
  });

  it('preserves a multi-line value inside a quoted cell (CRLF survives)', () => {
    const csv = buildAuditCsv([
      { ...baseRow, user_agent: 'AgeKey-CLI/1.0\nlinux' },
    ]);
    expect(csv).toContain('"AgeKey-CLI/1.0\nlinux"');
  });

  it('emits empty cells for null actor_id / resource_id without quoting', () => {
    const csv = buildAuditCsv([
      { ...baseRow, actor_id: null, resource_id: null },
    ]);
    // Exactly two adjacent commas around the empty cells, never the
    // literal "null".
    expect(csv).not.toContain(',null,');
    expect(csv).toMatch(/,,/);
  });

  it('emits header-only output when no rows are provided', () => {
    const csv = buildAuditCsv([]);
    expect(csv).toBe(`${AUDIT_CSV_COLUMNS.join(',')}\r\n`);
  });

  it('represents a redacted diff_json marker as JSON, not as the word [redacted]', () => {
    const csv = buildAuditCsv([
      { ...baseRow, diff_json: { pii_redacted: true } },
    ]);
    expect(csv).toContain('"{""pii_redacted"":true}"');
  });
});

describe('audit-csv / auditRowToCells', () => {
  it('returns cells in the canonical column order', () => {
    const cells = auditRowToCells(baseRow);
    expect(cells).toHaveLength(AUDIT_CSV_COLUMNS.length);
    // First cell maps to created_at; last cell maps to diff_json (string).
    expect(cells[0]).toBe(baseRow.created_at);
    expect(typeof cells[cells.length - 1]).toBe('string');
  });
});

describe('audit-csv / hard cap', () => {
  it('exposes the documented 10k row hard cap', () => {
    expect(AUDIT_CSV_MAX_ROWS).toBe(10_000);
  });
});
