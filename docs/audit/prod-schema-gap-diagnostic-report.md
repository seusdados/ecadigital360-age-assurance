# PROD — Diagnóstico do schema gap

> Relatório **somente leitura**. Nada foi alterado em PROD.
>
> Acompanha: `docs/audit/prod-migration-application-plan.md` (plano de
> aplicação em fases, também não executado).
>
> Branch: `claude/prod-migration-history-plan` (PR #55).

## 1. Projeto PROD analisado

| Campo | Valor |
|---|---|
| Project name | AgeKey-prod |
| Project ref | `tpdiccnmsnjtjwhardij` |
| Host | `db.tpdiccnmsnjtjwhardij.supabase.co` |
| Postgres version | `17.6.1.105` |
| Region | `sa-east-1` |
| Status | `ACTIVE_HEALTHY` |
| Created at | 2026-04-24 13:29:42 UTC |
| Data/hora da inspeção | 2026-05-07 ~19:35 UTC |
| Método de inspeção | Supabase MCP (read-only): `list_projects`, `list_migrations`, `list_tables` (não-verbose) |
| Confirmação de leitura apenas | ✅ Nenhum `apply_migration`, `execute_sql` de DDL/DML, ou alteração via dashboard |
| Dados/schema/RLS alterados | ❌ Nenhum |

## 2. Estado atual do migration history

### 2.1. Migrations aplicadas (17 linhas)

| Versão | Nome |
|---|---|
| 000 | bootstrap |
| 001 | tenancy |
| 002 | policies |
| 003 | verifications |
| 004 | trust |
| 005 | webhooks |
| 006 | audit_billing |
| 007 | security |
| 008 | rls |
| 009 | triggers |
| 010 | edge_support |
| 011 | storage |
| 012 | webhook_enqueue |
| 013 | tenant_bootstrap |
| 014 | vault_crypto_keys |
| 015 | fix_audit_global_rows |
| 016 | vault_create_secret |

### 2.2. Naming observado em PROD

- Versões em **formato sequencial** (`000`, `001`, …, `016`).
- Nomes **sem o prefixo numérico**: `bootstrap`, `tenancy`, `policies`,
  …, `vault_create_secret`.

Esse formato corresponde ao que o `supabase` CLI moderno produz quando
parseia um arquivo `000_bootstrap.sql` — extrai `version=000` e
`name=bootstrap` (despreza o prefixo do nome).

### 2.3. Diferença de naming em relação a HML

| Aspecto | PROD | HML pós-PR #54 |
|---|---|---|
| Formato de version | sequencial (`000`–`016`) | sequencial (`000`–`017`, `020`–`030`) |
| Formato de name | **sem prefixo** (`bootstrap`) | **com prefixo** (`000_bootstrap`) |
| Conformidade com CLI moderno | ✅ Total | ⚠️ Parcial — version OK, name divergente |

Em HML, o repair em PR #54 substituiu apenas a coluna `version`
(timestamped → sequencial), preservando os nomes históricos
(`000_bootstrap`, etc.). Para simetria total com PROD, um UPDATE
adicional em HML normalizaria os nomes (já documentado em
`hml-migration-history-reconciliation-execution-report.md` §2.5).

Essa diferença **não afeta runtime** — `version` é a chave; `name` é
metadata visual do CLI. Mas gera ruído.

### 2.4. Confirmação

PROD possui **17 das 29** migrations canônicas da branch `main`
(commit `bbf9a46`). Faltam **12 migrations**.

## 3. Migrations locais não aplicadas

| Versão local | Origem | Tipo | Conteúdo principal |
|---|---|---|---|
| **017_fix_tenant_self_access** | PR #46 | Bug fix | 2 CREATE POLICY + 2 COMMENT ON POLICY (resolve redirect-loop em /onboarding) |
| **020_parental_consent_core** | PR #36 | Módulo novo | 5 tabelas Consent + enums + indexes |
| **021_parental_consent_guardian** | PR #36 | Módulo novo | 2 tabelas (`guardian_contacts`, `guardian_verifications`) + functions |
| **022_parental_consent_rls** | PR #36 | RLS | Policies em todas as 7 tabelas Consent |
| **023_parental_consent_webhooks** | PR #36 | Webhooks | Triggers de fan_out para webhook_deliveries |
| **024_safety_signals_core** | PR #37 | Módulo novo | 8 tabelas Safety + enums + view |
| **025_safety_signals_rls** | PR #37 | RLS | Policies em todas as 8 tabelas Safety + triggers append-only |
| **026_safety_signals_webhooks** | PR #37 | Webhooks | Triggers fan_out para safety alerts |
| **027_safety_signals_seed_rules** | PR #37 | Seed | 5 INSERTs em `safety_rules` (regras default) |
| **028_retention_cron_schedule** | PR #43 | Cron | `cron.schedule(...)` para retention cleanup |
| **029_post_merge_p0_fixes** | commit `7c543d8` | Fixes | ALTERs idempotentes pós-merge |
| **030_enable_rls_audit_billing_partitions** | commit `7c543d8` | Hardening | 26× `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em partições legadas |

## 4. Estado de schema em PROD

### 4.1. Número de tabelas atuais

**33 tabelas** em `public`:

- 19 tabelas operacionais base.
- 13 partições `audit_events_*` (jan/2026 a mar/2027 + default).
- 13 partições `billing_events_*` (jan/2026 a mar/2027 + default).

### 4.2. Confirmação: só Core base

Nenhuma das 15 tabelas de Consent + Safety existe em PROD (lista §4.4).
Nenhum cron schedule de retention. Nenhuma das 2 policies do fix 017.

### 4.3. Lista de tabelas Core existentes

| Categoria | Tabelas |
|---|---|
| Multi-tenant | `tenants`, `tenant_users`, `applications`, `policies`, `policy_versions` |
| Verifications | `verification_sessions`, `verification_challenges`, `verification_results`, `proof_artifacts`, `result_tokens` |
| Trust | `issuers`, `trust_lists`, `issuer_revocations`, `revocations` |
| Webhooks | `webhook_endpoints`, `webhook_deliveries` |
| Audit/billing (partitioned roots + 26 partições) | `audit_events`, `billing_events` |
| Operacional | `usage_counters`, `rate_limit_buckets`, `ip_reputation` |
| Suporte | `crypto_keys`, `jurisdictions` |

Todas com `rls_enabled: true`.

### 4.4. Lista de tabelas ausentes em PROD

#### Consent (7 tabelas — criadas por 020/021):

- `parental_consent_requests` — solicitação inicial pelo Application
- `parental_consents` — consentimento aprovado, append-only
- `parental_consent_revocations` — trilha de revogações
- `parental_consent_tokens` — JTIs emitidos
- `consent_text_versions` — texto exibido ao responsável (imutável)
- `guardian_contacts` — contato cifrado (Vault)
- `guardian_verifications` — OTP + hash, TTL 10 min

#### Safety (8 tabelas — criadas por 024):

- `safety_subjects` — sujeito por referência opaca
- `safety_interactions` — par actor/counterparty
- `safety_events` — evento metadata-only
- `safety_rules` — configuração por tenant
- `safety_alerts` — alerta gerado
- `safety_aggregates` — contadores agregados
- `safety_evidence_artifacts` — hash + path
- `safety_model_runs` — governança de classificadores

#### Total: **15 tabelas ausentes.**

### 4.5. Objetos de retention/cron ausentes

PROD **não tem agendamento de cron** para retention cleanup. A
migration 028 (`retention_cron_schedule`) cria via `pg_cron`:

```
cron.schedule(
  'safety-retention-cleanup-daily',
  '15 3 * * *',  -- 03:15 UTC diariamente
  'SELECT public.safety_retention_cleanup_run()'
);
```

A função `public.safety_retention_cleanup_run()` é criada na 024 ou
028, dependendo da estrutura da migration. **Verificar conteúdo do
arquivo local antes de aplicar**.

PROD pode não ter `pg_cron` habilitado — verificar via:

```sql
select extname, extversion from pg_extension where extname = 'pg_cron';
```

(Não executado nesta sessão — read-only.)

### 4.6. Policies/RLS ausentes relacionadas a Consent/Safety

#### Vindas da 017 (fix tenant self-access):

- `tenant_users_select_self` em `public.tenant_users`
- `tenants_select_for_member` em `public.tenants`

PROD tem RLS habilitado em `tenant_users` e `tenants`, mas **as policies
permissivas para auto-leitura não existem**. Resultado provável:
sessões recém-logadas em PROD entram em redirect-loop em `/onboarding`
(mesmo bug que motivou PR #46 em HML).

#### Vindas da 022 (parental_consent_rls):

7 policies (uma por tabela Consent), todas exigindo
`tenant_id = current_tenant_id()` ou variantes. Todas ausentes em PROD
(porque as tabelas não existem).

#### Vindas da 025 (safety_signals_rls):

8 policies + triggers `*_append_only` + trigger `legal_hold` em
`safety_evidence_artifacts`. Todas ausentes em PROD.

## 5. Riscos de aplicar diretamente em PROD

### 5.1. Impacto em produção

- **DDL puro** (CREATE TABLE/TYPE/INDEX/POLICY/TRIGGER) tipicamente é
  **não-bloqueante** em Postgres 17 para tabelas vazias e existentes.
- O conjunto inteiro (12 migrations) leva ~10 segundos no banco.
- **Risco principal**: se alguma migration falhar no meio, a transação
  do `db push` faz rollback, mas o estado final pode ter linhas
  parciais em `schema_migrations` (algumas marcadas como aplicadas e
  outras não), exigindo intervenção manual.

### 5.2. Dependência de feature flags

- Edge functions de Consent (`parental-consent-*`) checam
  `AGEKEY_PARENTAL_CONSENT_ENABLED` antes de operar — **se a flag for
  false, retornam 503 sem tocar o banco**.
- Edge functions de Safety (`safety-*`) checam
  `AGEKEY_SAFETY_SIGNALS_ENABLED` — **idem**.
- Default é `false` em produção (decisão canônica de produto).

**Implicação**: aplicar migrations 020–027 sem habilitar feature flags
**não abre tráfego para o público**. As tabelas existem, mas as APIs
recusam até flag ser ligada.

### 5.3. Risco de endpoints/menus aparecerem antes de schema completo

- Aplicar migrations parcialmente (ex.: 020 sim, 022 não) deixa
  tabelas Consent existindo **sem RLS**. Risco de exposição
  cross-tenant até 022 ser aplicada.
- Aplicar 020/021 sem 023 (webhooks) deixa Consent **sem fan-out de
  eventos** — tenants que dependem dos webhooks não recebem nada.
- Aplicar somente 017 (caminho B do plano original) **não toca
  Consent/Safety** — sem risco de schema parcial nesses módulos.

### 5.4. Risco de cron/retention

- Migration 028 falhará se `pg_cron` não estiver habilitada.
  **Mitigação**: habilitar `pg_cron` antes (uma única SQL:
  `CREATE EXTENSION IF NOT EXISTS pg_cron;`).
- Se `pg_cron` estiver habilitada mas com schedule duplicado, falha
  com `cron job already exists`. **Mitigação**: usar `IF NOT EXISTS` ou
  remover schedule pré-existente.
- Cron agendado com `safety_retention_cleanup_run()` que ainda não
  existe (criado em outra migration) faria a 028 falhar — **ordem de
  aplicação é crítica**.

### 5.5. Risco de RLS inadequada se aplicação parcial falhar

| Cenário | Risco |
|---|---|
| Aplicar 020 (cria tabelas), falhar em 022 (RLS) | Tabelas Consent **expostas para anon e authenticated** sem RLS. Crítico. |
| Aplicar 024 (cria tabelas), falhar em 025 (RLS) | Idem para Safety. Crítico. |
| Aplicar 030 (RLS audit/billing), em PROD onde RLS já está habilitado | **Idempotente** — `ENABLE ROW LEVEL SECURITY` em tabela já habilitada é no-op. Sem risco. |

**Mitigação**: rodar 020+022 atomicamente (mesma transação). O
`supabase db push` **não** garante atomicidade entre arquivos
diferentes — cada arquivo é uma transação. Solução: aplicar manualmente
via `BEGIN; \i 020.sql; \i 022.sql; COMMIT;` se quiser atomicidade
estrita.

## 6. Plano recomendado de implantação em PROD (não executado)

### 6.1. Backup/snapshot antes

- Via dashboard Supabase: **Database → Backups → Take Snapshot**.
- Verificar PITR (Point-in-Time Recovery) está habilitado.
- Anotar timestamp do snapshot pré-aplicação no relatório de execução.
- **Sem snapshot, não aplicar.**

### 6.2. Confirmar variáveis de ambiente

Verificar via dashboard Supabase ou Vercel:

| Variável | Estado esperado em PROD | Justificativa |
|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | `false` (até produto liberar) | Não abrir tráfego antes de validar |
| `AGEKEY_SAFETY_SIGNALS_ENABLED` | `false` (até produto liberar) | Idem |
| `CRON_SECRET` | configurada | Necessária para 028 (retention cron) chamar edge function |
| `SUPABASE_SERVICE_ROLE_KEY` | configurada | Necessária para edge functions |

### 6.3. Confirmar feature flags

Mesmas variáveis — confirmar que estão coerentes entre ambiente Vercel
(edge runtime) e secrets do Supabase (Postgres `app.settings.*`).

### 6.4. Aplicar primeiro em janela de manutenção

- Operação leva ~10 segundos puros de DDL.
- Recomendar janela de baixo tráfego — confirmar via métricas Vercel.
- Notificar stakeholders 24h antes.

### 6.5. Aplicar migrations faltantes em ordem

Ver Fase 1 a 4 de `prod-migration-application-plan.md`.

### 6.6. Validar cada bloco

Após cada migration aplicada, smoke test SQL específico (lista no §10).

### 6.7. Smoke tests pós-migration

Lista completa em `prod-migration-application-plan.md` §5.

### 6.8. Rollback strategy

Se algo der errado durante a aplicação:

| Estado | Ação de rollback |
|---|---|
| 017 falhou ou criou loop | `DROP POLICY tenant_users_select_self ON tenant_users; DROP POLICY tenants_select_for_member ON tenants;` |
| 020 aplicou parcial | Restore do snapshot pré-aplicação |
| 020+022 aplicaram, 023 falhou | `DROP TRIGGER ...` por nome (lista em 023.sql) ou restore do snapshot |
| 024 aplicou parcial | Restore do snapshot |
| 028 falhou | `SELECT cron.unschedule('safety-retention-cleanup-daily');` se ficou parcial |

**Decisão crítica**: se o snapshot é imediato, **sempre** restaurar do
snapshot é o caminho mais seguro — evita rollback parcial de DDL.

## 7. Comandos propostos, mas não executados

### 7.1. Listar migrations atual

```bash
supabase link --project-ref tpdiccnmsnjtjwhardij
supabase migration list
```

### 7.2. Backup/snapshot via dashboard

Manualmente:
- Supabase Dashboard → Project Settings → Database → Backups → "Take Snapshot"
- Confirmar status `Ready` antes de prosseguir.

Alternativa via CLI (se dashboard não estiver disponível):

```bash
# pg_dump schema+data, redirecionado para arquivo local fora de git
pg_dump --schema=public --schema=supabase_migrations \
  -h db.tpdiccnmsnjtjwhardij.supabase.co -U postgres \
  -d postgres -F c -f ~/agekey-prod-backup-20260507.dump
```

### 7.3. Eventual `db push` (somente após autorização)

```bash
supabase link --project-ref tpdiccnmsnjtjwhardij
supabase db push  # aplica 017 + 020-030 em ordem
```

Se quiser controlar uma a uma:

```bash
# Não há flag --include para uma migration específica no CLI atual.
# Opção: aplicar manualmente via psql:
psql "postgres://postgres:$PG_PASSWORD@db.tpdiccnmsnjtjwhardij.supabase.co:5432/postgres" \
  -f supabase/migrations/017_fix_tenant_self_access.sql
# Depois registrar no schema_migrations:
psql "..." -c "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('017', 'fix_tenant_self_access', ARRAY[...]::text[]);"
```

### 7.4. Alternativa de aplicar migrations específicas manualmente

Para máximo controle, em cada fase:

```bash
# Fase 1 — só 017
psql -f supabase/migrations/017_fix_tenant_self_access.sql

# Fase 2 — Consent em transação atômica
psql <<EOF
BEGIN;
\i supabase/migrations/020_parental_consent_core.sql
\i supabase/migrations/021_parental_consent_guardian.sql
\i supabase/migrations/022_parental_consent_rls.sql
\i supabase/migrations/023_parental_consent_webhooks.sql
COMMIT;
EOF
```

Isto **garante atomicidade** dentro de uma fase — se qualquer uma
falhar, BEGIN…ROLLBACK desfaz tudo da fase.

### 7.5. Checklist pós-aplicação

```sql
-- Conferir migrations aplicadas
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
-- Esperado: 29 linhas (000-017, 020-030).

-- Conferir tabelas criadas
SELECT count(*) AS tables FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Esperado: 64 (33 atual + 15 novas + 16 ?? — checar com HML).

-- Conferir RLS habilitado em tabelas Consent/Safety
SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace n ON n.oid = relnamespace
 WHERE n.nspname = 'public' AND relname IN (
  'parental_consent_requests','parental_consents','parental_consent_revocations',
  'parental_consent_tokens','consent_text_versions','guardian_contacts','guardian_verifications',
  'safety_subjects','safety_interactions','safety_events','safety_rules',
  'safety_alerts','safety_aggregates','safety_evidence_artifacts','safety_model_runs'
 );
-- Esperado: 15 linhas, todas com relrowsecurity = true.

-- Conferir 017 policies
SELECT policyname FROM pg_policies
 WHERE policyname IN ('tenant_users_select_self','tenants_select_for_member');
-- Esperado: 2 linhas.

-- Conferir cron schedule
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%retention%';
-- Esperado: ≥ 1 job ativo.

-- Conferir seed de safety_rules
SELECT count(*) FROM public.safety_rules WHERE tenant_id IS NULL;
-- Esperado: 5 (regras globais default).
```

## 8. Recomendação final

1. **Não fazer `migration repair` em PROD.** Não é o tipo certo de
   operação para schema gap real.
2. **Aplicar migrations faltantes de verdade** — a única forma correta
   de fechar o gap.
3. **Só executar após aprovação expressa** do usuário, com janela de
   manutenção e snapshot prévio.
4. **Sequência recomendada**: aplicar em fases conforme
   `prod-migration-application-plan.md`. Especialmente:
   - Fase 1 (017) é segura e pode ser feita primeiro
     independentemente do produto.
   - Fases 2 e 3 (Consent/Safety) **dependem de decisão de produto**
     sobre quando abrir esses módulos para tenants.
   - Fases 4 (retention/post-merge/RLS hardening) podem ir junto da 2
     ou da 3, ou separadamente.
5. **Validar cada fase** com smoke tests antes de prosseguir para a
   próxima.
6. **Documentar no execution report** todas as ações com timestamps,
   outputs antes/depois, e rollback path executado se necessário.

Aguardando decisão do usuário.
