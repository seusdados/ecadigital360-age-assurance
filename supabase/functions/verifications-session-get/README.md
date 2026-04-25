# verifications-session-get

`GET /v1/verifications/session/:id`

Retorna o snapshot público da sessão. Sem PII, sem proofs, sem tokens.

## Auth
Header `X-AgeKey-API-Key`.

## Response 200
```json
{
  "session_id": "...",
  "status": "completed",
  "method": "fallback",
  "expires_at": "...",
  "completed_at": "...",
  "decision": "approved",
  "reason_code": "FALLBACK_DECLARATION_ACCEPTED",
  "policy": { "id": "...", "slug": "br-18-plus", "age_threshold": 18 }
}
```

## Errors
| reason_code | http |
|---|---|
| `INVALID_REQUEST` | 400/401 |
| `INVALID_REQUEST` (not found) | 404 |
| `RATE_LIMIT_EXCEEDED` | 429 |

## curl
```bash
curl "$SUPABASE_URL/functions/v1/verifications-session-get/$SESSION_ID" \
  -H "X-AgeKey-API-Key: $AK_API_KEY"
```
