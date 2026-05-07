// Schema canônico estendido do `ResultTokenClaims`.
//
// Adiciona claims **opcionais** alinhadas ao Decision Envelope:
//   - `agekey.decision_id`       — UUID do registro de decisão
//   - `agekey.decision_domain`   — domínio canônico
//   - `agekey.reason_codes`      — lista cumulativa (quando aplicável)
//
// O schema legado em `./tokens.ts` segue intocado e continua sendo o
// contrato público mínimo. Tokens existentes continuam válidos.
// Tokens novos podem incluir essas claims sem quebrar verificação.
//
// Documentação: docs/specs/agekey-token.md (seção "Claims canônicas
// opcionais").

import { z } from 'zod';
import {
  ResultTokenClaimsSchema,
  type ResultTokenClaims,
} from './tokens.ts';
import { DecisionDomainSchema } from '../decision/decision-envelope.ts';

const AgekeyExtSchema = z
  .object({
    decision_id: z.string().min(1).optional(),
    decision_domain: DecisionDomainSchema.optional(),
    reason_codes: z.array(z.string().min(1)).max(32).optional(),
  })
  .partial();

/**
 * Schema estendido — mesmas claims obrigatórias do legado
 * (`ResultTokenClaimsSchema`) mais as canônicas opcionais.
 */
export const ResultTokenClaimsCanonicalSchema = z.object({
  iss: z.string().url(),
  aud: z.string().min(1),
  sub: z.string().min(1).optional(),
  jti: z.string().uuid(),
  iat: z.number().int(),
  nbf: z.number().int(),
  exp: z.number().int(),
  agekey: ResultTokenClaimsSchema.shape.agekey.and(AgekeyExtSchema),
});

export type ResultTokenClaimsCanonical = z.infer<
  typeof ResultTokenClaimsCanonicalSchema
>;

/**
 * Type guard: verifica se um conjunto de claims já contém as extensões
 * canônicas (`decision_id`/`decision_domain`).
 */
export function hasCanonicalAgekeyExtensions(
  claims: ResultTokenClaims | ResultTokenClaimsCanonical,
): claims is ResultTokenClaimsCanonical {
  const ext = (claims.agekey as Record<string, unknown>) ?? {};
  return (
    typeof ext.decision_id === 'string' ||
    typeof ext.decision_domain === 'string' ||
    Array.isArray(ext.reason_codes)
  );
}
