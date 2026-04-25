# Edge Functions tests (Deno)

Testes unitários executados sem rede / sem DB. Cobrem a lógica pura
dos helpers em `_shared/`.

## Run

```bash
deno test --allow-net --allow-env supabase/functions/_tests/
```

(`--allow-net` é exigido por `crypto.subtle` em algumas versões de
Deno; em ambientes mais recentes pode ser omitido.)

## Suítes

| Arquivo | Cobertura |
|---|---|
| `tokens.test.ts` | sign+verify ES256, expired, unknown_kid, tampered, wrong_issuer |
| `policy-engine.test.ts` | selectAvailableMethods + meetsAssurance |
| `fallback-adapter.test.ts` | approved / denied / needs_review + prepareSession |

## A implementar (Fase 2.b)
- Testes de integração contra Postgres local (RLS cross-tenant, triggers de
  imutabilidade, versionamento de policies).
- Testes contract-based usando openapi3-zod schemas dos endpoints.
