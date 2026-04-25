# verifications-token-revoke

`POST /v1/verifications/token/revoke`

Revoga explicitamente um token de resultado pelo `jti`. Idempotente.

## Auth
`X-AgeKey-API-Key`. Só permite revogar tokens do mesmo tenant.

## Request body
```json
{ "jti": "01926cb0-...", "reason": "User requested data removal" }
```

## Response 200
```json
{ "jti": "...", "status": "revoked", "revoked_at": "2026-04-25T13:30:00Z" }
```
ou `{ "jti": "...", "status": "already_revoked" }` quando idempotente.

## curl
```bash
curl -X POST "$SUPABASE_URL/functions/v1/verifications-token-revoke" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jti":"...","reason":"user request"}'
```
