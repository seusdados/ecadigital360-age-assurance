# Contrato de API — AgeKey Safety Signals

> Schemas canônicos: `packages/shared/src/safety/safety-ingest.ts` e
> `safety-envelope.ts`.

Todas as respostas levam `pii_included: false` e `content_included: false`
como auto-atestado, e o privacy guard canônico bloqueia chaves PII na hora
de serializar.

---

## POST /v1/safety/event-ingest

Aceita um evento metadata-only e retorna a decisão.

### Request

```json
{
  "application_id": "018f7b8c-2222-7777-9999-2b31319d6ea2",
  "client_event_id": "client-corr-abcdef",
  "event_type": "message_send_attempt",
  "occurred_at": "2026-05-07T12:00:00.000Z",

  "actor_external_ref": "opaque-actor-1234",
  "counterparty_external_ref": "opaque-cp-5678",

  "actor_age_state": "adult",
  "counterparty_age_state": "minor_13_to_17",

  "interaction_ref": "thread-abc",
  "channel_type": "direct_message",

  "ip": "203.0.113.10",
  "user_agent": "Mozilla/5.0 ...",
  "device_external_ref": "device-fingerprint-opaque",

  "duration_ms": 1200,

  "artifact_hash": "abc...",
  "artifact_type": "image/jpeg",

  "content_processed": false,
  "content_stored": false,

  "metadata": { "feature_flag": "v2", "attempt": 3 }
}
```

### Recusas duras (antes do Zod)

Se o body contiver chaves de **conteúdo bruto** (`message`, `raw_text`,
`text`, `body`, `content`, `image`, `image_data`, `video`, `audio`,
`attachment`, `transcript`, `caption`):

→ HTTP 400 com `reason_code = SAFETY_RAW_CONTENT_REJECTED`.

Se o body contiver chaves de **PII** (`birthdate`, `cpf`, `email`,
`phone`, `name`, `latitude`, `longitude`, etc.):

→ HTTP 400 com `reason_code = SAFETY_PII_DETECTED`.

### Response 200

```json
{
  "decision": "step_up_required",
  "severity": "medium",
  "risk_category": "unknown_minor_contact",
  "reason_codes": ["SAFETY_STEP_UP_REQUIRED", "SAFETY_RISK_FLAGGED"],
  "safety_event_id": "018f...",
  "safety_alert_id": null,
  "step_up_required": true,
  "parental_consent_required": false,
  "actions": ["require_step_up_age_assurance", "notify_tenant_webhook"],
  "ttl_seconds": null,
  "pii_included": false,
  "content_included": false
}
```

---

## POST /v1/safety/rule-evaluate

Avalia um payload sem persistir nada. Útil para teste de regras no
admin e para automated tests. Mesmo body e mesmo response do
`/event-ingest`.

---

## POST /v1/safety/step-up

Cria uma `verification_session` do Core ligada a um `safety_alert_id`.

### Request

```json
{ "safety_alert_id": "018f...", "policy_slug": "default" }
```

### Response 200

```json
{
  "safety_alert_id": "018f...",
  "verification_session_id": "018f...",
  "reason_code": "SAFETY_STEP_UP_REQUIRED",
  "expires_at": "2026-05-07T12:15:00.000Z",
  "pii_included": false,
  "content_included": false
}
```

---

## POST /v1/safety/alert-dispatch

Re-emite o webhook para um alerta existente. **MVP STUB** — explícito
re-emit via insert direto em `webhook_deliveries` fica para a rodada
de hardening de webhooks.

---

## POST /v1/safety/aggregates-refresh (cron)

Auth: `x-agekey-cron-secret`. Recomputa contadores agregados.
**MVP STUB** — escreve um log de tamanho da amostra.

---

## POST /v1/safety/retention-cleanup (cron)

Auth: `x-agekey-cron-secret`. Conta linhas vencidas e — quando
`AGEKEY_SAFETY_RETENTION_DRY_RUN=false` — agenda o expurgo (que requer
particionamento mensal, P3).

---

## Webhooks

Eventos `safety.*` (live):

- `safety.event_ingested`
- `safety.alert_created`
- `safety.alert_updated`
- `safety.step_up_required`
- `safety.parental_consent_check_required`
- `safety.risk_flagged`

Schema: `WebhookSafetyEventSchema` em
`packages/shared/src/webhooks/webhook-types.ts`.

```json
{
  "event_id": "018f...",
  "event_type": "safety.alert_created",
  "created_at": "2026-05-07T12:00:00.000Z",
  "tenant_id": "018f...",
  "application_id": "018f...",
  "decision": "needs_review",
  "safety_alert_id": "018f...",
  "safety_event_id": null,
  "severity": "high",
  "risk_category": "unknown_minor_contact",
  "policy_id": null,
  "policy_version": null,
  "reason_codes": ["SAFETY_RISK_FLAGGED"],
  "payload_hash": "ef01...",
  "pii_included": false,
  "content_included": false
}
```

Assinatura `X-AgeKey-Signature` (HMAC SHA-256 do body) computada pelo
trigger SQL — mesmo padrão dos webhooks de verificação e consent.
