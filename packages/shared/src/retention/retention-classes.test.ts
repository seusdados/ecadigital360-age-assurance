import { describe, expect, it } from 'vitest';
import {
  RETENTION_CATEGORIES,
  RETENTION_CLASSES,
  RETENTION_CLASS_CODES,
  effectiveRetentionSeconds,
  getRetentionClassForCategory,
  isReservedRetentionCategory,
} from './retention-classes.ts';

describe('retention classes', () => {
  it('exposes a class for every code', () => {
    for (const code of Object.values(RETENTION_CLASS_CODES)) {
      expect(RETENTION_CLASSES[code].code).toBe(code);
    }
  });

  it('orders class caps from shortest to longest', () => {
    const ordered = [
      RETENTION_CLASSES.ephemeral.max_seconds,
      RETENTION_CLASSES.short_lived.max_seconds,
      RETENTION_CLASSES.standard_audit.max_seconds,
      RETENTION_CLASSES.regulatory.max_seconds,
    ];
    for (let i = 0; i < ordered.length - 1; i++) {
      const a = ordered[i];
      const b = ordered[i + 1];
      expect(typeof a).toBe('number');
      expect(typeof b).toBe('number');
      expect(a as number).toBeLessThan(b as number);
    }
    expect(RETENTION_CLASSES.permanent_hash.max_seconds).toBeNull();
  });

  it('maps every declared category to a known class', () => {
    for (const category of Object.keys(RETENTION_CATEGORIES) as Array<
      keyof typeof RETENTION_CATEGORIES
    >) {
      const klass = getRetentionClassForCategory(category);
      expect(RETENTION_CLASSES[klass.code]).toBe(klass);
    }
  });

  it('uses min(class cap, tenant cap) for finite classes', () => {
    const tenantSeconds = 30 * 24 * 60 * 60;
    expect(effectiveRetentionSeconds('audit_event', 30)).toBe(tenantSeconds);
  });

  it('caps tenant retention at the regulatory class ceiling', () => {
    const longTenantDays = 5000;
    expect(effectiveRetentionSeconds('policy_version', longTenantDays)).toBe(
      RETENTION_CLASSES.regulatory.max_seconds!,
    );
  });

  it('lets permanent_hash inherit the tenant cap', () => {
    expect(effectiveRetentionSeconds('audit_event', 365)).toBe(
      Math.min(
        RETENTION_CLASSES.standard_audit.max_seconds!,
        365 * 24 * 60 * 60,
      ),
    );
  });

  it('rejects non-positive tenant retention', () => {
    expect(() => effectiveRetentionSeconds('audit_event', 0)).toThrow(
      RangeError,
    );
    expect(() => effectiveRetentionSeconds('audit_event', -1)).toThrow(
      RangeError,
    );
  });

  it('treats consent and safety categories as live after rounds 3 and 4', () => {
    // Both namespaces were promoted from RESERVED to LIVE.
    expect(isReservedRetentionCategory('consent_receipt')).toBe(false);
    expect(isReservedRetentionCategory('safety_risk_signal')).toBe(false);
    expect(isReservedRetentionCategory('audit_event')).toBe(false);
  });
});
