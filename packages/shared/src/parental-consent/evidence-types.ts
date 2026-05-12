// AgeKey Parental Consent — Evidence Types (Contract-Ready).
//
// Esta camada define APENAS contratos para evidência probatória de
// consentimento parental. Não cria tabela, edge function, ou
// orquestração nesta PR.
//
// **Princípio fundamental**: o input de evidência NUNCA aceita PII bruta.
// Apenas hashes, referências de storage e payloads assinados são
// permitidos. O schema Zod abaixo é a defesa em profundidade — o privacy
// guard global é a segunda barreira mas NÃO é importado aqui para evitar
// acoplamento com `privacy-guard.ts` (em alteração no PR #88).
//
// Documentação:
//   - docs/specs/agekey-oneclick.md
//   - docs/audit/agekey-oneclick-preflight.md

import { z } from 'zod';

/**
 * Métodos de coleta de evidência reconhecidos pelo contrato. Cada método
 * define qual `proof_kind` é aceito; os adapters operacionais (próxima
 * PR) farão a validação real.
 */
export type ParentalConsentEvidenceMethod =
  | 'KBA'
  | 'EID'
  | 'SELFIE_MATCH'
  | 'DIGITAL_SIGNATURE'
  | 'MANUAL_REVIEW';

/**
 * Lista de campos PII que NUNCA podem aparecer no input de evidência.
 * Esta lista é a base do schema Zod abaixo e do teste
 * `oneclick-evidence-types.test.ts`. Mantenha em sincronia com
 * `privacy-guard.ts` quando #88 mergear.
 */
export const FORBIDDEN_EVIDENCE_PII_FIELDS = [
  // Idade / nascimento
  'birthdate',
  'date_of_birth',
  'dob',
  'age',
  'exact_age',
  // Documentos
  'document',
  'cpf',
  'rg',
  'passport',
  'id_number',
  'raw_id',
  'civil_id',
  // Identidade
  'name',
  'full_name',
  // Biometria
  'selfie',
  'face',
  'biometric',
] as const;

export type ForbiddenEvidencePiiField =
  (typeof FORBIDDEN_EVIDENCE_PII_FIELDS)[number];

/** Sentinel preserva o exhaustiveness check (compile-time + runtime). */
const FORBIDDEN_SET: ReadonlySet<string> = new Set(FORBIDDEN_EVIDENCE_PII_FIELDS);

/**
 * Schema Zod do input de criação de evidência. Aceita APENAS:
 *
 *   - referência do consent (`consentId`);
 *   - método;
 *   - hash da evidência (hex);
 *   - caminho opaco de storage (opcional);
 *   - hash de payload assinado (opcional);
 *   - timestamp de coleta (ISO-8601).
 *
 * Rejeita o objeto se qualquer chave da lista acima aparecer no topo do
 * payload. Rejeita também campos extra desconhecidos (`.strict()`).
 */
export const ParentalConsentEvidenceInputSchema = z
  .object({
    consentId: z.string().uuid(),
    method: z.enum([
      'KBA',
      'EID',
      'SELFIE_MATCH',
      'DIGITAL_SIGNATURE',
      'MANUAL_REVIEW',
    ]),
    /** SHA-256 do material de evidência, hex lowercase. */
    evidenceHash: z.string().regex(/^[0-9a-f]{64}$/),
    /** Caminho opaco em bucket privado (não contém PII). */
    storagePath: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[a-zA-Z0-9._\-/]+$/)
      .optional(),
    /** SHA-256 do payload assinado (quando aplicável). */
    signedPayloadHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    /** ISO-8601 UTC. */
    collectedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_SET.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Forbidden PII field "${key}" rejected by parental consent evidence contract`,
        });
      }
    }
  });

export type ParentalConsentEvidenceInput = z.infer<
  typeof ParentalConsentEvidenceInputSchema
>;

/**
 * Verifica se um payload candidato contém alguma chave PII proibida no
 * topo. Defesa em profundidade independente do schema Zod, útil para
 * testes e para validar payloads recebidos antes do parsing canônico.
 */
export function findForbiddenEvidencePiiKeys(
  payload: Record<string, unknown>,
): ReadonlyArray<ForbiddenEvidencePiiField> {
  const hits: Array<ForbiddenEvidencePiiField> = [];
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_SET.has(key)) {
      hits.push(key as ForbiddenEvidencePiiField);
    }
  }
  return hits;
}
