import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  generateOtp,
  hashOtp,
  hmacContact,
  maskContact,
  normalizeContact,
} from '../src/parental-consent/otp-utils.ts';

describe('Consent OTP — generateOtp', () => {
  it('produz 6 dígitos numéricos', () => {
    for (let i = 0; i < 200; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^[0-9]{6}$/);
    }
  });

  it('não repete em 100 chamadas (probabilidade de colisão ~ 0.005%)', () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateOtp());
    expect(set.size).toBeGreaterThan(95);
  });
});

describe('Consent OTP — hashOtp + constantTimeEqual', () => {
  it('hash determinístico com salt', async () => {
    const a = await hashOtp('123456', 'salt-x');
    const b = await hashOtp('123456', 'salt-x');
    expect(a).toBe(b);
    expect(/^[0-9a-f]{64}$/.test(a)).toBe(true);
  });

  it('hash muda quando salt muda', async () => {
    const a = await hashOtp('123456', 'salt-x');
    const b = await hashOtp('123456', 'salt-y');
    expect(a).not.toBe(b);
  });

  it('constantTimeEqual identifica match correto', async () => {
    const a = await hashOtp('123456', 's');
    const b = await hashOtp('123456', 's');
    expect(constantTimeEqual(a, b)).toBe(true);
  });

  it('constantTimeEqual rejeita strings de tamanhos diferentes', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('Consent OTP — maskContact', () => {
  it('mascara e-mail preservando domínio', () => {
    expect(maskContact('email', 'roberto@example.com')).toBe('r***@example.com');
  });

  it('mascara telefone preservando 4 últimos dígitos', () => {
    expect(maskContact('phone', '+55 (11) 99999-1234')).toMatch(/\*\*\*\*1234$/);
  });

  it('retorna *** quando entrada é inválida', () => {
    expect(maskContact('email', 'invalid')).toBe('***');
    expect(maskContact('phone', '12')).toBe('***');
  });
});

describe('Consent OTP — normalizeContact', () => {
  it('normaliza email para lowercase trimado', () => {
    expect(normalizeContact('email', '  R@Example.COM ')).toBe('r@example.com');
  });

  it('normaliza telefone preservando + leading', () => {
    expect(normalizeContact('phone', '+55 (11) 99999-1234')).toBe(
      '+5511999991234',
    );
    expect(normalizeContact('phone', '11 99999-1234')).toBe('+11999991234');
  });
});

describe('Consent OTP — hmacContact', () => {
  it('é determinístico para o mesmo tenant + canal + valor', async () => {
    const a = await hmacContact('tenant-1', 'email', 'r@example.com');
    const b = await hmacContact('tenant-1', 'email', ' r@Example.com ');
    expect(a).toBe(b);
  });

  it('difere entre tenants (sal por tenant)', async () => {
    const a = await hmacContact('tenant-1', 'email', 'r@example.com');
    const b = await hmacContact('tenant-2', 'email', 'r@example.com');
    expect(a).not.toBe(b);
  });

  it('difere entre canais', async () => {
    const a = await hmacContact('t', 'email', '11999991234');
    const b = await hmacContact('t', 'phone', '11999991234');
    expect(a).not.toBe(b);
  });
});
