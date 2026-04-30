# issuers-list

`GET /v1/issuers`

Lista issuers globais (`tenant_id IS NULL`) + issuers do tenant atual.

Auth: `X-AgeKey-API-Key`.

Resposta:
```json
{ "items": [ { "id": "...", "issuer_did": "did:web:...", "name": "...", "trust_status": "trusted", "supports_formats": ["sd_jwt_vc"], "scope": "global" } ] }
```
