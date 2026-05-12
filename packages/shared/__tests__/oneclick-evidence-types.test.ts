// Defesa em profundidade: garante que o contrato de evidência parental
// REJEITA todos os campos PII proibidos. Não importa `privacy-guard.ts`
// — usa o schema Zod local em `evidence-types.ts`.

import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_EVIDENCE_PII_FIELDS,
  ParentalConsentEvidenceInputSchema,
  disabledOneclickConsentEvidenceAdapter,
  findForbiddenEvidencePiiKeys,
} from '../src/index.ts';

const VALID_BASE = {
  consentId: '6f8c0e84-5d62-4f8e-9b3c-1e8b5a8d8e4a',
  method: 'DIGITAL_SIGNATURE' as const,
  evidenceHash:
    'a'.repeat(64), // hex 64 lowercase
  collectedAt: '2026-05-12T12:00:00.000Z',
};

describe('ParentalConsentEvidenceInput — schema valida shape canônico', () => {
  it('aceita input mínimo válido', () => {
    const parsed = ParentalConsentEvidenceInputSchema.safeParse(VALID_BASE);
    expect(parsed.success).toBe(true);
  });

  it('aceita storagePath e signedPayloadHash opcionais', () => {
    const parsed = ParentalConsentEvidenceInputSchema.safeParse({
      ...VALID_BASE,
      storagePath: 'tenant_x/consent_y/evidence.json',
      signedPayloadHash: 'b'.repeat(64),
    });
    expect(parsed.success).toBe(true);
  });

  it('rejeita evidenceHash não-hex', () => {
    const parsed = ParentalConsentEvidenceInputSchema.safeParse({
      ...VALID_BASE,
      evidenceHash: 'NOT-A-HASH',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejeita método não suportado', () => {
    const parsed = ParentalConsentEvidenceInputSchema.safeParse({
      ...VALID_BASE,
      method: 'UNKNOWN_METHOD',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('ParentalConsentEvidenceInput — rejeita PII proibida (defesa em profundidade)', () => {
  it.each([...FORBIDDEN_EVIDENCE_PII_FIELDS])(
    'rejeita campo PII proibido: %s',
    (forbiddenField) => {
      const parsed = ParentalConsentEvidenceInputSchema.safeParse({
        ...VALID_BASE,
        [forbiddenField]: 'qualquer-valor',
      });
      expect(parsed.success).toBe(false);
    },
  );

  it('lista FORBIDDEN_EVIDENCE_PII_FIELDS cobre as 17 chaves declaradas', () => {
    expect(FORBIDDEN_EVIDENCE_PII_FIELDS).toEqual(
      expect.arrayContaining([
        'birthdate',
        'date_of_birth',
        'dob',
        'age',
        'exact_age',
        'document',
        'cpf',
        'rg',
        'passport',
        'id_number',
        'raw_id',
        'civil_id',
        'name',
        'full_name',
        'selfie',
        'face',
        'biometric',
      ]),
    );
    expect(FORBIDDEN_EVIDENCE_PII_FIELDS).toHaveLength(17);
  });

  it('findForbiddenEvidencePiiKeys identifica chaves proibidas em payload misto', () => {
    const dirty = {
      consentId: VALID_BASE.consentId,
      birthdate: '2010-01-01',
      cpf: '000.000.000-00',
      name: 'Foo',
      // chave não proibida
      method: 'KBA',
    };
    const hits = findForbiddenEvidencePiiKeys(dirty);
    expect(hits).toEqual(expect.arrayContaining(['birthdate', 'cpf', 'name']));
    expect(hits).not.toContain('method');
  });

  it('findForbiddenEvidencePiiKeys retorna vazio para payload limpo', () => {
    const hits = findForbiddenEvidencePiiKeys(VALID_BASE);
    expect(hits).toEqual([]);
  });
});

describe('Disabled consent evidence adapter — never accepts', () => {
  it('create() nega com feature_disabled', async () => {
    const parsed = ParentalConsentEvidenceInputSchema.parse(VALID_BASE);
    const result = await disabledOneclickConsentEvidenceAdapter.create(parsed);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('feature_disabled');
  });

  it('revoke() nega com feature_disabled', async () => {
    const result = await disabledOneclickConsentEvidenceAdapter.revoke({
      evidenceRef: 'opaque_ref',
      reason: 'parent_request',
    });
    expect(result.revoked).toBe(false);
    expect(result.reason).toBe('feature_disabled');
  });

  it('supportedMethods é vazio (nenhum método operacional ainda)', () => {
    expect(disabledOneclickConsentEvidenceAdapter.supportedMethods).toEqual([]);
  });
});
