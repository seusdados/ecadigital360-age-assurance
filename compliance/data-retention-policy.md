# Política de Retenção - AgeKey

## Objetivo

Definir por quanto tempo dados técnicos e evidências mínimas são mantidos.

## Classes de dados

| Classe | Exemplo | Retenção recomendada |
|---|---|---|
| Sessões pendentes | verification_sessions pending | 24h |
| Challenges | verification_challenges | expiração + 24h |
| Artefatos | proof_artifacts hash/path | 30-180 dias |
| Resultados | verification_results | 30-365 dias |
| Tokens | result_tokens | TTL + janela de auditoria |
| Audit events | audit_events | 180-730 dias |
| Billing events | billing_events | prazo contratual/fiscal |
| Rate limit | rate_limit_buckets | 24h-30 dias |
| IP reputation | ip_reputation | 1h-30 dias |

## Regras

1. Nunca reter documento bruto.
2. Nunca reter data de nascimento.
3. Nunca reter selfie.
4. Artefato bruto, se usado, deve ter justificativa, storage privado e expurgo automático.
5. Retenção por tenant deve respeitar contrato e jurisdição.
