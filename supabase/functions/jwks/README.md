# jwks

`GET /.well-known/jwks.json`

Endpoint público (sem auth) que serve o JWKS com todas as chaves
ES256 nos status `active`, `rotating` e `retired`. Clientes
externos validam JWTs do AgeKey contra esta lista durante toda a
janela de overlap de rotação.

`Cache-Control: public, max-age=300, s-maxage=300`.

Implantar em produção atrás de um redirect `/.well-known/jwks.json
→ /functions/v1/jwks` no domínio `agekey.com.br`.

## Garantia de privacidade (AK-P0-08)

**O endpoint NUNCA inclui o campo `d` (chave privada) — nem
qualquer outro membro privado de JWK.**

Defesa em profundidade em três camadas:

1. **Origem dos dados** — `loadJwksPublicKeys` (em
   `_shared/keys.ts`) seleciona apenas a coluna
   `crypto_keys.public_jwk_json`. A coluna deveria conter só
   material público; a chave privada vive em `vault.secrets` (ver
   migration `014_vault_crypto_keys.sql`).
2. **Sanitização** — antes de retornar, `loadJwksPublicKeys`
   aplica `pickPublicJwk()` (allowlist explícito de membros
   públicos: `kty, crv, x, y, n, e, kid, use, alg, key_ops, x5c,
   x5t, x5t#S256, x5u`) e em seguida `assertJwkIsPublic()`.
3. **Construção da resposta** — `buildJwksResponseBody()` em
   `_shared/jwks-response.ts` reaplica `pickPublicJwk` +
   `assertJwkIsPublic` em cada entrada. Se algum membro privado
   reaparecer, o handler lança `Error` e retorna 500 (em vez de
   vazar a chave).

### Membros JWK proibidos (RFC 7518 §6)

| Tipo | Membros privados |
|------|------------------|
| EC   | `d`              |
| RSA  | `d, p, q, dp, dq, qi, oth` |
| oct  | `k`              |

Lista canônica em `packages/shared/src/jws.ts` →
`PRIVATE_JWK_MEMBERS`.

## Testes que protegem o invariante

- `packages/shared/src/jws-public-only.test.ts` (vitest, 17
  cases) — cobre `pickPublicJwk`, `assertJwkIsPublic`,
  `findPrivateJwkMembers`. Inclui o caso "JWKS array com 1 chave
  privada no meio".
- `supabase/functions/_tests/jwks-endpoint.test.ts` (deno, 8
  cases) — testa a função pura `buildJwksResponseBody`:
  - retorna 2 entradas quando `loadJwksPublicKeys` devolve 2
    (active + rotating)
  - nunca expõe `d` mesmo quando recebe um `privateJwk` por engano
  - cada entrada tem `kid`, `use=sig`, `alg=ES256`, `kty=EC`,
    `crv=P-256`
  - `Cache-Control: public, max-age=300, s-maxage=300` é pinado
  - props não-allowlist são descartadas
- `supabase/functions/_tests/key-rotation-logic.test.ts` (deno,
  16 cases) — pin do planner puro (`shouldRotate`,
  `classifyTransitions`, `hasMultipleFreshActives`); inclui um
  guard `hasMultipleFreshActives` contra regressão (duas chaves
  `active` simultaneamente).

Todos os três suítes rodam em CI nos jobs `edge-functions-deno` e
`privacy-guard-fuzz` antes de qualquer merge para `main`.

## Ciclo de rotação

Cron `key-rotation-daily` roda **diariamente às 03:00 UTC** —
agendado via `pg_cron` em
`supabase/migrations/010_edge_support.sql`:

```sql
PERFORM cron.schedule(
  'key-rotation-daily',
  '0 3 * * *',
  $cmd$
    SELECT net.http_post(
      url := current_setting('app.functions_url') || '/key-rotation',
      ...
    );
  $cmd$
);
```

A Edge Function `key-rotation` (em
`supabase/functions/key-rotation/index.ts`) executa o algoritmo:

1. Gera par ES256 fresh (`crypto.subtle.generateKey`).
2. INSERT na tabela `crypto_keys` com status `rotating`
   (ou `active` no bootstrap).
3. Persiste a chave privada em **Supabase Vault** via RPC
   `crypto_keys_store_private` (linkada por `vault_secret_id`).
4. Promove `rotating` ≥ 24h → `active`.
5. Demove `active` ≥ 24h → `retired` (mantém o mais novo).
6. Purge de `retired` ≥ 90 dias (vault primeiro, row depois).

A decisão pura está extraída em
`supabase/functions/_shared/key-rotation-logic.ts` para teste
sem DB.

## curl

```bash
curl -s "$SUPABASE_URL/functions/v1/jwks" | jq
```

Resposta:

```json
{
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "x": "...",
      "y": "...",
      "kid": "ak_20260430_03",
      "use": "sig",
      "alg": "ES256"
    }
  ]
}
```
