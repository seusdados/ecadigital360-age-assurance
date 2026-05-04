import { describe, expect, it } from 'vitest';
import {
  constantTimeEqualString,
  generatePanelToken,
  hashPanelToken,
} from '../src/parental-consent/panel-token.ts';

describe('Consent panel token', () => {
  it('gera token com prefixo pcpt_', () => {
    const t = generatePanelToken();
    expect(t.startsWith('pcpt_')).toBe(true);
  });

  it('gera tokens únicos (alta entropia)', () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generatePanelToken());
    expect(set.size).toBe(100);
  });

  it('hash é determinístico e hex SHA-256', async () => {
    const t = 'pcpt_test_abc';
    const h = await hashPanelToken(t);
    const h2 = await hashPanelToken(t);
    expect(h).toBe(h2);
    expect(/^[0-9a-f]{64}$/.test(h)).toBe(true);
  });

  it('constantTimeEqualString detecta match', async () => {
    const t = generatePanelToken();
    const h1 = await hashPanelToken(t);
    const h2 = await hashPanelToken(t);
    expect(constantTimeEqualString(h1, h2)).toBe(true);
  });
});
