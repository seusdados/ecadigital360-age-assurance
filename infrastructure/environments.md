# Ambientes — AgeKey

Runbook canônico de ambientes do AgeKey. Cobre **provisionamento**, **sync de migrations**, **seed**, **cron retention**, **secrets**, **promote**, **rollback/DR** e o **mapa de fronteira** entre cada ambiente.

> Este documento é a fonte de verdade para AK-P0-01 (Separar projetos Supabase staging e production). Mudanças nele exigem revisão de tech-lead + DPO quando afetam manuseio de dados pessoais.

---

## Visão geral

| Ambiente | Uso | Project Supabase | Domínio | Vercel scope |
|---|---|---|---|---|
| **Local** | desenvolvimento | `supabase start` (Docker) | `127.0.0.1:54321` / `127.0.0.1:3000` | Development |
| **Staging** | demos, validação, smoke | `AgeKey-hml` (id `wljedzqgprkpqhuazdzv`, sa-east-1, plano Pro) | `staging.agekey.com.br` | Preview / dedicado |
| **Production** | clientes reais | `AgeKey-prod` (id `tpdiccnmsnjtjwhardij`, sa-east-1, plano Pro+) | `agekey.com.br`, `app.`, `api.`, `verify.`, `docs.` | Production |

**Nunca** misturar dados entre ambientes — service-role keys, JWT secrets, project_refs e DNS são distintos. Cross-environment seed (`04_dev_tenant.sql`) é proibido fora de Local.

---

## Local

Uso: desenvolvimento.

Recursos:

- Supabase local via Docker (`supabase start`)
- Next.js local (`pnpm --filter @agekey/admin dev`)
- Seed dev completo (`01_jurisdictions.sql` … `04_dev_tenant.sql`)
- Chaves mock/dev (publicadas em `supabase/seed/04_dev_tenant.sql`)

Setup:

```bash
./supabase/scripts/dev-bootstrap.sh
pnpm install
pnpm --filter @agekey/admin dev
```

---

## Staging

Uso: demos, validação pré-prod, smoke tests do `security/pentest/manual-smoke-tests.md`.

### Provisionamento

| Atributo | Valor |
|---|---|
| Naming canônico | `AgeKey-hml` (project ref `wljedzqgprkpqhuazdzv`) |
| Região | `sa-east-1` (São Paulo) |
| Plano Supabase | Pro (necessário para PITR + cron HTTP fora de janelas curtas) |
| Domínio | `staging.agekey.com.br`, `staging.api.agekey.com.br` |
| Vercel scope | `Preview` (com env-var override quando precisar de uma branch staging dedicada) |
| Owner | Tech Lead |
| Aprovação para criar | Tech Lead + Product Lead |

Onde guardar `project_ref` e `project_url`:

- `Vercel Project › Settings › Environment Variables › Preview`:
  - `NEXT_PUBLIC_SUPABASE_URL=https://wljedzqgprkpqhuazdzv.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-staging>`
  - `NEXT_PUBLIC_AGEKEY_API_BASE=https://staging.api.agekey.com.br/v1`
  - `NEXT_PUBLIC_AGEKEY_ISSUER=https://staging.agekey.com.br`
- `GitHub Actions secrets`:
  - `SUPABASE_DB_URL_STAGING`
  - `SUPABASE_PROJECT_REF_STAGING`
  - `SUPABASE_ACCESS_TOKEN` (PAT da org)

### Recursos

- Projeto Supabase staging dedicado (separado de produção)
- Vercel preview / dedicated build staging
- API keys de teste (não são produtivas)
- Providers em modo sandbox
- Cron `retention-job` ativo (mesma cadência de prod, mas com `retention_days` por tenant)
- Logs com 14 dias de retenção

---

## Production

Uso: clientes reais. Mudanças destrutivas exigem janela de manutenção comunicada.

### Provisionamento

| Atributo | Valor |
|---|---|
| Naming canônico | `AgeKey-prod` (project ref `tpdiccnmsnjtjwhardij`) |
| Região | `sa-east-1` (São Paulo) |
| Plano Supabase | Pro+ (PITR estendido, banda dedicada) |
| Domínio | `agekey.com.br`, `app.`, `api.`, `verify.`, `docs.`, `status.` |
| Vercel scope | `Production` |
| Owner | Tech Lead + DPO assinam o termo de provisionamento |
| Aprovação para criar | Tech Lead + DPO + CFO (budget) |

Onde guardar `project_ref` e `project_url`:

- `Vercel Project › Settings › Environment Variables › Production`:
  - `NEXT_PUBLIC_SUPABASE_URL=https://tpdiccnmsnjtjwhardij.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-prod>`
  - `NEXT_PUBLIC_AGEKEY_API_BASE=https://api.agekey.com.br/v1`
  - `NEXT_PUBLIC_AGEKEY_ISSUER=https://agekey.com.br`
- `GitHub Actions secrets`:
  - `SUPABASE_DB_URL_PROD`
  - `SUPABASE_PROJECT_REF_PROD`

### Regras

- Sem seed dev (NUNCA aplicar `04_dev_tenant.sql` em prod)
- Logs e retention configurados (cron `retention-job` ativo)
- Pentest concluído antes de GA (ver `security/pentest/scope.md` + `remediation-tracker.md`)
- Migrations destrutivas exigem flag `--confirm-destructive` no `migrate.sh` + janela de manutenção
- Backup PITR: 30 dias mínimo
- Acesso via console Supabase: somente `Tech Lead` e `DBA on-call`

---

## Sync de migrations

Pipeline canônico:

```
PR mergeado em main
  └── CI / branch protection
        └── manual: ./supabase/scripts/migrate.sh --env staging
              └── smoke (manual-smoke-tests.md)
                    └── manual: ./supabase/scripts/migrate.sh --env prod  (com confirmação interativa)
```

### Script `supabase/scripts/migrate.sh`

Aceita `--env staging|prod`, valida `SUPABASE_DB_URL_<ENV>`, roda `supabase db push` e reporta migrations aplicadas. Detecta padrões destrutivos (`DROP TABLE/COLUMN`, `TRUNCATE`, `DELETE FROM <tbl>;`, `ALTER TABLE … DROP`) e bloqueia execução sem `--confirm-destructive`. Em `--env prod` exige confirmação interativa digitando `PROD`.

```bash
# Dry-run (lista migrations pendentes, não aplica)
./supabase/scripts/migrate.sh --env staging --dry-run

# Aplicar em staging
./supabase/scripts/migrate.sh --env staging

# Aplicar em prod (interativo)
./supabase/scripts/migrate.sh --env prod

# Migration destrutiva já aprovada — staging
./supabase/scripts/migrate.sh --env staging --confirm-destructive
```

Variáveis de ambiente esperadas:

```bash
export SUPABASE_ACCESS_TOKEN=<PAT da org>
export SUPABASE_DB_URL_STAGING="postgres://postgres:<pwd>@db.wljedzqgprkpqhuazdzv.supabase.co:5432/postgres"
export SUPABASE_DB_URL_PROD="postgres://postgres:<pwd>@db.tpdiccnmsnjtjwhardij.supabase.co:5432/postgres"
export SUPABASE_PROJECT_REF_STAGING=wljedzqgprkpqhuazdzv
export SUPABASE_PROJECT_REF_PROD=tpdiccnmsnjtjwhardij
```

### Política de migrations destrutivas

DROP/TRUNCATE/DELETE não-idempotentes exigem:

1. Code review humano explícito (label `migration-destructive` no PR)
2. Snapshot/PITR atualizado (≤ 1h antes da execução)
3. Janela de manutenção comunicada (clientes notificados ≥ 48h antes; status page atualizada)
4. `--confirm-destructive` na chamada do `migrate.sh`
5. Plano de rollback documentado no PR

---

## Seed

| Arquivo | Local | Staging | Production |
|---|---|---|---|
| `01_jurisdictions.sql` | ✓ | ✓ | ✓ |
| `02_trust_registry.sql` | ✓ | ✓ | ✓ |
| `03_policies_default.sql` | ✓ | ✓ | ✓ |
| `04_dev_tenant.sql` | ✓ | ✗ | ✗ |

Em **staging** os seeds 01–03 podem rodar via psql na primeira instalação:

```bash
psql "$SUPABASE_DB_URL_STAGING" \
  -v ON_ERROR_STOP=1 \
  -f supabase/seed/01_jurisdictions.sql \
  -f supabase/seed/02_trust_registry.sql \
  -f supabase/seed/03_policies_default.sql
```

Em **produção** o bootstrap é uma sequência controlada — não há Edge Function "seed bootstrap" e nunca aplicamos `04_dev_tenant.sql`. Os seeds estruturais 01–03 são idempotentes (todos têm `ON CONFLICT DO NOTHING`) e podem rodar via psql sob a service-role connection com janela de manutenção. Procedimento:

1. Aplicar migrations:
   ```bash
   ./supabase/scripts/migrate.sh --env prod
   ```
2. Configurar GUCs (`app.functions_url`, `app.cron_secret`) — ver seção Cron retention.
3. Aplicar seeds estruturais (somente 01–03; **NÃO** aplicar 04):
   ```bash
   psql "$SUPABASE_DB_URL_PROD" \
     -v ON_ERROR_STOP=1 \
     -f supabase/seed/01_jurisdictions.sql \
     -f supabase/seed/02_trust_registry.sql \
     -f supabase/seed/03_policies_default.sql
   ```
   Os arquivos populam apenas `jurisdictions`, `issuers` globais (`tenant_id IS NULL`) e `policies` template (`is_template = true`) — nada relativo a tenant real.
4. Disparar key-rotation uma vez para popular `crypto_keys` com uma chave ativa antes do primeiro token ser emitido:
   ```bash
   curl -X POST https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/key-rotation \
     -H "Authorization: Bearer $CRON_SECRET_PROD"
   ```
5. Validar JWKS público:
   ```bash
   curl -fsS https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/jwks | jq '.keys | length'
   # esperado: >= 1
   ```
6. Criar o primeiro tenant + owner via Edge Function `tenant-bootstrap`. Essa função é a única forma legítima de criar tenant em prod (RLS bloqueia INSERT direto por usuário, e o trigger de auditoria espera contexto). Chamada autenticada pelo `AGEKEY_ADMIN_API_KEY` (server-only):
   ```bash
   curl -X POST https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1/tenant-bootstrap \
     -H "X-AgeKey-Admin-Key: $AGEKEY_ADMIN_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "tenant": { "name": "Cliente X", "slug": "cliente-x", "plan": "pro" },
       "owner": { "email": "owner@cliente-x.com" }
     }'
   ```
   Resposta inclui o `tenant_id`, o convite do owner e (uma única vez) a primeira `application` + raw API key. Guardar e rotacionar pelo painel quando o owner aceitar o convite.
7. A partir desse ponto, o painel admin (`app.agekey.com.br`) cobre criação de novas applications, policies tenant-específicas (clones dos templates de 03) e issuers via `applications-write`, `policies-write` e `issuers-register`.

---

## Cron retention (em ambos os ambientes)

`pg_cron` schedules vêm da migration `010_edge_support.sql`:

| Job | Cadência | Edge Function | Descrição |
|---|---|---|---|
| `key-rotation-daily` | `0 3 * * *` UTC | `key-rotation` | Rotaciona chaves de assinatura ES256 |
| `webhooks-worker-tick` | `* * * * *` (1min) | `webhooks-worker` | Drena fila de webhooks |
| `retention-job-daily` | `0 4 * * *` UTC | `retention-job` | Apaga sessões expiradas, audit/billing antigos |
| `trust-registry-refresh-6h` | `0 */6 * * *` UTC | `trust-registry-refresh` | Atualiza JWKS dos issuers |

GUCs obrigatórios por ambiente (sem isso o cron tenta `current_setting()` em string vazia e falha silenciosamente):

```sql
-- Em STAGING (via SQL Editor com role postgres):
ALTER DATABASE postgres SET app.functions_url = 'https://wljedzqgprkpqhuazdzv.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.cron_secret = '<staging-cron-secret>';

-- Em PRODUCTION (via SQL Editor com role postgres):
ALTER DATABASE postgres SET app.functions_url = 'https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.cron_secret = '<prod-cron-secret>';
```

### Rotação do `cron_secret`

1. Gerar novo secret: `openssl rand -hex 32`
2. Atualizar `CRON_SECRET` em Supabase Edge Functions (`supabase secrets set CRON_SECRET=... --project-ref <ref>`)
3. Atualizar GUC `app.cron_secret` no DB (statement acima)
4. Validar próximo tick com `SELECT * FROM cron.job;` + log da Edge Function correspondente

### Health check

```sql
-- Lista todos os 4 jobs em cada ambiente:
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Resultado esperado:
--  jobname                   |  schedule       | active
-- ---------------------------+-----------------+--------
--  key-rotation-daily        | 0 3 * * *       | t
--  retention-job-daily       | 0 4 * * *       | t
--  trust-registry-refresh-6h | 0 */6 * * *     | t
--  webhooks-worker-tick      | * * * * *       | t
```

---

## Secrets por ambiente

Matriz completa em `infrastructure/secrets.md` § "Matrix Vercel envs". Resumo aqui:

| Variável | Staging | Production |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | staging URL | prod URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon | prod anon |
| `NEXT_PUBLIC_AGEKEY_API_BASE` | `https://staging.api.agekey.com.br/v1` | `https://api.agekey.com.br/v1` |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service-role | prod service-role |
| `SUPABASE_JWT_SECRET` | staging | prod |
| `CRON_SECRET` | staging | prod |
| `WEBHOOK_SIGNING_SECRET_DEFAULT` | staging | prod |
| `AGEKEY_ADMIN_API_KEY` | staging | prod |
| `GATEWAY_<provider>_API_KEY` | sandbox | live |

**Onde ficam:**

- `NEXT_PUBLIC_*` → `Vercel Project › Settings › Environment Variables` (scope correto)
- Server-only (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, etc.) → `Supabase Edge Functions secrets` (`supabase secrets set --project-ref <ref>`)
- CI / migrações → `GitHub Actions secrets`

**Política de rotação:** anual obrigatória; imediata se detectado vazamento (ver `compliance/incident-response-playbook.md` Runbook B). Service-role rotation interrompe Edge Functions por ~30s; agendar fora do horário de pico.

---

## Promote staging → production

Checklist a cada release:

1. Tag git: `git tag -a release/YYYY-MM-DD -m "..." && git push origin release/YYYY-MM-DD`
2. Smoke tests de `security/pentest/manual-smoke-tests.md` executados contra staging — todos PASS
3. Migrations aplicadas em prod (`./supabase/scripts/migrate.sh --env prod`)
4. Edge Functions deployadas:
   ```bash
   supabase functions deploy --project-ref $SUPABASE_PROJECT_REF_PROD
   ```
5. JWKS válido em produção:
   ```bash
   curl -fsS https://api.agekey.com.br/v1/.well-known/jwks.json | jq '.keys | length'
   ```
6. Cron jobs ativos:
   ```sql
   SELECT count(*) FROM cron.job WHERE active = true;  -- esperado: 4
   ```
7. Vercel deploy de produção promovido (auto após merge em main, ou manual via `vercel --prod`)
8. Status page atualizado (`status.agekey.com.br`) — release notes
9. Comunicação interna: changelog publicado, on-call ciente

---

## Rollback / DR

### Rollback de Edge Function

```bash
# Listar deploys
supabase functions list --project-ref $SUPABASE_PROJECT_REF_PROD

# Redeploy de versão anterior via git tag:
git checkout release/<previous>
supabase functions deploy <function-name> --project-ref $SUPABASE_PROJECT_REF_PROD
```

### Rollback de migration

Não há "rollback automático" no Supabase. Procedimento:

1. PITR: Supabase Dashboard › Database › Backups › Point-in-Time Recovery (Pro+ feature)
2. Janela: ≤ 30 dias para Pro+, ≤ 7 dias para Pro
3. RPO: 5 minutos (PITR Supabase)
4. RTO esperado: 15-30 minutos para snapshot pequeno; > 1h para DB grande

### Snapshot manual antes de migration crítica

```bash
# Antes de aplicar migration destrutiva em prod:
supabase db dump --db-url "$SUPABASE_DB_URL_PROD" -f snapshot-pre-migration-$(date -u +%Y%m%dT%H%M%S).sql
# Storage: bucket S3 dedicado a backups (NÃO no repositório)
```

### Comunicação durante incidente

Ver `compliance/incident-response-playbook.md`:
- SEV-1: notificar clientes ≤ 2h, ANPD ≤ 48h se houver dados pessoais expostos
- Status page atualizada a cada 30min durante incidente ativo

---

## Diagrama de fronteira

```
┌──────────── CLIENTES ────────────┐
│  app.agekey.com.br (painel)      │
│  api.agekey.com.br (gateway)     │
│  *.cliente.com (widget embed)    │
└──────────────┬───────────────────┘
               │ HTTPS / TLS 1.3
               ▼
        ┌──────────────┐
        │  Vercel      │  ← rewrite /v1/* → Supabase Functions
        │  Edge        │  ← scope Production env vars
        └──────┬───────┘
               │
               ▼
        ┌────────────────────────┐
        │  Supabase AgeKey-prod  │  ← service-role + RLS authenticated
        │  - Edge Functions      │  ← cron jobs + JWKS público
        │  - Postgres + RLS      │  ← migrations 000..016
        │  - Storage privado     │  ← bucket proof-artifacts (RLS)
        │  - Vault (pgsodium)    │  ← chaves privadas (kid + JWK)
        └────────────────────────┘

(staging mirror estrutural; sem dados de produção)
```

---

## Cross-links

- `infrastructure/secrets.md` — matriz canônica de env vars por scope (AK-P0-07)
- `infrastructure/dns/agekey-dns-plan.md` — plano DNS + proxy `api.agekey.com.br` (AK-P0-02, AK-P0-03)
- `infrastructure/vercel-deploy.md` — pipeline de deploy + auditoria de envs
- `infrastructure/supabase-hardening.md` — endurecimento operacional do Supabase
- `infrastructure/go-live-checklist.md` — gate de release
- `compliance/incident-response-playbook.md` — runbooks de SEV (AK-P0-09)
- `security/pentest/scope.md` — escopo do pentest pré-GA (AK-P0-10)
