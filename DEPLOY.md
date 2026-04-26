# Deploy AgeKey — passo a passo do zero ao ar

Guia operacional para subir todo o AgeKey (Supabase + Vercel + GitHub)
pela primeira vez. Escrito para alguém que está vendo o projeto pela
primeira vez. **Tempo total estimado: 30–60 minutos**, depende
principalmente do tempo do Supabase para responder.

> **Pré-requisitos:** macOS, Linux ou Windows com WSL2. Você precisa de
> 3 contas: GitHub (você já tem — `seusdados`), Supabase (org "eca digital"
> com projeto `tpdiccnmsnjtjwhardij` já criado) e Vercel.

---

## 0. Visão geral do que vamos fazer

```
┌─────────────────────────────────────────────────────────┐
│  PASSO 1 → Instalar CLIs (Supabase, Vercel, pnpm)      │
│  PASSO 2 → Mergear PR #2 no GitHub (← Eu posso fazer)  │
│  PASSO 3 → Aplicar tudo no Supabase staging            │
│  PASSO 4 → Subir o painel admin no Vercel              │
│  PASSO 5 → Configurar variáveis de ambiente            │
│  PASSO 6 → Smoke test end-to-end                       │
│  PASSO 7 → (Opcional) DNS personalizado                │
└─────────────────────────────────────────────────────────┘
```

Cada passo abaixo tem **comandos para copiar e colar**. Se algo falhar,
veja a seção [Troubleshooting](#troubleshooting) no final.

---

## PASSO 1 — Instalar CLIs

```bash
# 1.1) Node 20+ via nvm (se ainda não tem)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20

# 1.2) pnpm
npm install -g pnpm@9.14.4

# 1.3) Supabase CLI
# macOS: brew install supabase/tap/supabase
# Linux:
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
  | sudo tar -xz -C /usr/local/bin

# 1.4) Vercel CLI
npm install -g vercel@latest

# 1.5) Verificar instalação
node -v       # v20.x
pnpm -v       # 9.14.4
supabase -v   # 1.180.x ou superior
vercel -V     # 33+ ou superior
```

---

## PASSO 2 — Mergear PR #2 no GitHub

> ✅ **Esta etapa eu posso fazer por você se autorizar** — basta dizer
> "merge o PR #2" e eu executo via MCP do GitHub. Caso prefira manual:

1. Abra https://github.com/seusdados/ecadigital360-age-assurance/pull/2
2. Confira que CI está verde (os 4 checks)
3. Clique em **"Ready for review"** (sai do estado draft)
4. Clique em **"Merge pull request"** → confirme

Após merge, a branch `main` contém todo o backend (Fase 2) + esqueleto do
admin (Fase 3 slice 1).

---

## PASSO 3 — Aplicar tudo no Supabase staging

> Tudo isto roda em **um único script** (`supabase/scripts/setup-staging.sh`)
> que você executa uma única vez. Antes, prepare 2 valores:

### 3.1) Pegar seu Supabase Personal Access Token (PAT)

1. Abra https://supabase.com/dashboard/account/tokens
2. Clique em **"Generate new token"**, nome: `agekey-cli`, escopo: **all**
3. Copie o token (começa com `sbp_...`) — vai aparecer uma única vez

### 3.2) Habilitar extensões no Dashboard (uma vez)

1. Abra https://supabase.com/dashboard/project/tpdiccnmsnjtjwhardij/database/extensions
2. Procure e **habilite** (toggle ON) — uma de cada vez:
   - `pg_cron` (jobs agendados)
   - `pgsodium` (criptografia para o Vault)
   - `pg_net` (HTTP requests dentro do Postgres)
3. Aguarde 30s; recarregue para confirmar.

### 3.3) Gerar um CRON_SECRET aleatório

```bash
openssl rand -hex 32
# Copie o output — vai usar no próximo passo
```

### 3.4) Rodar o script de setup

```bash
cd <diretório onde clonou o repo>
git pull origin main

# Exporte as variáveis (substitua pelos valores reais):
export SUPABASE_ACCESS_TOKEN=sbp_...        # do passo 3.1
export AGEKEY_CRON_SECRET=<hex de 64 chars> # do passo 3.3

bash supabase/scripts/setup-staging.sh
```

O script faz, em ordem:
- `supabase link --project-ref tpdiccnmsnjtjwhardij`
- `supabase db push` (aplica migrations 000 → 014)
- aplica os 4 seeds (jurisdições, trust registry, policies, dev tenant)
- configura `app.cron_secret` e `app.functions_url` no Postgres
- `supabase secrets set` para `CRON_SECRET`, `AGEKEY_*`
- `supabase functions deploy` para todas as **21 Edge Functions**
- chama `key-rotation` uma vez para gerar a primeira chave de assinatura
- gera `apps/admin/types/database.ts` com tipos reais

**Output esperado no fim:**
```
✓ Supabase configurado em tpdiccnmsnjtjwhardij
✓ 21 Edge Functions deployadas
✓ Primeira crypto_key vault-backed criada
✓ Tipos do admin gerados em apps/admin/types/database.ts
```

### 3.5) Smoke test — verificar que o backend responde

```bash
export AK_BASE=https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1
export AK_API_KEY=ak_dev_sk_test_0123456789abcdef

# Cria uma sessão (deve retornar 201 com session_id e nonce)
curl -X POST "$AK_BASE/verifications-session-create" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"policy_slug":"dev-18-plus","client_capabilities":{"platform":"web"}}'

# JWKS público (deve retornar { "keys": [...] })
curl -s "$AK_BASE/jwks" | head -50
```

Se ambos retornaram JSON válido, **o backend está vivo**. ✅

---

## PASSO 4 — Subir o painel admin no Vercel

### 4.1) Login no Vercel CLI

```bash
vercel login
# Abre o browser para autenticar; volta com OK
```

### 4.2) Importar o projeto

```bash
cd <diretório do repo>
vercel link
# Responda:
# - "Set up?" → Yes
# - "Which scope?" → Sua conta ou time
# - "Link to existing project?" → No
# - "What's your project's name?" → agekey-admin
# - "In which directory is your code?" → ./   (pressione enter)
# - "Want to override the settings?" → No
```

### 4.3) Configurar variáveis de ambiente

Copie sua chave **anon** do Supabase: https://supabase.com/dashboard/project/tpdiccnmsnjtjwhardij/settings/api
(seção "Project API keys" → `anon public`)

```bash
# Públicas (vão para o bundle do navegador)
vercel env add NEXT_PUBLIC_APP_URL          production
# Cole: https://agekey.com.br      (ou a URL Vercel até o domínio próprio existir)

vercel env add NEXT_PUBLIC_SUPABASE_URL     production
# Cole: https://tpdiccnmsnjtjwhardij.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Cole: <a chave anon copiada acima>

vercel env add NEXT_PUBLIC_AGEKEY_API_BASE  production
# Cole: https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1

vercel env add NEXT_PUBLIC_AGEKEY_ISSUER    production
# Cole: https://staging.agekey.com.br

# Server-only (NUNCA vai para o bundle)
vercel env add AGEKEY_ADMIN_API_KEY         production
# Cole: ak_dev_sk_test_0123456789abcdef
# (em produção real, gere uma key nova via aplicações-rotate-key)

# Repita TUDO acima para o ambiente "preview" se quiser previews por PR.
```

### 4.4) Deploy de produção

```bash
vercel deploy --prod
# Aguarde build (1-2 min) e copie a URL final que aparece no console
# Ex.: https://agekey-admin.vercel.app
```

---

## PASSO 5 — Configurar Auth no Supabase para o domínio do painel

> Sem isto, o login pelo painel não vai funcionar (cookie domain).

1. Abra https://supabase.com/dashboard/project/tpdiccnmsnjtjwhardij/auth/url-configuration
2. Em **Site URL** ponha a URL do Vercel do passo 4.4 (ex.:
   `https://agekey-admin.vercel.app`)
3. Em **Redirect URLs** adicione:
   - `https://agekey-admin.vercel.app/callback`
   - `http://localhost:3000/callback` (para dev local)
4. Salvar.

---

## PASSO 6 — Smoke test end-to-end

1. Abra a URL do Vercel no browser → redireciona para `/login`
2. **Crie sua conta** (Sign up) — Supabase Auth aceita sem confirmação
   por email em ambiente novo (a menos que você tenha configurado
   confirmação obrigatória)
3. Após login, você cai em `/onboarding` (porque ainda não tem tenant)
   - **Funcionalidade `/onboarding` está pendente em Slice 2 da Fase 3** —
     por enquanto, use o tenant `dev` já seedado: copie o `tenant_id` via
     SQL Editor do Supabase: `SELECT id FROM tenants WHERE slug='dev';`
   - E adicione você mesmo: `INSERT INTO tenant_users (tenant_id, user_id, role)
     VALUES ('<tenant_id>', '<seu auth.users.id>', 'owner');`
4. Recarregue → cai no `/dashboard`. Vai ver os KPIs (zerados — normal).
5. Navegue para `/policies` → vê 7 templates globais + 3 do tenant dev.
6. Navegue para `/issuers` → vê 5 issuers globais.

Se 1–6 funcionou, **o sistema está no ar e operacional para testes**. ✅

---

## PASSO 7 — DNS personalizado (opcional, antes do GA)

> Pode pular agora; faça antes do go-live.

### 7.1) No registro.br
- Registre `agekey.com.br` (a partir de R$ 40/ano)
- Após pagamento, libera DNS

### 7.2) No Vercel
1. Abra Project → **Settings** → **Domains**
2. Adicione: `app.agekey.com.br` (painel) e `staging.agekey.com.br`
3. Vercel mostra os registros DNS necessários (CNAME para `cname.vercel-dns.com`)

### 7.3) No registro.br → Editar DNS
- `app` CNAME `cname.vercel-dns.com.`
- `staging` CNAME `cname.vercel-dns.com.`
- (E mais tarde, quando criar widget host, docs, etc.)

### 7.4) Atualizar URL no Supabase Auth (passo 5) e nos env vars do Vercel

---

## Troubleshooting

### `supabase db push` falha com "extension pg_cron not available"
→ Volte ao passo 3.2 e habilite `pg_cron` no Dashboard, depois retente.

### `supabase functions deploy` falha com "Invalid JWT"
→ O PAT expirou ou é de outra org. Gere um novo no passo 3.1 e re-exporte
`SUPABASE_ACCESS_TOKEN`.

### Painel mostra "Application error" após login
→ Provavelmente faltou env var no Vercel. Veja os logs em
`vercel logs <deployment-url>` ou no dashboard Vercel.

### Login bem sucedido mas redireciona infinitamente para /login
→ O Supabase Auth não tem o domínio do Vercel cadastrado. Volte ao passo 5.

### Curl no smoke test (passo 3.5) retorna `INVALID_REQUEST`
→ A api_key do dev tenant não foi seedada. Verifique:
```sql
SELECT slug, api_key_prefix FROM applications WHERE slug='dev-app';
-- Deve retornar 1 linha com prefix 'ak_dev_sk_test_'
```
Se vazio, refaça o seed `04_dev_tenant.sql` no SQL Editor.

---

## Onde estão os artefatos depois do deploy

| Coisa | URL |
|---|---|
| Painel admin (Vercel) | `https://agekey-admin.vercel.app` (ou domínio próprio) |
| API base (Edge Functions) | `https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1` |
| JWKS público | `.../functions/v1/jwks` |
| Dashboard Supabase | https://supabase.com/dashboard/project/tpdiccnmsnjtjwhardij |
| Dashboard Vercel | https://vercel.com/<seu-time>/agekey-admin |
| Repo + PRs | https://github.com/seusdados/ecadigital360-age-assurance |

---

## Próximos passos (depois que estiver no ar)

1. Construir as próximas slices da Fase 3 (form de policy, listagem real
   de verificações, onboarding, etc.). Veja `docs/PLATFORM_DEVELOPMENT_PLAN.md`
   §3.1 para a lista completa.
2. Implementar o widget e o SDK JS (M8).
3. SDKs nativos iOS/Android (M9, M10).
4. Pentest externo antes do GA (M12).
5. Configurar billing (Asaas + Mercado Pago) — Fase 4 do plano.
