# verifications-token-verify

`POST /v1/verifications/token/verify`

Valida um JWT de resultado emitido pelo AgeKey. Verifica assinatura
ES256 contra o JWKS, `exp`/`nbf`, `iss`, audience opcional, e checa
revogação em `result_tokens.revoked_at`.

## Auth
`X-AgeKey-API-Key`. O token só é considerado válido se `tenant_id` do
`result_tokens` bate com o tenant do api_key chamador.

## Request body
```json
{ "token": "eyJhbGciOiJFUzI1NiI...", "expected_audience": "my-app-slug" }
```

## Response 200
```json
{
  "valid": true,
  "claims": { ... },
  "revoked": false
}
```

Quando `valid=false`, `reason_code` indica o motivo (malformed,
unknown_kid, bad_signature, expired, not_yet_valid, wrong_issuer,
wrong_audience).

## curl
```bash
curl -X POST "$SUPABASE_URL/functions/v1/verifications-token-verify" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token":"'"$JWT"'"}'
```
