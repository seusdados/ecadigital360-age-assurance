# Secrets - AgeKey

## Regra principal

Nada sensível em frontend. Nada sensível em `NEXT_PUBLIC_*`.

## Server-only

```txt
SUPABASE_SERVICE_ROLE_KEY
AGEKEY_ADMIN_API_KEY
AGEKEY_CRON_SECRET
WEBHOOK_SIGNING_SECRET
GATEWAY_YOTI_API_KEY
GATEWAY_VERIFF_API_KEY
GATEWAY_IDWALL_API_KEY
GATEWAY_SERPRO_CLIENT_SECRET
```

## Public

```txt
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_AGEKEY_API_BASE
NEXT_PUBLIC_AGEKEY_ISSUER
```

## Proibido

- Commitar `.env`.
- Expor service role.
- Incluir private JWK no bundle.
- Logar API key raw.
- Mostrar token completo no painel sem mascarar.

## Rotação

Rotacionar:

- API key por cliente sob demanda;
- webhook secret sob demanda;
- signing keys por cron;
- service role em incidente;
- gateway secrets conforme política do provider.

## Matrix Vercel envs

Esta matriz é a fonte canônica para o que pode/deve existir em cada
scope de env vars no Vercel (`Production`, `Preview`, `Development`).
A auditoria efetiva é feita via
`infrastructure/scripts/audit-vercel-env.sh` (ver
`infrastructure/vercel-deploy.md` § "Auditoria de env vars").

Legenda:

- `✓` — DEVE existir nesse scope.
- `✗` — NÃO PODE existir nesse scope (auditoria FALHA se presente).
- `—` — não se aplica (consumido por outro plano de hospedagem; não vive em Vercel).

**Princípio**: o admin Next.js em Vercel só consome `NEXT_PUBLIC_*`. Todo
secret server-only (service role, JWT secret, cron secret, webhook
signing, admin API key, gateway keys) vive em **Supabase Edge Functions
secrets** (`supabase secrets set --project-ref <ref>`), nunca em Vercel.
Duplicar amplia a superfície de exposição sem benefício.

```
Variável                           | Prod | Preview | Dev  | Plano de hospedagem | Notas
-----------------------------------|------|---------|------|---------------------|---------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL           |  ✓   |    ✓    |  ✓   | Vercel envs         | URL do projeto Supabase (público)
NEXT_PUBLIC_SUPABASE_ANON_KEY      |  ✓   |    ✓    |  ✓   | Vercel envs         | anon key (público, RLS gate)
NEXT_PUBLIC_AGEKEY_API_BASE        |  ✓   |    ✓    |  ✓   | Vercel envs         | api.agekey.com.br ou staging.api.agekey.com.br
NEXT_PUBLIC_AGEKEY_ISSUER          |  ✓   |    ✓    |  ✓   | Vercel envs         | https://agekey.com.br ou staging.agekey.com.br
NEXT_PUBLIC_APP_URL                |  ✓   |    ✓    |  ✓   | Vercel envs         | URL pública do painel
SUPABASE_SERVICE_ROLE_KEY          |  ✗   |    ✗    |  ✗   | Supabase secrets    | consumido por Edge Functions (env.ts); não vive em Vercel
SUPABASE_JWT_SECRET                |  ✗   |    ✗    |  ✗   | Supabase secrets    | idem
AGEKEY_ADMIN_API_KEY               |  ✗   |    ✗    |  ✗   | Supabase secrets    | usado por Edge Functions admin (tenant-bootstrap, etc.)
WEBHOOK_SIGNING_SECRET             |  ✗   |    ✗    |  ✗   | Supabase secrets    | hash em applications.webhook_secret_hash; raw em Supabase
GATEWAY_YOTI_API_KEY               |  ✗   |    ✗    |  ✗   | Supabase secrets    | gateway adapter — Edge Function only
GATEWAY_VERIFF_API_KEY             |  ✗   |    ✗    |  ✗   | Supabase secrets    | idem
GATEWAY_ONFIDO_API_KEY             |  ✗   |    ✗    |  ✗   | Supabase secrets    | idem
CRON_SECRET                        |  ✗   |    ✗    |  ✗   | Supabase secrets    | usado pelos pg_cron jobs (010_edge_support.sql)
```

> A linha `✗ ✗ ✗` para secrets server-only é uma red-team check: se o
> audit detectar qualquer um deles em qualquer scope Vercel é drift de
> segurança e devem ser removidos do Vercel + revogados/rotacionados em
> Supabase como precaução.

> ⚠️ **Lembrete `NEXT_PUBLIC_*`**: QUALQUER valor exposto em uma
> variável `NEXT_PUBLIC_*` é embutido no bundle JavaScript servido
> ao navegador e portanto **público para qualquer visitante**. Nunca
> coloque secret, chave de API server-side, service role, JWT
> secret, signing secret ou credencial de gateway num
> `NEXT_PUBLIC_*`. A auditoria do bundle (ver
> `infrastructure/vercel-deploy.md` § "Bundle leak check") existe
> exatamente para detectar esse vazamento.

> ⚠️ **Placeholder dummy (`~`)**: em `Preview` e `Development`,
> variáveis de gateway devem conter um valor sintético (ex.: `dummy`,
> `preview-not-real`) que faz o adapter cair no modo `mock` /
> sandbox do provider. Nunca uma credencial real de homologação que
> consuma cota ou faça chamada externa autenticada.
