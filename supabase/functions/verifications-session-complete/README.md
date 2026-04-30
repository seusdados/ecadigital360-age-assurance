# verifications-session-complete

`POST /v1/verifications/session/:id/complete`

Finaliza uma sessão executando o adapter selecionado pelo `method`.
Em caso de `approved`, devolve um JWT ES256 (claims em
`@agekey/shared/schemas/tokens.ts → ResultTokenClaims`).

## Auth
Header `X-AgeKey-API-Key`.

## Request body — discriminated by `method`

### method=fallback
```json
{
  "method": "fallback",
  "declaration": { "age_at_least": 18, "consent": true },
  "signals": { "captcha_token": "...", "device_fingerprint": "..." }
}
```

### method=zkp
```json
{
  "method": "zkp",
  "proof": "<base64>",
  "proof_format": "bls12381-bbs+",
  "issuer_did": "did:web:..."
}
```

### method=vc
```json
{
  "method": "vc",
  "credential": "<jwt or sd-jwt>",
  "format": "sd_jwt_vc",
  "issuer_did": "did:web:..."
}
```

### method=gateway
```json
{ "method": "gateway", "attestation": "<provider-payload>", "provider": "mock_gateway" }
```

## Response 200
```json
{
  "session_id": "...",
  "status": "completed",
  "decision": "approved",
  "reason_code": "FALLBACK_DECLARATION_ACCEPTED",
  "method": "fallback",
  "assurance_level": "low",
  "token": { "jwt": "eyJhbGciOiJFUzI1NiI...", "jti": "...", "expires_at": "...", "kid": "..." }
}
```

`token` é `null` quando `decision != 'approved'`.

## Errors
| reason_code | http |
|---|---|
| `INVALID_REQUEST` | 400/401 |
| `SESSION_EXPIRED` | 409 |
| `SESSION_ALREADY_COMPLETED` | 409 |
| `RATE_LIMIT_EXCEEDED` | 429 |

## curl
```bash
curl -X POST "$SUPABASE_URL/functions/v1/verifications-session-complete/$SESSION_ID" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"method":"fallback","declaration":{"age_at_least":18,"consent":true},"signals":{"captcha_token":"x"}}'
```
