# Vercel Deploy — AgeKey

## Projetos recomendados

1. `agekey-site`
2. `agekey-admin`
3. `agekey-verify`
4. `agekey-docs`

No estágio atual, o admin pode continuar em `apps/admin`.

## Configuração

Se o Root Directory no Vercel for `apps/admin`, o output directory deve ser `.next`, não `apps/admin/.next`.

## Variáveis

Configurar variáveis por ambiente: preview, staging, production.

Auditoria recomendada (`AK-P0-07`): rodar `vercel env ls` por
ambiente e garantir que secrets server-only **não** estão em
`Preview` ou `Development`.

Para o proxy `api.agekey.com.br` (ver seção abaixo), configurar:

| Var | Scope | Conteúdo |
|---|---|---|
| `SUPABASE_PROJECT_REF` | Production | ref do projeto Supabase production |
| `SUPABASE_PROJECT_REF` | Preview | ref do projeto Supabase staging |

> O placeholder `PROJECT_REF` no `vercel.json` deve ser substituído
> via build-time com `vercel env pull` + sed, OU manter literal e
> resolver na própria UI da Vercel (Domains → Rewrites). Optamos por
> manter o `vercel.json` checkado-in com o placeholder para evitar
> commit acidental do `project_ref` real, que embora não seja
> secret-grade é uma informação de infra que preferimos não
> publicar antes do go-live.

## Headers recomendados

- HSTS em produção (gating: ver `infrastructure/dns/agekey-dns-plan.md` §6).
- CSP conservadora.
- X-Frame-Options para painel.
- Frame policy específica para widget/verify se necessário.
- Referrer-Policy.
- Permissions-Policy.

## Build

```bash
pnpm install --no-frozen-lockfile
pnpm build
```

---

## API proxy via `api.agekey.com.br` (AK-P0-03)

### Decisão arquitetural

`api.agekey.com.br/v1/*` é o **contrato público estável** consumido
por SDKs, integrações de cliente e webhooks reversos. A
implementação atual está em Supabase Edge Functions
(`https://<project>.supabase.co/functions/v1/*`), porém o contrato
público **não** expõe esse domínio diretamente.

Decisão: usar **Vercel rewrites** como proxy edge entre
`api.agekey.com.br/v1/*` → `https://<project>.supabase.co/functions/v1/*`.

### Por que proxy

| Razão | Detalhe |
|---|---|
| Estabilidade do contrato | Trocar de Supabase para Cloudflare Workers, AWS Lambda, ou self-host não exige migração de SDK / clientes. |
| Versionamento | Prefixo `/v1/` declarado no contrato. Ruptura exige `/v2/` paralelo, com `/v1/` em deprecation por ≥12 meses. |
| Branding | Latência percebida é de "AgeKey", não "supabase.co" — relevante para confiança em e-commerce e telcos. |
| Controle de headers | `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` aplicados na borda Vercel antes de chegar na Edge Function. |
| Observabilidade | Logs Vercel (request ID, geo, cache) complementam logs Supabase. |
| Zero-cost migration | Vercel rewrite é declarativo (`vercel.json`); sem deploy de função adicional. |

### Como funciona

1. Cliente envia `POST https://api.agekey.com.br/v1/verifications/session/create`.
2. Vercel edge intercepta o host `api.agekey.com.br` (rule definida
   em `vercel.json` com `has: [{ type: "host", value: "api.agekey.com.br" }]`).
3. Rewrite substitui apenas o path: `/v1/:path*` → `/functions/v1/:path*`,
   destination `https://<PROJECT_REF>.supabase.co`.
4. Vercel preserva method, body, e headers (`Authorization`,
   `X-AgeKey-API-Key`, `Idempotency-Key`, `Content-Type`).
5. Response da Edge Function é retornada ao cliente acrescida dos
   headers de segurança definidos em `headers` no `vercel.json`.

> **Importante:** rewrite NÃO é redirect. O cliente continua falando
> com `api.agekey.com.br` para a vida toda da request — não há
> 3xx, não há leak de `*.supabase.co` em `Location` ou logs de browser.

### Headers que o cliente DEVE enviar

| Header | Obrigatório | Quando | Notas |
|---|---|---|---|
| `Authorization: Bearer <jwt>` | em chamadas autenticadas via JWT (admin, partner SSO) | Edge Function valida `aud`, `iss` |
| `X-AgeKey-API-Key: ak_live_...` | em chamadas server-to-server (criar sessão, verificar token, listar verificações) | escopo de tenant; nunca em browser code |
| `Content-Type: application/json` | sempre que houver body | Edge Function rejeita 415 caso ausente |
| `Idempotency-Key: <uuid-v4>` | recomendado em `POST /v1/verifications/session/create` e `POST /v1/webhooks/...` | replay-safe; TTL 24h |
| `X-AgeKey-Signature: t=...,v1=...` | webhooks RECEBIDOS pelo cliente | verificação HMAC documentada em `docs/api/webhooks.md` |

Headers **proibidos**:

- `Host` — Vercel reescreve obrigatoriamente; cliente não controla.
- `X-Forwarded-For` — server-side trust apenas; cliente envio é
  ignorado pela Edge Function (privacy guard).
- Qualquer `X-AgeKey-Tenant-*` enviado pelo cliente — tenant é
  derivado do API key, nunca confiar em header de cliente.

### CORS

CORS é gerenciado **exclusivamente pelas Edge Functions**.
**Não** duplicar `Access-Control-Allow-Origin` no `vercel.json`:
duplicação causa header collision em alguns browsers (rejeitado por
Chrome/Edge com mensagem `multiple values`).

A Edge Function consulta `applications.allowed_origins` por API key
e responde com `Access-Control-Allow-Origin` específico do tenant.

### Latência esperada

| Camada | p50 (ms) | p99 (ms) |
|---|---|---|
| Vercel edge intercept + rewrite | ~10 | ~25 |
| Hop edge → Supabase region (us-east-1) | ~20 | ~55 |
| Edge Function execução | ~50 | ~300 |
| **Total proxy overhead** (Vercel apenas) | **~30** | **~80** |

Se latência crítica (<50ms p99), considerar caminho alternativo:
Cloudflare Workers em região colocada com Supabase. Mas para
99% das chamadas (createSession, tokenVerify) o proxy Vercel é
suficiente.

### Smoke test pós-deploy

Ver `security/pentest/manual-smoke-tests.md` grupo **H. API gateway
estável**.

### Versionamento de contrato

- Prefixo: `/v1/`
- Ruptura: exige `/v2/` paralelo + nota de deprecation no
  `docs/api/changelog.md` + ≥12 meses de coexistência.
- Mudança não-quebrante (campo opcional novo, header novo
  retrocompatível): permitida em `/v1/` sem bumping.
- O rewrite atual cobre `/v1/:path*`. Adicionar `/v2/` exigirá um
  segundo bloco de rewrite com novo `destination` apontando para
  outras Edge Functions (ou outro provider).

---

## Smoke test pós-deploy

1. Login carrega.
2. Dashboard carrega.
3. Policies listam.
4. JWKS responde (`https://api.agekey.com.br/v1/.well-known/jwks.json`).
5. Create session responde.
6. Token verify responde.
7. Headers de segurança presentes em `api.agekey.com.br/v1/*`
   (HSTS, X-Content-Type-Options, Referrer-Policy).
