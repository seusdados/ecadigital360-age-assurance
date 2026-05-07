# AgeKey Cross-tenant Test Matrix (R8)

> Status: rodada R8 — infra + suítes baseline. Skip-friendly.

| Tabela | SELECT cross-tenant | INSERT/UPDATE cross-tenant | Cobertura |
|---|---|---|---|
| `tenants` | bloqueado | bloqueado (service_role only) | implícito |
| `applications` | bloqueado | bloqueado (admin role only) | ✅ core-cross-tenant |
| `policies` | bloqueado (exceto templates globais) | bloqueado | implícito |
| `verification_sessions` | bloqueado | bloqueado (Edge only) | ✅ core-cross-tenant |
| `verification_results` | bloqueado | bloqueado (append-only) | TODO |
| `result_tokens` | bloqueado | bloqueado | ✅ core-cross-tenant |
| `parental_consent_requests` | bloqueado | bloqueado | ✅ consent-cross-tenant |
| `guardian_contacts` | bloqueado (admin role only) | bloqueado | ✅ consent-cross-tenant |
| `guardian_verifications` | bloqueado (false RLS) | bloqueado | TODO (RPC apenas) |
| `parental_consents` | bloqueado | bloqueado (append-only) | ✅ consent-cross-tenant |
| `parental_consent_tokens` | bloqueado | bloqueado | TODO |
| `parental_consent_revocations` | bloqueado | bloqueado (append-only) | TODO |
| `safety_events` | bloqueado | bloqueado (Edge only) | ✅ safety-cross-tenant |
| `safety_subjects` | bloqueado | bloqueado | ✅ safety-cross-tenant |
| `safety_alerts` | bloqueado | bloqueado | ✅ safety-cross-tenant |
| `safety_aggregates` | bloqueado | bloqueado | ✅ safety-cross-tenant |
| `safety_evidence_artifacts` | bloqueado | bloqueado (legal_hold blindado) | TODO |
| `safety_rules` | NÃO bloqueado em SELECT (global default + tenant) | bloqueado em INSERT/UPDATE/DELETE | TODO |
| `webhook_endpoints` | bloqueado | bloqueado | TODO |
| `webhook_deliveries` | bloqueado | bloqueado (Edge only) | TODO |
| `audit_events` | bloqueado | bloqueado (trigger only) | TODO |
| `billing_events` | bloqueado | bloqueado (trigger only) | TODO |

## Invariantes testadas

1. Tenant A não consegue ler ID de Tenant B em qualquer tabela com RLS de tenant.
2. Tenant B fazendo query com IDs de Tenant A retorna `[]` (não erro — RLS oculta).
3. Aggregates não cruzam tenants (sem score universal).

## Próximas rodadas

- R8.1: adicionar RPC `set_current_tenant(uuid)` em migration de hardening.
- R8.2: cobrir TODO acima.
- R8.3: testes de Edge Functions cross-tenant (HTTP-level, não SQL-level).
- R8.4: integração no CI com Supabase ephemeral.
