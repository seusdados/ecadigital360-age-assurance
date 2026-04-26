# jwks

`GET /.well-known/jwks.json`

Endpoint público (sem auth) que serve o JWKS com todas as chaves
ES256 nos status `active` e `retired`. Clientes externos validam
JWTs do AgeKey contra esta lista.

`Cache-Control: public, max-age=300, s-maxage=300`.

Implantar em produção atrás de um redirect `/.well-known/jwks.json
→ /functions/v1/jwks` no domínio `agekey.com.br`.

## curl
```bash
curl -s "$SUPABASE_URL/functions/v1/jwks" | jq
```
