# policies-write

`POST /v1/policies` — cria ou atualiza policy do tenant.

Auth: `X-AgeKey-API-Key`.

Body:
```json
{
  "id": "<opcional para update>",
  "slug": "br-18-plus",
  "name": "Brasil — 18+",
  "age_threshold": 18,
  "method_priority_json": ["zkp","vc","gateway","fallback"],
  "required_assurance_level": "substantial",
  "token_ttl_seconds": 86400,
  "jurisdiction_code": "BR",
  "cloned_from_id": "<id de template global>"
}
```

Cada UPDATE incrementa `current_version` automaticamente via trigger e
gera nova linha em `policy_versions` (snapshot imutável).
