# issuers-register

`POST /v1/issuers`

Registra ou atualiza um issuer escopado ao tenant. Issuers globais
(`tenant_id IS NULL`) só são geridos pelo time de ops via SQL direto.

Auth: `X-AgeKey-API-Key`.

Body:
```json
{
  "issuer_did": "did:web:exemplo.gov.br",
  "name": "Exemplo Gov BR",
  "supports_formats": ["sd_jwt_vc", "w3c_vc"],
  "jwks_uri": "https://exemplo.gov.br/.well-known/jwks.json",
  "public_keys_json": {},
  "metadata_json": {}
}
```

Conflito (DID já em uso por outro tenant ou globalmente) → 400.
