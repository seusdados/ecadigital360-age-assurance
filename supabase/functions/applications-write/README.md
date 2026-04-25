# applications-write

`POST /v1/applications-write`

Cria ou atualiza uma application do tenant.

Auth: `X-AgeKey-API-Key` (com role admin do tenant).

## Body
```json
{
  "id": "<opcional para update>",
  "name": "Loja XYZ",
  "slug": "loja-xyz",
  "description": "...",
  "callback_url": "https://app.cliente.com/return",
  "webhook_url": "https://api.cliente.com/webhooks/agekey",
  "allowed_origins": ["https://app.cliente.com"]
}
```

## Response 201 (create)
```json
{
  "id": "...",
  "status": "created",
  "api_key": "ak_live_...",         // RAW — exibe ao usuário 1x e descarta
  "webhook_secret": "whsec_..."     // RAW — idem
}
```

## Response 200 (update)
```json
{ "id": "...", "status": "updated", "api_key": null, "webhook_secret": null }
```

> **Importante:** o frontend deve mostrar `api_key` e `webhook_secret` UMA
> ÚNICA VEZ ao criar — após o usuário fechar o diálogo, esses valores são
> irrecuperáveis (o backend só persiste o SHA-256). Para perda, use
> `applications-rotate-key` para gerar nova api_key.
