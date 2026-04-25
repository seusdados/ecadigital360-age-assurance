# audit-list

`GET /v1/audit-list?action=&resource_type=&actor_type=&from=&to=&cursor=&limit=`

Feed paginado de `audit_events`. Cursor pagination via `id`.

Auth: `X-AgeKey-API-Key`. RLS exige role >= auditor no tenant.

## Filtros (todos opcionais)
- `action` (ex.: `policies.update`)
- `resource_type` (ex.: `policies`, `applications`, `tenants`, `issuers`, `crypto_keys`, `webhook_endpoints`)
- `actor_type`: `user|api_key|system|cron`
- `from`, `to`: ISO-8601
- `cursor`: id da última linha da página anterior
- `limit`: 1–200 (default 100)

## Resposta
```json
{
  "items": [
    {
      "id": "...",
      "actor_type": "user",
      "actor_id": "<auth.users uuid>",
      "action": "policies.update",
      "resource_type": "policies",
      "resource_id": "...",
      "diff_json": { "age_threshold": 18 },
      "client_ip": "203.0.113.1",
      "created_at": "..."
    }
  ],
  "next_cursor": "...",
  "has_more": true
}
```

`diff_json` é minimizado pelo trigger `audit_log()` em 009_triggers.sql —
fields sensíveis (`api_key_hash`, `secret_hash`, `private_key_enc`) são
removidos antes de gravar.
