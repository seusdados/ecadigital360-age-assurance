// AGENT 5 (Safety Hardening) — `safety-retention-cleanup` precisa
// excluir SEMPRE rows com `legal_hold = true`, independentemente de
// `retention_class` ou idade. O cleanup também precisa emitir um
// audit event `RETENTION_LEGAL_HOLD_ACTIVE` por tenant afetado.
//
// Este teste exercita um modelo simplificado da lógica de filtragem
// usada pelo Edge Function (deno-only) para confirmar o contrato.

import { describe, expect, it } from 'vitest';

interface SafetyEventRow {
  id: string;
  tenant_id: string;
  retention_class: string;
  legal_hold: boolean;
  occurred_at: string; // ISO
}

/**
 * Reimplementação minimalista da lógica `safety-retention-cleanup`
 * para garantir que (a) rows com legal_hold=true nunca são deletadas,
 * (b) é gerado pelo menos um audit event por tenant impactado.
 */
function simulateCleanup(
  rows: SafetyEventRow[],
  retentionClassToDays: Record<string, number>,
  now: number,
): {
  deleted: SafetyEventRow[];
  legalHoldSkipped: SafetyEventRow[];
  auditEvents: Array<{ tenantId: string; reason_code: string }>;
} {
  const deleted: SafetyEventRow[] = [];
  const legalHoldSkipped: SafetyEventRow[] = [];
  const tenantsWithLegalHoldSkip = new Set<string>();

  for (const [retClass, days] of Object.entries(retentionClassToDays)) {
    if (retClass === 'no_store' || days === 0) continue;
    const cutoffTs = now - days * 86_400_000;

    for (const r of rows) {
      if (r.retention_class !== retClass) continue;
      if (Date.parse(r.occurred_at) >= cutoffTs) continue;
      if (r.legal_hold === true) {
        legalHoldSkipped.push(r);
        tenantsWithLegalHoldSkip.add(r.tenant_id);
        continue;
      }
      deleted.push(r);
    }
  }

  const auditEvents = Array.from(tenantsWithLegalHoldSkip).map((tenantId) => ({
    tenantId,
    reason_code: 'RETENTION_LEGAL_HOLD_ACTIVE',
  }));
  return { deleted, legalHoldSkipped, auditEvents };
}

const CLASSES = {
  no_store: 0,
  event_30d: 30,
  event_90d: 90,
  alert_12m: 365,
};

const NOW = Date.parse('2026-05-07T00:00:00Z');

describe('Safety retention cleanup — legal_hold é absoluto', () => {
  it('nunca deleta row com legal_hold=true mesmo se expirada', () => {
    const ancient = new Date(NOW - 400 * 86_400_000).toISOString();
    const rows: SafetyEventRow[] = [
      {
        id: 'evt-locked',
        tenant_id: 't1',
        retention_class: 'event_30d',
        legal_hold: true,
        occurred_at: ancient,
      },
    ];
    const result = simulateCleanup(rows, CLASSES, NOW);
    expect(result.deleted).toHaveLength(0);
    expect(result.legalHoldSkipped).toHaveLength(1);
    expect(result.legalHoldSkipped[0]!.id).toBe('evt-locked');
  });

  it('deleta row expirada sem legal_hold', () => {
    const ancient = new Date(NOW - 400 * 86_400_000).toISOString();
    const rows: SafetyEventRow[] = [
      {
        id: 'evt-rotten',
        tenant_id: 't1',
        retention_class: 'event_30d',
        legal_hold: false,
        occurred_at: ancient,
      },
    ];
    const result = simulateCleanup(rows, CLASSES, NOW);
    expect(result.deleted.map((r) => r.id)).toEqual(['evt-rotten']);
    expect(result.legalHoldSkipped).toHaveLength(0);
  });

  it('emite audit event RETENTION_LEGAL_HOLD_ACTIVE por tenant afetado', () => {
    const ancient = new Date(NOW - 400 * 86_400_000).toISOString();
    const rows: SafetyEventRow[] = [
      {
        id: 'a',
        tenant_id: 't1',
        retention_class: 'event_30d',
        legal_hold: true,
        occurred_at: ancient,
      },
      {
        id: 'b',
        tenant_id: 't2',
        retention_class: 'event_90d',
        legal_hold: true,
        occurred_at: ancient,
      },
      {
        id: 'c',
        tenant_id: 't1',
        retention_class: 'event_90d',
        legal_hold: true,
        occurred_at: ancient,
      },
    ];
    const result = simulateCleanup(rows, CLASSES, NOW);
    expect(result.deleted).toHaveLength(0);
    expect(result.legalHoldSkipped).toHaveLength(3);
    const tenantsAudited = new Set(result.auditEvents.map((a) => a.tenantId));
    expect(tenantsAudited.has('t1')).toBe(true);
    expect(tenantsAudited.has('t2')).toBe(true);
    for (const a of result.auditEvents) {
      expect(a.reason_code).toBe('RETENTION_LEGAL_HOLD_ACTIVE');
    }
  });

  it('row recente (não expirada) não é deletada nem audit-marcada', () => {
    const yesterday = new Date(NOW - 86_400_000).toISOString();
    const rows: SafetyEventRow[] = [
      {
        id: 'fresh',
        tenant_id: 't1',
        retention_class: 'event_30d',
        legal_hold: false,
        occurred_at: yesterday,
      },
    ];
    const result = simulateCleanup(rows, CLASSES, NOW);
    expect(result.deleted).toHaveLength(0);
    expect(result.legalHoldSkipped).toHaveLength(0);
    expect(result.auditEvents).toHaveLength(0);
  });

  it('classes desativadas (no_store, days=0) são ignoradas', () => {
    const ancient = new Date(NOW - 1000 * 86_400_000).toISOString();
    const rows: SafetyEventRow[] = [
      {
        id: 'x',
        tenant_id: 't1',
        retention_class: 'no_store',
        legal_hold: false,
        occurred_at: ancient,
      },
    ];
    const result = simulateCleanup(rows, CLASSES, NOW);
    // Não tocamos em no_store por safety; cleanup TTL=0 é tratado em outro
    // caminho (tabelas/triggers de stream — não no batch retention).
    expect(result.deleted).toHaveLength(0);
  });
});
