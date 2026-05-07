# AgeKey Retention Job (cron unificado)

> Status: introduzido na rodada R7. Cobre Core + Consent + Safety.

## Edge Function

`POST /v1/retention-job` — auth via `Bearer CRON_SECRET`. Cron pg agendado em 03:00 UTC diário (migration 028).

## Modo dry-run

`AGEKEY_RETENTION_DRY_RUN=true` — conta linhas elegíveis sem deletar. Use antes de habilitar em prod nova.

## Tabelas cobertas (R7 MVP)

| Tabela | Classe | TTL |
|---|---|---|
| `safety_events` | `event_30d`, `event_90d`, `event_180d` (lê coluna) | conforme classe |
| `guardian_verifications` | `otp_30d` | 30 dias após expires_at |
| `verification_challenges` | `session_24h` | 24h após expires_at |

## Tabelas a cobrir em rodadas futuras

| Tabela | Classe | Notas |
|---|---|---|
| `verification_sessions` (status terminal) | `session_7d`/`event_180d` | Requer query mais complexa |
| `proof_artifacts` | `event_90d` | Requer purge do Storage também |
| `result_tokens` (revogados) | `event_180d` | Após audit window |
| `parental_consent_requests` (terminal) | `consent_expired_audit_window` (365d) | Após decided_at + 365d |
| `parental_consents` (revoked/expired) | `consent_expired_audit_window` | Após revoked_at + 365d |
| `parental_consent_tokens` | `result_token_policy_ttl` | Dinâmico |
| `guardian_contacts` | dinâmico | Vault purge via RPC `guardian_contacts_purge_vault` |
| `safety_alerts` (resolved/dismissed) | `alert_12m` | Cleanup gradual |
| `safety_aggregates` | `aggregate_12m` | Sobrevivem aos eventos individuais |
| `audit_events` partições | `event_180d` | DETACH PARTITION mensal |

## legal_hold

`legal_hold = true` em qualquer linha **bloqueia delete**. Implementação:
- `safety_events`, `safety_evidence_artifacts`: coluna `legal_hold`.
- Outras tabelas: ainda não têm coluna; legal_hold é gestão manual.

## Audit trail

Cada DELETE com volume > 0 registra `audit_events` com `action: 'retention.cleanup.<resource>'`.

## Helpers compartilhados

`packages/shared/src/retention/cleanup-rules.ts` — `decideCleanup(ctx)`:

```ts
const r = decideCleanup({
  now: Date.now(),
  occurredAt: row.created_at_ms,
  retentionClass: row.retention_class,
  legalHold: row.legal_hold,
  policyTtlSeconds: 3600,  // só para classes dinâmicas
});
// r.shouldDelete: boolean
// r.reason: 'within_ttl' | 'ttl_expired' | 'legal_hold_active' | ...
```

Pure: testável em vitest (15 cases em `retention-cleanup-rules.test.ts`).

## safety-retention-cleanup standalone

`safety-retention-cleanup` (R4) continua funcionando independente. O `retention-job` global é aditivo. Em rodada futura, deduplicar lógica em helpers compartilhados.

## Configuração pg_cron

Migration 028 cria schedule. Variáveis SQL necessárias:

```sql
ALTER DATABASE postgres SET agekey.retention_job_url = 'https://<project>.supabase.co/functions/v1/retention-job';
ALTER DATABASE postgres SET agekey.cron_secret = '<token>';
```

Em rodada de hardening (futura), mover para `vault.secrets`.
