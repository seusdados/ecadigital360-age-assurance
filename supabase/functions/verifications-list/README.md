# verifications-list

`GET /v1/verifications-list?status=&decision=&method=&application_id=&policy_id=&from=&to=&cursor=&limit=`

Listagem paginada de `verification_sessions` para o painel. Cursor pagination
via `id` (UUID v7 = ordenado por tempo).

Auth: `X-AgeKey-API-Key`.

## Filtros (todos opcionais)
- `status`: `pending|in_progress|completed|expired|cancelled`
- `decision`: `approved|denied|needs_review`
- `method`: `zkp|vc|gateway|fallback`
- `application_id`, `policy_id`: UUID
- `from`, `to`: ISO-8601 datetimes
- `cursor`: UUID da última sessão da página anterior
- `limit`: 1–100 (default 50)

## Resposta
```json
{
  "items": [
    {
      "session_id": "...",
      "status": "completed",
      "method": "fallback",
      "policy": { "id": "...", "slug": "dev-18-plus", "age_threshold": 18, "version": 1 },
      "application": { "id": "...", "slug": "dev-app" },
      "decision": "approved",
      "reason_code": "FALLBACK_DECLARATION_ACCEPTED",
      "assurance_level": "low",
      "jti": "01926cb0-...",
      "created_at": "...",
      "completed_at": "..."
    }
  ],
  "next_cursor": "01926cb0-...",
  "has_more": true
}
```

Sem PII no payload — apenas IDs, decisões e reason codes.
