import { describe, expect, it } from 'vitest';
import {
  ParentalConsentTextResponseSchema,
  type ParentalConsentTextResponse,
} from '../src/schemas/parental-consent.ts';
import {
  isPayloadSafe,
  assertPayloadSafe,
  PrivacyGuardForbiddenClaimError,
} from '../src/privacy/index.ts';

const VALID_RESPONSE: ParentalConsentTextResponse = {
  id: '018f7b8c-eeee-ffff-aaaa-2b31319d6eaf',
  locale: 'pt-BR',
  text_hash: 'a'.repeat(64),
  text_body:
    'Texto de consentimento parental — esta é a versão exibida ao responsável legal. ' +
    'Versão 1. Não contém PII.',
  content_type: 'text/plain',
};

describe('ParentalConsentTextResponseSchema', () => {
  it('aceita resposta válida', () => {
    const parsed = ParentalConsentTextResponseSchema.parse(VALID_RESPONSE);
    expect(parsed.content_type).toBe('text/plain');
    expect(parsed.text_body.length).toBeGreaterThan(0);
  });

  it('rejeita campos extras (strict)', () => {
    expect(() =>
      ParentalConsentTextResponseSchema.parse({
        ...VALID_RESPONSE,
        // Tentativa de inserir campo PII desconhecido — deve falhar
        // pelo `.strict()` aplicado ao schema.
        guardian_email: 'leak@example.com',
      }),
    ).toThrow();
  });

  it('rejeita content_type diferente de text/plain', () => {
    expect(() =>
      ParentalConsentTextResponseSchema.parse({
        ...VALID_RESPONSE,
        content_type: 'text/html',
      }),
    ).toThrow();
  });

  it('rejeita id que não é UUID', () => {
    expect(() =>
      ParentalConsentTextResponseSchema.parse({
        ...VALID_RESPONSE,
        id: 'not-a-uuid',
      }),
    ).toThrow();
  });
});

describe('ParentalConsentTextResponse — privacy guard', () => {
  it('payload válido passa pelo perfil public_api_response', () => {
    expect(isPayloadSafe(VALID_RESPONSE, 'public_api_response')).toBe(true);
    expect(() =>
      assertPayloadSafe(VALID_RESPONSE, 'public_api_response'),
    ).not.toThrow();
  });

  it('rejeita payload com email inserido defensivamente', () => {
    const malicious = {
      ...VALID_RESPONSE,
      // Em produção o schema strict já rejeitaria, mas o guard
      // protege defensivamente caso o caller pule a validação Zod.
      email: 'leak@example.com',
    };
    expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
    expect(() =>
      assertPayloadSafe(malicious, 'public_api_response'),
    ).toThrow(PrivacyGuardForbiddenClaimError);
  });

  it('rejeita payload com birthdate inserido defensivamente', () => {
    const malicious = {
      ...VALID_RESPONSE,
      birthdate: '2010-01-01',
    };
    expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
  });

  it('rejeita payload com guardian_phone aninhado', () => {
    const malicious = {
      ...VALID_RESPONSE,
      meta: { guardian_phone: '+55 11 99999-9999' },
    };
    expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
  });
});
