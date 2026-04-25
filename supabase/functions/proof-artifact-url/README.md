# proof-artifact-url

`POST /v1/proof-artifacts/:id/url`

Emite uma URL assinada (TTL 300s) para um artefato em
`storage.proof-artifacts/<tenant_id>/<session_id>/<artifact_id>`.
Retorna 400 se o artefato é uma declaração fallback (sem `storage_path`).

Auth: `X-AgeKey-API-Key`. Refusa cross-tenant via `ForbiddenError 403`.

Body:
```json
{ "artifact_id": "01926cb0-..." }
```

Response 200:
```json
{
  "artifact_id": "...",
  "url": "https://...supabase.co/storage/v1/object/sign/...?token=...",
  "expires_in_seconds": 300,
  "mime_type": "application/jwt",
  "size_bytes": 4096
}
```

> O TTL de 300s é o teto recomendado para signed URLs em ambiente
> regulado (LGPD §6º, ECA §17). Não aumentar sem revisão jurídica.
