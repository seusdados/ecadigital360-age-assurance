# RLS e Segurança — AgeKey Safety Signals

## Modelo de ameaças

| Ameaça | Mitigação |
|---|---|
| Cliente envia conteúdo bruto | Boundary check rejeita; schema literal força `content_processed=false`; CHECK SQL bloqueia |
| Cliente envia PII | `rejectForbiddenIngestKeys` rejeita; privacy guard canônico re-aplica em egress |
| Reuso de score cross-tenant | `safety_subjects.risk_score` é por (tenant, application); RLS impede leitura cross-tenant |
| Vazamento de actor_ref entre tenants | HMAC por-tenant — chaves diferentes produzem hashes diferentes |
| Replay de webhook | `X-AgeKey-Signature` (HMAC) + `payload_hash` no body |
| Append-only bypass | Trigger `prevent_update_delete` em `safety_events` e `safety_evidence_artifacts` |
| Privilege escalation no painel | `has_role('operator')` para reads em `safety_events`, `has_role('auditor')` para evidence |

## RLS em todas as tabelas

```
safety_subjects        → SELECT por tenant; INSERT/UPDATE only via service_role
safety_interactions    → SELECT por tenant; INSERT/UPDATE only via service_role
safety_events          → SELECT por tenant + has_role('operator')
safety_rules           → SELECT por tenant (system rules visíveis); INSERT/UPDATE has_role('admin')
safety_alerts          → SELECT por tenant; UPDATE has_role('operator')
safety_aggregates      → SELECT por tenant; INSERT/UPDATE only via service_role
safety_evidence_artifacts → SELECT has_role('auditor')
safety_model_runs      → SELECT has_role('auditor')
```

## Service-role só server-side

A service_role key não cruza para o browser. Edge functions são as
únicas chamadoras. As rotas públicas (`/v1/safety/*`) autenticam por
`X-AgeKey-API-Key`, validam a aplicação contra a chave e setam o
`current_tenant_id()` antes de qualquer SELECT.

## HMAC

Reaproveita `consent-hmac.ts` (já em produção). Quatro purposes:

```
HMAC(K_tenant, "subject_ref:" || external_user_ref)
HMAC(K_tenant, "actor_ref:"  || ip|device)
```

Fallback `AGEKEY_CONSENT_HMAC_PEPPER + tenant_id` quando a Vault key
ainda não foi provisionada.

## Feature flags

```
AGEKEY_SAFETY_SIGNALS_ENABLED                 = false (master)
AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED        = false (NUNCA ativar em prod)
AGEKEY_SAFETY_MEDIA_GUARD_ENABLED             = false
AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED          = false
AGEKEY_SAFETY_MODEL_GOVERNANCE_ENABLED        = false
AGEKEY_SAFETY_LEGAL_HOLD_ENABLED              = false
AGEKEY_SAFETY_RETENTION_DRY_RUN               = true (deletes are off)
```

## Operações destrutivas controladas

- `DELETE` em `safety_events` é bloqueado por trigger.
- `UPDATE` em `safety_events` é bloqueado por trigger.
- `DELETE`/`UPDATE` em `safety_evidence_artifacts` bloqueados.
- `safety-retention-cleanup` é dry-run-by-default; o expurgo real
  requer particionamento mensal (P3) e aprovação documentada em
  `infrastructure/environments.md`.
