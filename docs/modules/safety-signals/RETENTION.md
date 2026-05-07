# Retention — AgeKey Safety Signals

## Categorias

| Tabela | `RETENTION_CATEGORIES` | Classe canônica | Janela |
|---|---|---|---|
| `safety_events` | `safety_event` | `standard_audit` | 90d→365 |
| `safety_alerts` | `safety_alert` | `standard_audit` | 90d→365 |
| `safety_aggregates` | `safety_aggregate` | `short_lived` | 30d |
| `safety_evidence_artifacts` | (use `safety_event` para v1) | `regulatory` | 5 anos |
| `audit_events` (safety.*) | `audit_event` | `standard_audit` | 90d→365 |
| `safety_subjects` | `safety_event` | `standard_audit` | 90d→365 |

`packages/shared/src/retention/retention-classes.ts` reconhece todas as
categorias acima como **live** após a Rodada 4.

## Estratégia de expurgo

`safety_events` é APPEND-ONLY com trigger bloqueando UPDATE/DELETE. O
expurgo seguro usa **partition DETACH**, mirror da estratégia de
`audit_events` (`supabase/migrations/006_audit_billing.sql`). Hoje a
tabela ainda **não é particionada**; particionamento mensal é P3.

Por isso `safety-retention-cleanup` é **dry-run-by-default**:

- `AGEKEY_SAFETY_RETENTION_DRY_RUN=true` (default) — só conta linhas
  vencidas e escreve `audit_events` com a contagem.
- `AGEKEY_SAFETY_RETENTION_DRY_RUN=false` — só pode rodar **depois** que
  `safety_events` for particionado, porque DELETEs são bloqueados pelo
  trigger.

Operadores acompanham a contagem via dashboard até a rodada de
particionamento.

## Legal hold (reservado)

`AGEKEY_SAFETY_LEGAL_HOLD_ENABLED=false`. Quando ativado em uma rodada
futura, uma coluna `legal_hold` em `safety_events` e `safety_alerts`
isenta as linhas marcadas do expurgo automatizado, com auditoria.

## Aggregates

`safety_aggregates` (`short_lived`) são recomputáveis a partir de
`safety_events` enquanto a janela coberta ainda existir. O job
`safety-aggregates-refresh` recomputa a cada 5min (cron).
