# Edge Functions — AgeKey Safety Signals

| Função | Endpoint | Auth | Comportamento |
|---|---|---|---|
| `safety-event-ingest` | `POST /v1/safety/event-ingest` | API key | Rejeita raw content / PII; HMAC actor/cp/ip/device; insere subject/event/alert; avalia regras; retorna decisão |
| `safety-rule-evaluate` | `POST /v1/safety/rule-evaluate` | API key | Igual ao ingest mas sem persistir. Útil para teste de regras |
| `safety-step-up` | `POST /v1/safety/step-up` | API key | Cria `verification_session` canônica do Core; vincula ao alerta |
| `safety-alert-dispatch` | `POST /v1/safety/alert-dispatch` | API key | **STUB**: re-emit explícito requer rodada de webhooks-hardening |
| `safety-aggregates-refresh` | `POST /v1/safety/aggregates-refresh` | cron secret | **STUB**: sample size logged; upsert per-bucket é P3 |
| `safety-retention-cleanup` | `POST /v1/safety/retention-cleanup` | cron secret | dry-run-by-default; expurgo real depende de partition DETACH (P3) |

## `safety-event-ingest` em detalhe

```
1. preflight CORS
2. moduleEnabled() — feature flag master
3. authenticateApiKey + setTenantContext + checkRateLimit
4. await req.json()
5. rejectForbiddenIngestKeys(body)
   ↳ raw content key → 400 SAFETY_RAW_CONTENT_REJECTED
   ↳ PII key         → 400 SAFETY_PII_DETECTED
6. SafetyEventIngestRequestSchema.safeParse(body)
   ↳ schema literal força content_processed/content_stored = false
7. consentHmacHex(client, tenantId, 'subject_ref',  actor_external_ref)
8. consentHmacHex(client, tenantId, 'subject_ref',  counterparty_external_ref?)
9. consentHmacHex(client, tenantId, 'actor_ref',    ip?)         (HMAC do IP)
10. consentHmacHex(client, tenantId, 'actor_ref',    device_external_ref?)
11. ensureSubject(actor) + ensureSubject(counterparty?)  → upsert safety_subjects
12. INSERT safety_events (content_processed=false locked by CHECK)
13. count(*) ad-hoc para 24h/7d/30d/reports/links/media
14. evaluate(rules) → SafetyDecisionEnvelope (envelope_version=1)
15. INSERT safety_alerts (se needed by actions)
16. INSERT audit_events (decision_domain='safety_signal', whitelisted diff)
17. respond(SafetyEventIngestResponseSchema.parse(body))
```

A trigger SQL `trg_safety_alerts_fanout` cuida do webhook quando o
alerta foi inserido.

## `safety-step-up` em detalhe

```
1. authenticateApiKey
2. body.safety_alert_id valida existência + tenant
3. resolvePolicy(client, tenantId, policy_slug ?? 'default')
4. INSERT verification_sessions (status='pending')
5. INSERT verification_challenges (newNonce)
6. INSERT audit_events (action='safety.step_up_required')
7. respond { safety_alert_id, verification_session_id, expires_at }
```

A relying party redireciona o usuário para a sessão criada via SDK
canônico — sem fluxo paralelo de KYC.

## Padrão de resposta

Toda resposta passa por `assertPublicPayloadHasNoPii()` antes de ser
serializada. `pii_included: false` e `content_included: false` aparecem
explicitamente.

## Rate limit e billing

Edge functions chamam `checkRateLimit` (mesmo helper do Core). Billing
events não são emitidos por safety v1 — a cobrança fica para uma
rodada com modelo de cobrança específico de safety.
