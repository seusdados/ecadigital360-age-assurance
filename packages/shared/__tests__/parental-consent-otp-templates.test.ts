import { describe, expect, it } from 'vitest';
import {
  renderOtpEmailTemplate,
  resolveOtpTemplateLocale,
} from '../src/parental-consent/otp-templates.ts';
import { isPayloadSafe } from '../src/privacy/index.ts';

describe('OTP email template', () => {
  it('default pt-BR contém o OTP', () => {
    const tpl = renderOtpEmailTemplate({ otp: '123456' });
    expect(tpl.subject.toLowerCase()).toContain('agekey');
    expect(tpl.text).toContain('123456');
    expect(tpl.text).toContain('10');
  });

  it('en-US contém o OTP', () => {
    const tpl = renderOtpEmailTemplate({ otp: '987654', locale: 'en-US' });
    expect(tpl.subject.toLowerCase()).toContain('agekey');
    expect(tpl.text).toContain('987654');
  });

  it('locale desconhecido cai em pt-BR', () => {
    expect(resolveOtpTemplateLocale('xx-YY')).toBe('pt-BR');
    expect(resolveOtpTemplateLocale(undefined)).toBe('pt-BR');
  });

  it('TTL customizado é refletido', () => {
    const tpl = renderOtpEmailTemplate({ otp: '1', expiresInMinutes: 5 });
    expect(tpl.text).toContain('5');
  });

  it('template não inclui PII (privacy guard public_api_response)', () => {
    const tpl = renderOtpEmailTemplate({ otp: '123456' });
    // O template gera string, mas vamos validar que não temos chaves
    // PII nas estruturas:
    expect(isPayloadSafe({ subject: tpl.subject, text: tpl.text }, 'public_api_response')).toBe(true);
  });
});
