# verifications-session-create

`POST /v1/verifications/session`

Cria uma sessão de verificação etária. Retorna o `session_id`, o `nonce` de challenge,
os métodos disponíveis e o método preferido.

## Auth
Header `X-AgeKey-API-Key: <raw_api_key>`.

## Required env
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AGEKEY_ALLOWED_ORIGINS` (CSV; nunca `*` em produção)
- `AGEKEY_ENV` = `production` | `staging` | `development`

## Request body (JSON)
```json
{
  "policy_slug": "br-18-plus",
  "external_user_ref": "opaque_user_id",
  "locale": "pt-BR",
  "redirect_url": "https://example.com/return",
  "cancel_url": "https://example.com/cancel",
  "client_capabilities": {
    "digital_credentials_api": true,
    "wallet_present": false,
    "platform": "web"
  }
}
```

## Response 201
```json
{
  "session_id": "01926cb0-...",
  "status": "pending",
  "expires_at": "2026-04-25T13:30:00Z",
  "challenge": { "nonce": "...", "expires_at": "..." },
  "available_methods": ["zkp", "vc", "gateway", "fallback"],
  "preferred_method": "zkp",
  "policy": { "id": "...", "slug": "br-18-plus", "age_threshold": 18, "required_assurance_level": "substantial" }
}
```

## Errors
| reason_code | http |
|---|---|
| `INVALID_REQUEST` | 400 |
| `INVALID_REQUEST` (auth) | 401 |
| `RATE_LIMIT_EXCEEDED` | 429 |
| `INTERNAL_ERROR` | 500 |

## curl
```bash
curl -X POST "$SUPABASE_URL/functions/v1/verifications-session-create" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"policy_slug":"br-18-plus"}'
```
