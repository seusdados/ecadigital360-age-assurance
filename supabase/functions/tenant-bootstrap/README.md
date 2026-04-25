# tenant-bootstrap

`POST /v1/tenant-bootstrap`

Onboarding atômico do usuário: cria `tenants` + `tenant_users` (role=owner) +
`applications` numa única transação (RPC `tenant_bootstrap` em migration 013).

**Auth:** `Authorization: Bearer <Supabase Auth JWT>`. NÃO usa
`X-AgeKey-API-Key` — neste ponto o usuário ainda não tem tenant.

Refusa se o usuário já é membro de algum tenant (use o tenant switcher).

## Body
```json
{
  "tenant": { "name": "Loja XYZ", "slug": "loja-xyz", "jurisdiction_code": "BR" },
  "application": { "name": "App principal", "slug": "main", "description": "..." }
}
```

## Response 201
```json
{
  "tenant_id": "...",
  "tenant_slug": "loja-xyz",
  "application_id": "...",
  "application_slug": "main",
  "api_key": "ak_live_...",         // RAW — exibe ao usuário 1x e descarta
  "api_key_prefix": "ak_live_a1…",
  "webhook_secret": "whsec_..."     // RAW — idem
}
```

## Erros
| reason_code | http |
|---|---|
| `INVALID_REQUEST` (auth ausente / token inválido) | 401 |
| `INVALID_REQUEST` (já membro de tenant) | 403 |
| `INVALID_REQUEST` (slug duplicado) | 400 |
