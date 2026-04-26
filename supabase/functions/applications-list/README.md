# applications-list

`GET /v1/applications-list`

Lista aplicações do tenant. **NÃO retorna `api_key_hash` nem
`webhook_secret_hash`** — só o `api_key_prefix` (não-secreto, para
identificação visual no painel).

Auth: `X-AgeKey-API-Key`.

Para obter o raw da api_key: use `applications-write` no momento da
criação ou `applications-rotate-key` para rotacionar.
