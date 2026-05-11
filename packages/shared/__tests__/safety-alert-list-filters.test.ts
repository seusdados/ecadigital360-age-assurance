// AgeKey Safety Signals — testes da camada de parsing dos filtros da
// lista de alerts no admin. O helper é puro (sem React/Next) e protege
// contra valores hostis vindos de `searchParams`:
//
//   - apenas valores enum aceitos para status/severity
//   - rule_code restrito a [A-Z][A-Z0-9_]{2,63}
//   - since obrigatoriamente ISO-8601
//   - page_size clampado em [1, MAX_PAGE_SIZE]
//   - offset clampado em [0, MAX_OFFSET]

import { describe, expect, it } from 'vitest';
import {
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  DEFAULT_PAGE_SIZE,
  MAX_OFFSET,
  MAX_PAGE_SIZE,
  buildAlertFilterQueryString,
  parseAlertFilters,
} from '../src/safety/alert-list-filters.ts';

describe('parseAlertFilters', () => {
  it('returns all-null defaults for empty search params', () => {
    const f = parseAlertFilters({});
    expect(f.status).toBeNull();
    expect(f.severity).toBeNull();
    expect(f.ruleCode).toBeNull();
    expect(f.since).toBeNull();
    expect(f.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(f.offset).toBe(0);
  });

  it.each(ALERT_STATUSES)('accepts known status %s', (s) => {
    expect(parseAlertFilters({ status: s }).status).toBe(s);
  });

  it('rejects unknown status', () => {
    expect(parseAlertFilters({ status: 'nuked' }).status).toBeNull();
    expect(parseAlertFilters({ status: 'OPEN' }).status).toBeNull();
    expect(parseAlertFilters({ status: 'open;drop' }).status).toBeNull();
  });

  it.each(ALERT_SEVERITIES)('accepts known severity %s', (s) => {
    expect(parseAlertFilters({ severity: s }).severity).toBe(s);
  });

  it('rejects unknown severity', () => {
    expect(parseAlertFilters({ severity: 'EXTREME' }).severity).toBeNull();
    expect(parseAlertFilters({ severity: '' }).severity).toBeNull();
  });

  it('accepts rule_code matching the canonical regex', () => {
    expect(parseAlertFilters({ rule_code: 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE' }).ruleCode).toBe(
      'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
    );
    expect(parseAlertFilters({ rule_code: 'ABC' }).ruleCode).toBe('ABC');
  });

  it('rejects malformed rule_code (lowercase, special chars, too short)', () => {
    expect(parseAlertFilters({ rule_code: 'unknown_to_minor' }).ruleCode).toBeNull();
    expect(parseAlertFilters({ rule_code: 'AB' }).ruleCode).toBeNull();
    expect(parseAlertFilters({ rule_code: "A; drop table safety_alerts;--" }).ruleCode).toBeNull();
    expect(parseAlertFilters({ rule_code: 'X'.repeat(65) }).ruleCode).toBeNull();
  });

  it('normalises since to ISO-8601 when input is a valid date', () => {
    const f = parseAlertFilters({ since: '2026-05-01T12:00:00Z' });
    expect(f.since).toBe('2026-05-01T12:00:00.000Z');
  });

  it('rejects invalid since', () => {
    expect(parseAlertFilters({ since: 'yesterday' }).since).toBeNull();
    expect(parseAlertFilters({ since: '' }).since).toBeNull();
  });

  it('clamps page_size to [1, MAX_PAGE_SIZE]', () => {
    expect(parseAlertFilters({ page_size: '0' }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parseAlertFilters({ page_size: '-5' }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parseAlertFilters({ page_size: 'abc' }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parseAlertFilters({ page_size: '25' }).pageSize).toBe(25);
    expect(parseAlertFilters({ page_size: String(MAX_PAGE_SIZE + 100) }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it('clamps offset to [0, MAX_OFFSET]', () => {
    expect(parseAlertFilters({ offset: '-1' }).offset).toBe(0);
    expect(parseAlertFilters({ offset: 'abc' }).offset).toBe(0);
    expect(parseAlertFilters({ offset: '100' }).offset).toBe(100);
    expect(parseAlertFilters({ offset: String(MAX_OFFSET + 1) }).offset).toBe(MAX_OFFSET);
  });

  it('picks the first value when an array is passed', () => {
    expect(parseAlertFilters({ status: ['open', 'resolved'] }).status).toBe('open');
  });
});

describe('buildAlertFilterQueryString', () => {
  it('returns empty string when filters are defaults', () => {
    const f = parseAlertFilters({});
    expect(buildAlertFilterQueryString(f)).toBe('');
  });

  it('encodes status/severity/rule_code/since', () => {
    const f = parseAlertFilters({
      status: 'open',
      severity: 'high',
      rule_code: 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
      since: '2026-05-01T00:00:00Z',
    });
    const qs = buildAlertFilterQueryString(f);
    expect(qs).toContain('status=open');
    expect(qs).toContain('severity=high');
    expect(qs).toContain('rule_code=UNKNOWN_TO_MINOR_PRIVATE_MESSAGE');
    expect(qs).toContain('since=');
  });

  it('overrides offset/pageSize when requested', () => {
    const f = parseAlertFilters({ status: 'open' });
    const qs = buildAlertFilterQueryString(f, { offset: 50 });
    expect(qs).toContain('offset=50');
    expect(qs).toContain('status=open');
  });

  it('does not emit defaults for page_size or offset', () => {
    const f = parseAlertFilters({ status: 'open' });
    const qs = buildAlertFilterQueryString(f);
    expect(qs).not.toContain('page_size');
    expect(qs).not.toContain('offset=0');
  });
});
