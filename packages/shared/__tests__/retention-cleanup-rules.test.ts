import { describe, expect, it } from 'vitest';
import { decideCleanup } from '../src/retention/cleanup-rules.ts';

const NOW = Date.parse('2026-05-05T00:00:00Z');
const DAYS_AGO = (n: number) => NOW - n * 86_400_000;

describe('Retention cleanup rules — legal_hold', () => {
  it('legal_hold=true NUNCA delete (mesmo expirado)', () => {
    const r = decideCleanup({
      now: NOW,
      occurredAt: DAYS_AGO(9999),
      retentionClass: 'event_30d',
      legalHold: true,
    });
    expect(r.shouldDelete).toBe(false);
    expect(r.reason).toBe('legal_hold_active');
  });

  it('classe legal_hold nunca delete', () => {
    const r = decideCleanup({
      now: NOW,
      occurredAt: DAYS_AGO(9999),
      retentionClass: 'legal_hold',
      legalHold: false,
    });
    expect(r.shouldDelete).toBe(false);
    expect(r.reason).toBe('legal_hold_active');
  });
});

describe('Retention cleanup rules — TTL estático', () => {
  it('event_30d dentro do TTL não delete', () => {
    const r = decideCleanup({
      now: NOW,
      occurredAt: DAYS_AGO(15),
      retentionClass: 'event_30d',
      legalHold: false,
    });
    expect(r.shouldDelete).toBe(false);
    expect(r.reason).toBe('within_ttl');
  });

  it('event_30d expirado delete', () => {
    const r = decideCleanup({
      now: NOW,
      occurredAt: DAYS_AGO(35),
      retentionClass: 'event_30d',
      legalHold: false,
    });
    expect(r.shouldDelete).toBe(true);
    expect(r.reason).toBe('ttl_expired');
  });

  it.each([
    ['session_24h', 1],
    ['session_7d', 7],
    ['otp_24h', 1],
    ['otp_30d', 30],
    ['event_30d', 30],
    ['event_90d', 90],
    ['event_180d', 180],
    ['aggregate_12m', 365],
    ['consent_expired_audit_window', 365],
    ['alert_12m', 365],
    ['case_24m', 730],
  ])('classe %s expira em %s dias', (cls, days) => {
    expect(
      decideCleanup({
        now: NOW,
        occurredAt: DAYS_AGO(days - 1),
        retentionClass: cls,
        legalHold: false,
      }).shouldDelete,
    ).toBe(false);
    expect(
      decideCleanup({
        now: NOW,
        occurredAt: DAYS_AGO(days + 1),
        retentionClass: cls,
        legalHold: false,
      }).shouldDelete,
    ).toBe(true);
  });
});

describe('Retention cleanup rules — TTL dinâmico (policy)', () => {
  it('verification_result_policy_ttl dentro do TTL', () => {
    const r = decideCleanup({
      now: NOW,
      occurredAt: NOW - 30 * 60 * 1000,
      retentionClass: 'verification_result_policy_ttl',
      legalHold: false,
      policyTtlSeconds: 3600,
    });
    expect(r.shouldDelete).toBe(false);
  });

  it('verification_result_policy_ttl expirado', () => {
    const r = decideCleanup({
      now: NOW,
      occurredAt: NOW - 7200 * 1000,
      retentionClass: 'verification_result_policy_ttl',
      legalHold: false,
      policyTtlSeconds: 3600,
    });
    expect(r.shouldDelete).toBe(true);
  });

  it('TTL dinâmico sem policyTtlSeconds não delete', () => {
    const r = decideCleanup({
      now: NOW,
      occurredAt: DAYS_AGO(9999),
      retentionClass: 'consent_active_until_expiration',
      legalHold: false,
    });
    expect(r.shouldDelete).toBe(false);
    expect(r.reason).toBe('dynamic_ttl_unspecified');
  });
});

describe('Retention cleanup rules — no_store / unknown', () => {
  it('no_store não delete (não persiste)', () => {
    const r = decideCleanup({
      now: NOW,
      occurredAt: DAYS_AGO(1),
      retentionClass: 'no_store',
      legalHold: false,
    });
    expect(r.shouldDelete).toBe(false);
    expect(r.reason).toBe('no_store_does_not_persist');
  });

  it('classe desconhecida não delete', () => {
    const r = decideCleanup({
      now: NOW,
      occurredAt: DAYS_AGO(9999),
      retentionClass: 'never_heard_of_it',
      legalHold: false,
    });
    expect(r.shouldDelete).toBe(false);
    expect(r.reason).toBe('unknown_class');
  });
});
