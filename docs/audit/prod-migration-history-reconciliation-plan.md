# PROD — Plano de reconciliação do histórico de migrations

> **Status**: PROD tem **schema gap real**, não apenas bookkeeping. Faltam
> 12 migrations (017 + 020–030) que correspondem aos módulos AgeKey
> Consent (R3), Safety Signals (R4), retention cron (R7), fixes
> pós-merge (R12) e fix do bug de redirect-loop em /onboarding.
>
> **Não execute** nenhuma alteração em PROD sem aprovação explícita.
> Este relatório é diagnóstico + plano. Nada foi alterado no banco.
>
> Branch: `claude/prod-migration-history-plan` (não mergeada).
> Projeto Supabase PROD: `tpdiccnmsnjtjwhardij` (AgeKey-prod).
> Data: 2026-05-07.

## 1. Sumário executivo

PROD tem apenas **17 das 29 migrations aplicadas** (000–016). Está
**sem** os módulos AgeKey Consent e Safety Signals, sem o fix do
redirect-loop e sem a infraestrutura de retention cron e RLS de
partições. As 12 migrations faltando são:

| Versão | Nome | Origem | Tipo |
|---|---|---|---|
| 017 | fix_tenant_self_access | PR #46 | Bug fix (RLS policies) |
| 020 | parental_consent_core | PR #36 | Módulo novo (Consent) |
| 021 | parental_consent_guardian | PR #36 | Módulo novo (Consent) |
| 022 | parental_consent_rls | PR #36 | RLS do módulo |
| 023 | parental_consent_webhooks | PR #36 | Webhooks do módulo |
| 024 | safety_signals_core | PR #37 | Módulo novo (Safety) |
| 025 | safety_signals_rls | PR #37 | RLS do módulo |
| 026 | safety_signals_webhooks | PR #37 | Webhooks do módulo |
| 027 | safety_signals_seed_rules | PR #37 | Seed de 5 regras |
| 028 | retention_cron_schedule | PR #43 | Cron de retenção |
| 029 | post_merge_p0_fixes | commit `7c543d8` | Fixes pós-merge |
| 030 | enable_rls_audit_billing_partitions | commit `7c543d8` | Hardening RLS |

A natureza dessa divergência **não permite usar `migration repair`** — é
schema gap genuíno, não conflito de versionamento. Para fechar o gap
seria necessário **aplicar** as 12 migrations no banco.

Como decisão de produto, três caminhos possíveis (§7).

## 2. Estado atual das migrations em PROD

### 2.1. `supabase migration list` em PROD (via MCP)

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

17 linhas. Versões já em **formato sequencial** (`000`–`016`), com
nomes **sem o prefixo numérico** (ex.: `bootstrap`, não `000_bootstrap`).

### 2.2. Comparação com arquivos locais

| Versão local | Existe em PROD? | Comentário |
|---|---|---|
| 000–016 | ✅ Sim | Aplicadas com nome sem prefixo (`bootstrap`, etc.) |
| 017 | ❌ Não | Fix de redirect-loop **não está em PROD** |
| 018, 019 | n/a | Não existem locais (remanescentes de timeline alternativa, descartados) |
| 020–023 | ❌ Não | Consent: módulo inteiro ausente em PROD |
| 024–027 | ❌ Não | Safety: módulo inteiro ausente em PROD |
| 028 | ❌ Não | Retention cron não configurado |
| 029 | ❌ Não | Fixes pós-merge não aplicados |
| 030 | ❌ Não | RLS em partições — situação a verificar (§4.2) |

## 3. Diferença vs HML

| Aspecto | HML (`wljedzqgprkpqhuazdzv`) | PROD (`tpdiccnmsnjtjwhardij`) |
|---|---|---|
| Migrations aplicadas | 29 (000–017, 020–030) | 17 (000–016) |
| Tipo de divergência | bookkeeping (versão timestamped vs sequencial) | schema gap real (12 migrations não aplicadas) |
| Tabelas Consent | ✅ 7 tabelas | ❌ 0 tabelas |
| Tabelas Safety | ✅ 8 tabelas | ❌ 0 tabelas |
| 017 (fix tenant self-access) | ✅ Aplicada | ❌ Não aplicada |
| Repair recomendado | metadata-only UPDATE (já feito) | aplicação real de migrations (escopo de produto) |

## 4. Estado do schema em PROD

### 4.1. Tabelas presentes em `public` (33 tabelas)

| Tabela | Linhas | Comentário |
|---|---|---|
| `tenants` | 1 | Operacional |
| `tenant_users` | 1 | Operacional |
| `applications` | 1 | Operacional |
| `policies` | 10 | Mesma seed do HML |
| `policy_versions` | 10 | Operacional |
| `jurisdictions` | 56 | Mesma seed do HML |
| `crypto_keys` | 4 | Operacional |
| `issuers` | 5 | Operacional |
| `trust_lists` | 1 | Operacional |
| `audit_events` + 13 partições | 6 (2026_04) + 0 outras | Particionamento OK |
| `billing_events` + 13 partições | 0 todas | Particionamento OK |
| `webhook_endpoints`, `webhook_deliveries` | 0 | Operacional |
| `verification_sessions`, `verification_challenges`, `verification_results`, `result_tokens`, `proof_artifacts` | 0 | Operacional |
| `revocations`, `issuer_revocations` | 0 | Operacional |
| `usage_counters`, `rate_limit_buckets` (5) | 0 + 5 | Operacional |
| `ip_reputation` | 0 | Operacional |

### 4.2. Tabelas **ausentes** em PROD

| Tabela | Migration que cria | Impacto |
|---|---|---|
| `parental_consent_requests` | 020 | API de Consent não funciona |
| `parental_consents` | 020 | API de Consent não funciona |
| `parental_consent_revocations` | 020 | API de Consent não funciona |
| `parental_consent_tokens` | 020 | API de Consent não funciona |
| `consent_text_versions` | 020 | API de Consent não funciona |
| `guardian_contacts` | 021 | OTP do responsável não funciona |
| `guardian_verifications` | 021 | OTP do responsável não funciona |
| `safety_subjects` | 024 | API de Safety não funciona |
| `safety_interactions` | 024 | API de Safety não funciona |
| `safety_events` | 024 | API de Safety não funciona |
| `safety_rules` | 024 | API de Safety não funciona |
| `safety_alerts` | 024 | API de Safety não funciona |
| `safety_aggregates` | 024 | API de Safety não funciona |
| `safety_evidence_artifacts` | 024 | API de Safety não funciona |
| `safety_model_runs` | 024 | API de Safety não funciona |

**Total: 15 tabelas ausentes.**

Implicação: se algum tenant em PROD tentar usar `parental-consent-*` ou
`safety-*` edge functions, **vai receber erro 500**. As edge functions
não estão protegidas por feature flag de runtime que verifique
existência da tabela.

### 4.3. Estado do RLS em partições legadas

PROD mostra `rls_enabled: true` em todas as 26 partições de
`audit_events` e `billing_events`. Diferente do problema que motivou a
migration 030 em P0 (onde RLS estava `false` nas partições). Isso
sugere que PROD foi provisionada de uma forma que já habilitou RLS
desde o início, **e a migration 030 seria idempotente / no-op em PROD**.

## 5. Diferença de naming também observada

**Importante**: PROD usa o formato `name=bootstrap` (sem prefixo
numérico), enquanto HML pós-repair tem `name=000_bootstrap`. O CLI
moderno parseia o filename `000_bootstrap.sql` como
`version=000, name=bootstrap` (despreza o prefixo do nome).

Isso significa:

- PROD está em formato **canônico moderno** do CLI.
- HML pós-repair está em formato **inconsistente com PROD** (mantém `000_bootstrap` no name).
- Se quisermos **simetria perfeita**, devemos rodar em HML uma operação
  adicional para limpar o prefixo do nome — pode ser combinada com
  outras tarefas, não é urgente.

Comando opcional para HML (não executar agora):

```sql
UPDATE supabase_migrations.schema_migrations
SET name = regexp_replace(name, '^[0-9]+_', '');
```

Isso transformaria `000_bootstrap` → `bootstrap`, alinhando com PROD.
**Risco baixo, reversível, não destrutivo.**

## 6. Riscos de aplicar as 12 migrations em PROD

### 6.1. Risco operacional

| Migration | Risco | Justificativa |
|---|---|---|
| 017 | **Baixo** | 2 CREATE POLICY + 2 COMMENT. Idempotente se rodar mais de uma vez (pode ter erro `already exists`, recuperável). |
| 020 | **Baixo** | CREATE TABLE/TYPE/INDEX, sem dados. Tabelas novas. |
| 021 | **Baixo** | Mesma natureza. |
| 022 | **Baixo** | CREATE POLICY. Pressupõe tabelas da 020/021. |
| 023 | **Baixo** | CREATE TRIGGER. Não cria tabela nova. |
| 024 | **Baixo** | CREATE TABLE/TYPE — Safety inteira. |
| 025 | **Baixo** | CREATE POLICY. |
| 026 | **Baixo** | CREATE TRIGGER. |
| 027 | **Baixo** | INSERT seeds (5 linhas em `safety_rules`). |
| 028 | **Médio** | Usa `pg_cron` — depende de extensão habilitada. Em PROD, verificar se está. |
| 029 | **Baixo** | Fixes idempotentes (existem ALTER... IF NOT EXISTS). |
| 030 | **Baixo** | ENABLE ROW LEVEL SECURITY. **Idempotente** se já está habilitado. |

### 6.2. Risco de produto

- Aplicar Consent/Safety em PROD **abre a superfície de uso desses
  módulos** para tenants que tenham as feature flags habilitadas.
- Se algum tenant tentar usar a API agora (com a tabela criada), entra
  em produção uso real de funcionalidade que talvez não esteja pronta
  para PROD do ponto de vista do produto.
- **Decisão de produto**: queremos abrir Consent/Safety em PROD agora?

### 6.3. Risco do `pg_cron` em 028

Migration 028 (`retention_cron_schedule`) tipicamente usa
`cron.schedule(...)` para agendar limpeza. Precisa de extensão
`pg_cron` habilitada. Verificação a fazer:

```sql
select extname, extversion from pg_extension where extname = 'pg_cron';
```

Se não estiver instalada, 028 falharia. Em HML estava habilitada (via
provisão inicial). Em PROD, **a verificar**.

## 7. Caminhos possíveis

### 7.1. Caminho A — não aplicar nada agora

Manter PROD apenas com Core. Consent e Safety ficam disponíveis só em
HML. A `main` permanece como source of truth de design, mas PROD
deploya apenas o subset Core.

**Quando faz sentido**: produto ainda não quer abrir Consent/Safety
para tenants em PROD; HML segue como ambiente de validação.

**Riscos**: documentação fica divergente (a `main` reconciliada
descreve um produto completo que PROD não roda).

**Ação imediata**: nenhuma. Plano fica documentado.

### 7.2. Caminho B — aplicar somente 017 (bug fix)

Aplicar exclusivamente a migration `017_fix_tenant_self_access` para
resolver o redirect-loop. Não tocar em Consent/Safety.

**Quando faz sentido**: o redirect-loop está afetando usuários em PROD
hoje, mas Consent/Safety ainda não devem abrir.

**Risco**: muito baixo (2 CREATE POLICY).

**Comando** (não executar — precisa autorização):

```bash
supabase link --project-ref tpdiccnmsnjtjwhardij
supabase db push --include 017
```

Ou via SQL direto:

```sql
-- Conteúdo de supabase/migrations/017_fix_tenant_self_access.sql
CREATE POLICY tenant_users_select_self
  ON tenant_users
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY tenants_select_for_member
  ON tenants
  FOR SELECT
  USING (
    id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

COMMENT ON POLICY tenant_users_select_self ON tenant_users IS
  'Permite usuário autenticado ler suas próprias linhas (resolve circularidade com current_tenant_id() durante bootstrap de sessão).';

COMMENT ON POLICY tenants_select_for_member ON tenants IS
  'Permite usuário autenticado ler tenants aos quais pertence (necessário para sidebar e tenant switcher futuro).';

-- Registrar bookkeeping:
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '017',
  'fix_tenant_self_access',
  ARRAY[ ... 4 statements ... ]::text[]
);
```

### 7.3. Caminho C — aplicar todas as 12 (alinhar PROD com main)

Aplicar 017 + 020–030. PROD passa a refletir a `main` reconciliada.

**Quando faz sentido**: produto quer abrir Consent/Safety em PROD agora,
em paralelo a HML.

**Pré-requisitos**:

1. Verificar `pg_cron` está habilitado em PROD (para 028).
2. Backup completo de PROD antes (snapshot Supabase ou pg_dump).
3. Janela de manutenção opcional (operação tem ~10 segundos de DDL —
   provavelmente sem downtime perceptível, mas conservador).
4. Plano de rollback documentado (DROP TABLE para todas as 15 novas
   tabelas, DROP POLICY para as criadas em 022 e 025, DROP TRIGGER para
   023 e 026, etc.).
5. Smoke tests em PROD após aplicação (curl em consent + safety).
6. Decisão de produto explícita.

**Risco**: baixo no DDL, médio no impacto operacional / produto.

**Comando** (não executar — precisa autorização):

```bash
supabase link --project-ref tpdiccnmsnjtjwhardij
supabase db push  # aplica todas locais não aplicadas
```

Vai aplicar 017 + 020–030 em ordem. Como são todas CREATE/ALTER, não
há conflito com schema existente (apenas adições).

## 8. Recomendação técnica

**Caminho B** (aplicar somente 017) é o ponto intermediário mais
seguro:

- Resolve um bug real que afeta usuários em PROD.
- Risco baixíssimo (2 CREATE POLICY).
- Não toca Consent/Safety — mantém escopo restrito.
- Não exige decisão de produto sobre R3/R4.
- Reversível (`DROP POLICY tenant_users_select_self ON tenant_users`).

**Caminho C** (aplicar todas) deve ser tratado em **outra rodada com
janela específica e checklist próprio**, não como continuação direta
desta sessão.

**Caminho A** (não fazer nada) deixa o redirect-loop em produção e
diverge `main` de PROD permanentemente. Não recomendado se o produto
quer manter PROD como espelho de `main`.

## 9. Smoke tests recomendados ANTES de aplicar qualquer migration em PROD

| # | Teste | Razão |
|---|---|---|
| 1 | `select count(*) from public.tenant_users where user_id = auth.uid()` (com user de teste) | Confirmar estado atual do bug |
| 2 | Login + landing — qual rota o usuário cai? | Reproduzir redirect-loop |
| 3 | `select count(*) from supabase_migrations.schema_migrations` | Confirmar 17 linhas |
| 4 | `select extname from pg_extension where extname in ('pg_cron','pgsodium','pgcrypto')` | Confirmar extensões necessárias |
| 5 | Snapshot via dashboard Supabase ou `pg_dump --schema-only` | Backup pré-mudança |

## 10. Smoke tests DEPOIS (caminho B — 017 apenas)

| # | Teste | Esperado |
|---|---|---|
| 1 | `select count(*) from supabase_migrations.schema_migrations where name = 'fix_tenant_self_access'` | 1 linha |
| 2 | `select count(*) from pg_policies where policyname in ('tenant_users_select_self','tenants_select_for_member')` | 2 |
| 3 | Login + landing — qual rota? | Dashboard direto, sem `/onboarding` em loop |
| 4 | `select count(*) from public.tenant_users where user_id = auth.uid()` (como user logado, sem `app.current_tenant_id` setado) | ≥ 1 (antes: 0) |

## 11. O que NÃO foi feito nesta sessão (PROD)

- ❌ Nenhuma migration aplicada em PROD.
- ❌ Nenhum `supabase db push` em PROD.
- ❌ Nenhum `migration repair` em PROD.
- ❌ Nenhuma alteração no schema de PROD.
- ❌ Nenhuma alteração na tabela `schema_migrations` de PROD.
- ❌ Nenhuma extensão habilitada em PROD.
- ❌ Nenhum snapshot/backup de PROD criado.
- ✅ Apenas leitura via MCP `list_migrations` e `list_tables`.

## 12. Confirmação de princípios

- ✅ Princípio aplicado: "primeiro entender, depois agir".
- ✅ Plano só de leitura — zero efeito em PROD.
- ✅ Decisão de produto sobre Consent/Safety em PROD **deferida ao
  usuário** — não vou impor caminho C unilateralmente.
- ✅ Bug fix 017 explicitamente classificado como menor risco
  (caminho B), mas ainda **aguardando autorização** antes de execução.
- ✅ Estratégia documentada por escrito antes de qualquer alteração.

## 13. Próxima decisão sua

Por favor escolha um dos caminhos da §7:

1. **Caminho A** — não tocar PROD agora. Plano fica documentado.
2. **Caminho B** — aplicar somente 017 (fix do redirect-loop) com
   minha execução. Eu rodo via MCP `apply_migration` ou `execute_sql`
   após sua aprovação explícita.
3. **Caminho C** — aplicar todas as 12 (017 + 020–030). Eu **não
   recomendo** sem janela de manutenção planejada e decisão de produto
   formalizada. Se autorizar este caminho, antes vou listar mais
   pré-requisitos (verificação de extensions, plano de rollback,
   sequência exata de aplicação).
4. **Outro** — me diga.

Aguardando.
