# policies-list

`GET /v1/policies?include_templates=true`

Lista policies do tenant. Por padrão inclui também templates globais
(`is_template=true`); passe `include_templates=false` para suprimir.

Auth: `X-AgeKey-API-Key`.
