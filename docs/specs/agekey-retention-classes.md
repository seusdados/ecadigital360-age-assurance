# AgeKey — Retention Classes (canônicas)

> Status: contrato canônico da Rodada 1.
> Implementação: `packages/shared/src/retention/retention-classes.ts`.

## 1. Classes canônicas

| Classe | Descrição | TTL padrão | Cleanup auto | Safety v1 |
|---|---|---|---|---|
| `no_store` | Sem persistência fora de processamento em memória. | 0s | sim | sim |
| `session_24h` | Sessão temporária. | 24h | sim | sim |
| `session_7d` | Sessão estendida. | 7d | sim | sim |
| `otp_24h` | OTP/link curto. | 24h | sim | não |
| `otp_30d` | OTP com janela auditoria ampliada. | 30d | sim | não |
| `event_30d` | Evento Safety/audit minimizado. | 30d | sim | sim |
| `event_90d` | Evento Safety/audit minimizado. | 90d | sim | sim |
| `event_180d` | Evento Safety/audit minimizado. | 180d | sim | sim |
| `aggregate_12m` | Contadores agregados; sobrevivem aos eventos individuais. | 12m | sim | sim |
| `verification_result_policy_ttl` | TTL pela política. | dinâmico | sim | não |
| `result_token_policy_ttl` | TTL pela política. | dinâmico | sim | não |
| `consent_active_until_expiration` | Vive até `expires_at`. | dinâmico | sim | não |
| `consent_expired_audit_window` | Janela de auditoria após expiração. | 365d | sim | não |
| `alert_12m` | Alerta Safety. | 12m | sim | sim |
| `case_24m` | Caso/escalonamento Safety. | 24m | sim | sim |
| `legal_hold` | Legal hold. | indefinido | **não** | sim |

## 2. Regras canônicas

1. **Legal hold nunca é apagado automaticamente.** Job de cleanup que encontrar `legal_hold` ativo deve gerar `audit_event` com `reason_code = "RETENTION_LEGAL_HOLD_ACTIVE"`.
2. **Conteúdo bruto não existe no MVP.** Classes que serviriam para mensagens/mídias inexistem por design — Safety v1 é metadata-only.
3. **Contato de responsável** (tabela `guardian_contacts`) tem retenção própria (sugestão: `consent_active_until_expiration` durante o ciclo do consentimento, depois `consent_expired_audit_window`).
4. **Eventos Safety v1** são metadata-only e devem usar uma das classes `event_*` ou `aggregate_*`.
5. **Aggregates podem sobreviver** aos eventos individuais (`aggregate_12m`).
6. **Retention cleanup deve gerar `audit_event`** sempre que apagar/arquivar registros — incluindo o número de linhas afetadas e a classe aplicada.
7. **Cleanup nunca usa DELETE em cascata implícita.** Sempre via `DETACH PARTITION` para tabelas particionadas (`audit_events`, `billing_events`) ou query com `LIMIT` controlado para evitar locks longos.

## 3. Mapeamento por módulo (referência)

| Recurso | Classe sugerida |
|---|---|
| `verification_sessions` | `session_7d` |
| `verification_challenges` | `session_24h` |
| `proof_artifacts` | `event_90d` |
| `verification_results` | `verification_result_policy_ttl` |
| `result_tokens` | `result_token_policy_ttl` |
| `parental_consent_requests` | `session_7d` |
| `guardian_contacts` | `consent_active_until_expiration` → `consent_expired_audit_window` |
| `guardian_verifications` | `otp_24h` |
| `parental_consents` | `consent_active_until_expiration` → `consent_expired_audit_window` |
| `parental_consent_tokens` | `result_token_policy_ttl` (ou TTL específico do módulo) |
| `safety_events` | `event_90d` (default), configurável por `policy.safety.default_retention_class` |
| `safety_aggregates` | `aggregate_12m` |
| `safety_alerts` | `alert_12m` |
| `safety_cases` | `case_24m` |
| `audit_events` | `event_180d` (default por jurisdição) |
| `billing_events` | `event_180d` (mínimo legal por jurisdição) |
