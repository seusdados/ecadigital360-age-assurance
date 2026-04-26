# applications-rotate-key

`POST /v1/applications-rotate-key`

Rotaciona a `api_key` de uma application. Retorna a NOVA chave raw uma única
vez; o hash antigo é sobrescrito imediatamente, qualquer chamada com a chave
anterior passa a receber 401.

Auth: `X-AgeKey-API-Key` (com role admin do tenant).

## Body
```json
{ "application_id": "<uuid>" }
```

## Response 200
```json
{
  "application_id": "...",
  "api_key": "ak_live_...",
  "api_key_prefix": "ak_live_a1b2c3…",
  "rotated_at": "2026-04-25T13:30:00Z"
}
```

> **Atenção:** essa rotação não tem janela de overlap. Se o cliente tem
> múltiplos serviços em produção usando a chave antiga, todos perdem acesso
> imediatamente. Implementar rotação com período de overlap é trabalho futuro
> (Fase 4 enterprise feature).
