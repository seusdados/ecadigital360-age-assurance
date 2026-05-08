# PROD — Relatório de execução — Fase 1 — Migration 017

> **Resultado**: ✅ sucesso. `017_fix_tenant_self_access` aplicada **somente em PROD**, em transação atômica, dentro do escopo autorizado.
>
> Branch: `claude/prod-migration-history-plan` (PR #55).
> Plano correspondente: `docs/audit/prod-migration-application-plan.md` Fase 1.

## 1. Identificação

| Campo | Valor |
|---|---|
| Data/hora de início | 2026-05-07 ~19:55 UTC |
| Data/hora de fim | 2026-05-07 ~19:56 UTC |
| Duração efetiva | ~10 segundos (DDL + bookkeeping) |
| Project name | AgeKey-prod |
| Project ref | `tpdiccnmsnjtjwhardij` |
| Host | `db.tpdiccnmsnjtjwhardij.supabase.co` |
| Postgres version | `17.6.1.105` |
| Operador | Claude Code (sessão `01Vngijrqb19mHBpRz5ucia3`) via MCP `execute_sql` |
| Autorização | Usuário, mensagem na sessão atual (Fase 1 apenas, 017 apenas) |
| Referência canônica | `supabase/migrations/017_fix_tenant_self_access.sql` em `main` (commit `bbf9a46`) |

## 2. Pré-flight (read-only, antes de qualquer alteração)

### 2.1. Verificação do PR #55

Branch `claude/prod-migration-history-plan` no remoto contém os 3 docs autorizados:

```
docs/audit/prod-migration-application-plan.md
docs/audit/prod-migration-history-reconciliation-plan.md
docs/audit/prod-schema-gap-diagnostic-report.md
```

Tip: `a2be595`. Pull request: https://github.com/seusdados/ecadigital360-age-assurance/pull/55

### 2.2. Conteúdo da migration local 017

Inspecionado via `Read` em `supabase/migrations/017_fix_tenant_self_access.sql` (43 linhas):

- 22 linhas de header (comentários SQL).
- 4 statements DDL:
  1. `CREATE POLICY tenant_users_select_self ON tenant_users FOR SELECT USING (user_id = auth.uid());`
  2. `CREATE POLICY tenants_select_for_member ON tenants FOR SELECT USING (id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));`
  3. `COMMENT ON POLICY tenant_users_select_self ON tenant_users IS '...';`
  4. `COMMENT ON POLICY tenants_select_for_member ON tenants IS '...';`

Confirmado que NÃO contém:
- ❌ Nenhum `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `TRUNCATE`.
- ❌ Nenhum `CREATE TYPE` ou `CREATE FUNCTION`.
- ❌ Nenhum `CREATE TRIGGER`.
- ❌ Nenhum `INSERT/UPDATE/DELETE` em tabelas de dados.
- ❌ Nenhuma referência a Consent ou Safety.
- ❌ Nenhuma referência a cron/retention.

### 2.3. Estado de PROD imediatamente antes (read-only via MCP)

| Métrica | Valor pré-execução |
|---|---|
| `migration_count` | **17** |
| `has_017_already` (version `017` ou name `fix_tenant_self_access`) | **NO** |
| `has_consent_tables` (parental_consent_requests existe?) | **NO** |
| `has_safety_tables` (safety_events existe?) | **NO** |
| `has_017_policy_tenant_users_self` | **NO** |
| `has_017_policy_tenants_for_member` | **NO** |
| `tenants_rls_enabled` | **YES** (RLS já estava habilitado) |
| `tenant_users_rls_enabled` | **YES** (idem) |
| `public_table_count` | **49** (33 base + 14 audit_events particionados + 14 billing_events particionados, com correção da contagem do diagnostic-report §4.1 que estimou 33) |

## 3. Backup / ponto de restauração

### 3.1. Snapshot Supabase

**Não criado por Claude.** A criação de snapshot do projeto Supabase é
operação de dashboard, não disponível via MCP. Aceito pelo usuário como
"se o ambiente Supabase permitir" (mensagem da sessão).

### 3.2. PITR (Point-in-Time Recovery)

Não verificado via MCP — depende de plano Supabase. **Recomendado**
confirmar manualmente no dashboard `Project Settings → Database →
Backups`. Para esta operação específica, PITR é **fortemente
desejável** mas **não bloqueante** porque o rollback de 017 é trivial
(2 DROP POLICY).

### 3.3. Rollback path explícito

Se for necessário desfazer 017, executar:

```sql
BEGIN;
DROP POLICY IF EXISTS tenant_users_select_self ON public.tenant_users;
DROP POLICY IF EXISTS tenants_select_for_member ON public.tenants;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '017';
COMMIT;
```

Operação reversível, sem perda de dados (017 não criou tabelas nem
linhas; só policies e comentários).

## 4. Comandos executados

### 4.1. Comando principal — aplicação atômica de 017

Via MCP `execute_sql` no projeto `tpdiccnmsnjtjwhardij`. Uma única
execução, transação atômica:

```sql
BEGIN;

CREATE POLICY tenant_users_select_self
  ON public.tenant_users
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY tenants_select_for_member
  ON public.tenants
  FOR SELECT
  USING (
    id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY tenant_users_select_self ON public.tenant_users IS
  'Permite usuário autenticado ler suas próprias linhas (resolve circularidade com current_tenant_id() durante bootstrap de sessão).';

COMMENT ON POLICY tenants_select_for_member ON public.tenants IS
  'Permite usuário autenticado ler tenants aos quais pertence (necessário para sidebar e tenant switcher futuro).';

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '017',
  'fix_tenant_self_access',
  ARRAY[
    'CREATE POLICY tenant_users_select_self ON public.tenant_users FOR SELECT USING (user_id = auth.uid())',
    'CREATE POLICY tenants_select_for_member ON public.tenants FOR SELECT USING (id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))',
    'COMMENT ON POLICY tenant_users_select_self ON public.tenant_users IS ''Permite usuário autenticado ler suas próprias linhas (resolve circularidade com current_tenant_id() durante bootstrap de sessão).''',
    'COMMENT ON POLICY tenants_select_for_member ON public.tenants IS ''Permite usuário autenticado ler tenants aos quais pertence (necessário para sidebar e tenant switcher futuro).'''
  ]::text[]
);

COMMIT;
```

**Resultado**: `[]` (vazio = sem erro; transação `COMMIT` bem-sucedida).

### 4.2. Bookkeeping seguindo naming canônico de PROD

Observação importante: PROD usa `name='bootstrap'`, `name='tenancy'`,
… (sem prefixo numérico). Por isso a 017 foi inserida como
`name='fix_tenant_self_access'` (sem prefixo `017_`), preservando a
convenção de PROD. Contraste:

| Ambiente | version | name |
|---|---|---|
| PROD pós-execução | `017` | `fix_tenant_self_access` |
| HML pós-PR #54 | `017` | `017_fix_tenant_self_access` (mantido prefixo do timestamped antigo) |

Esse desalinhamento de naming entre HML e PROD foi **conscientemente
preservado** porque alterar o naming em HML requer outra operação
distinta (já documentada em `hml-migration-history-reconciliation-execution-report.md` §2.5 e
`prod-schema-gap-diagnostic-report.md` §2.3).

### 4.3. Validação pós-execução

Bateria de 16 checks via SQL único (MCP `execute_sql`):

| # | Métrica | Valor | Esperado | Status |
|---|---|---|---|---|
| 1 | `migration_count` | `18` | `18` (era 17 + 1 novo) | ✅ |
| 2 | `has_017_now` | `YES` | `YES` | ✅ |
| 3 | `has_017_named_correctly` (name = `fix_tenant_self_access`) | `YES` | `YES` | ✅ |
| 4 | `has_018_or_019` | `NO` | `NO` | ✅ |
| 5 | `has_020_or_higher` | `NO` | `NO` | ✅ |
| 6 | `has_consent_tables` | `NO` | `NO` | ✅ |
| 7 | `has_safety_tables` | `NO` | `NO` | ✅ |
| 8 | `policy_tenant_users_select_self_exists` | `YES` | `YES` | ✅ |
| 9 | `policy_tenants_select_for_member_exists` | `YES` | `YES` | ✅ |
| 10 | `tenants_rls_still_enabled` | `YES` | `YES` | ✅ |
| 11 | `tenant_users_rls_still_enabled` | `YES` | `YES` | ✅ |
| 12 | `tenants_count_unchanged` | `1` | `1` | ✅ |
| 13 | `tenant_users_count_unchanged` | `1` | `1` | ✅ |
| 14 | `applications_count_unchanged` | `1` | `1` | ✅ |
| 15 | `policies_count_unchanged` | `10` | `10` | ✅ |
| 16 | `public_table_count_unchanged` | `49` | `49` (era 49) | ✅ |

**16/16 ✅. Sem regressões.**

## 5. Confirmação de que somente a 017 foi aplicada

| Verificação | Resultado |
|---|---|
| `migration_count` aumentou em exatamente 1 (17 → 18) | ✅ |
| Nenhuma migration em [018, 019] foi adicionada | ✅ |
| Nenhuma migration ≥ 020 foi adicionada | ✅ |
| `parental_consent_requests` continua não existindo | ✅ |
| `safety_events` continua não existindo | ✅ |
| `public_table_count` permaneceu em 49 (sem novas tabelas) | ✅ |

Conclusão: a execução **respeitou estritamente o escopo autorizado**.

## 6. Output antes / depois — resumo

### 6.1. `supabase migration list` antes (via MCP)

```
version | name
--------+------------------------
000     | bootstrap
001     | tenancy
002     | policies
003     | verifications
004     | trust
005     | webhooks
006     | audit_billing
007     | security
008     | rls
009     | triggers
010     | edge_support
011     | storage
012     | webhook_enqueue
013     | tenant_bootstrap
014     | vault_crypto_keys
015     | fix_audit_global_rows
016     | vault_create_secret
```

17 linhas.

### 6.2. `supabase migration list` depois (via MCP)

```
version | name
--------+------------------------
000     | bootstrap
001     | tenancy
002     | policies
003     | verifications
004     | trust
005     | webhooks
006     | audit_billing
007     | security
008     | rls
009     | triggers
010     | edge_support
011     | storage
012     | webhook_enqueue
013     | tenant_bootstrap
014     | vault_crypto_keys
015     | fix_audit_global_rows
016     | vault_create_secret
017     | fix_tenant_self_access     ← NOVO
```

18 linhas. **Apenas 017 nova.** 020–030 continuam ausentes (esperado).

### 6.3. Diff de policies

Antes:

```
SELECT policyname FROM pg_policies WHERE policyname IN ('tenant_users_select_self','tenants_select_for_member');
-- 0 linhas
```

Depois:

```
SELECT policyname FROM pg_policies WHERE policyname IN ('tenant_users_select_self','tenants_select_for_member');
-- tenant_users_select_self
-- tenants_select_for_member
```

2 linhas. Operação de Fase 1 entregou exatamente as policies esperadas.

## 7. Smoke tests

### 7.1. SQL smoke tests (executados por Claude via MCP)

| # | Teste | Resultado |
|---|---|---|
| 7.1.1 | `supabase migration list` mostra 18 linhas com 017 presente | ✅ |
| 7.1.2 | `pg_policies` contém `tenant_users_select_self` em `tenant_users` | ✅ |
| 7.1.3 | `pg_policies` contém `tenants_select_for_member` em `tenants` | ✅ |
| 7.1.4 | `relrowsecurity = true` em `tenants` e `tenant_users` | ✅ |
| 7.1.5 | Contagem de dados em tabelas core inalterada | ✅ |
| 7.1.6 | Nenhuma tabela `parental_consent_*` criada | ✅ |
| 7.1.7 | Nenhuma tabela `safety_*` criada | ✅ |
| 7.1.8 | Total de tabelas em `public` inalterado (49) | ✅ |

### 7.2. UI / functional smoke tests (delegados ao usuário)

Os testes funcionais que exigem browser ou tenant API key são **da
responsabilidade do usuário** — Claude não tem acesso a credenciais
de auth nem a sessões de browser:

| # | Teste | Como rodar |
|---|---|---|
| 7.2.1 | **Login** | abrir o painel admin de PROD, autenticar com user existente que tem vínculo em `tenant_users` |
| 7.2.2 | **Onboarding** | confirmar que **não cai em loop em `/onboarding`**; deve ir direto pro dashboard |
| 7.2.3 | **Dashboard** | navegar entre seções principais (applications, policies, audit events) |
| 7.2.4 | **Tenant access** | confirmar que sidebar mostra o tenant correto, contador de membros, etc. |
| 7.2.5 | **Policies** | listar as 10 policies seed; criar/editar uma policy de teste e reverter |
| 7.2.6 | **Ausência de regressão em rotas existentes** | navegar pelas rotas que existiam antes (verifications, webhooks, audit) |
| 7.2.7 | **Confirmação de ausência de Consent/Safety** | confirmar que **não aparecem** menus/rotas de Consent/Safety no painel |

**Esperado**:
- Login leva ao dashboard direto, **sem o redirect-loop em `/onboarding`** que motivou esta migration.
- Sidebar e contadores funcionam.
- Nenhum erro 500 ou regressão.
- Nenhuma rota Consent/Safety visível (porque tabelas/migrations não existem; UI deve ter feature flag ou fallback gracioso, mas é improvável que a 017 quebre isso porque ela só **adiciona** policies).

Se algum dos 7 testes acima falhar, **acionar rollback** (§3.3) e
documentar.

## 8. Riscos remanescentes

1. **Smoke tests funcionais não rodados por Claude** — testes UI (login, onboarding, dashboard, tenant access, policies, regressão de rotas, ausência de Consent/Safety) precisam ser confirmados manualmente pelo usuário. Sem essa confirmação, a operação não está formalmente "validada end-to-end".

2. **Schema gap principal continua** — PROD ainda não tem 020–030 (Consent + Safety + retention + post-merge). Continua divergente da `main`. Esta Fase 1 resolve apenas o bug do redirect-loop; não fecha o gap maior.

3. **Naming inconsistente entre HML e PROD** preservado — HML tem `name='000_bootstrap'` enquanto PROD tem `name='bootstrap'`. Para simetria total, um UPDATE adicional em HML seria necessário (não-urgente; documentado em `hml-migration-history-reconciliation-execution-report.md` §2.5).

4. **Snapshot pré-execução não confirmado por Claude** — a operação é reversível via DROP POLICY × 2, mas idealmente teria havido um snapshot Supabase via dashboard. Risco mitigado pela natureza não-destrutiva da migration.

5. **A 017 muda o comportamento de RLS** em `tenants` e `tenant_users` — agora qualquer usuário autenticado pode ler suas próprias linhas. Isso é **intencional** e necessário para o fix funcionar, mas deve ser documentado no compliance/security review.

## 9. Recomendação sobre próximas fases (2, 3, 4)

| Fase | Recomendação | Justificativa |
|---|---|---|
| **Fase 2** (Consent: 020–023) | **Aguardar decisão de produto.** Não aplicar antes de:<br>– produto autorizar abrir Consent em PROD<br>– webhooks dos tenants estarem testados em HML<br>– documentação de integração disponível para tenants<br>– janela de manutenção planejada<br>– snapshot Supabase pré-aplicação | Decisão de abrir um módulo de produto. Não é apenas técnica. |
| **Fase 3** (Safety: 024–027) | **Aguardar decisão de produto.** Mesmas condições que Fase 2. | Idem. Safety v1 é metadata-only mas exige treinamento de operação para responder a alertas. |
| **Fase 4** (retention/post-merge: 028–030) | **Pode ir junto da Fase 2 ou Fase 3** ou separadamente. Fase 4 não abre superfície de produto, é hardening. **Pré-requisito**: confirmar que `pg_cron` está habilitado em PROD. | Hardening + retention agendado. RLS em partições é idempotente. |

**Sugestão de sequência futura** (a ser decidida por produto + tech):

1. Validar Fase 1 (UI smoke tests pelo usuário).
2. Quando produto liberar Consent: aplicar Fases 2 + 4 (4 é hardening que vale junto).
3. Quando produto liberar Safety: aplicar Fase 3.
4. Cada fase em sua janela, com snapshot pré, smoke tests, execution report próprio.

## 10. Confirmações de princípios

Esta sessão **não executou** nenhum dos seguintes:

- ❌ `supabase db push` (em PROD ou em HML)
- ❌ `supabase migration repair` (em PROD)
- ❌ `supabase db reset`
- ❌ `supabase db pull`
- ❌ Nenhuma migration além de 017 em PROD
- ❌ Nenhuma alteração em schema de Consent/Safety
- ❌ Nenhuma habilitação de feature flag de Consent/Safety
- ❌ Nenhuma execução de cron/retention
- ❌ Nenhum SQL fora do escopo da 017 e dos checks read-only

Esta sessão **executou apenas**:

- ✅ Read-only via MCP (`list_migrations`, `list_tables`, `execute_sql` SELECT) para diagnóstico/validação
- ✅ Uma única transação `BEGIN…COMMIT` em PROD com 4 statements DDL + 1 INSERT bookkeeping da 017

Princípios canônicos preservados:

- ✅ Sem KYC, sem documento, sem idade exata, sem data de nascimento.
- ✅ Sem PII em payload público.
- ✅ Sem SD-JWT VC ou ZKP/BBS+ falsos (continuam stubs honestos behind feature flag — não tocados).
- ✅ Sem Safety com conteúdo bruto (Safety nem está em PROD).
- ✅ Sem interceptação, sem spyware.
- ✅ Sem score universal cross-tenant (RLS preservado; as 2 policies novas são auto-leitura por `auth.uid()`, sem ampliar exposição cross-tenant).

## 11. Próxima decisão do usuário

Por favor confirmar com smoke tests UI (§7.2.1–7.2.7) se o redirect-loop foi resolvido em PROD e se nenhuma regressão apareceu.

**Após confirmar**, decidir:

- A) Manter PROD como está (apenas 017 aplicada). Não abrir Consent/Safety até produto liberar. Plano permanece documentado.
- B) Avançar para Fase 4 (retention/post-merge/RLS hardening) que não abre superfície de produto. Útil se quiser PROD mais alinhado com `main` sem decisão de produto sobre Consent/Safety.
- C) Aguardar decisão de produto para Fases 2 e 3 (Consent/Safety).

Aguardando seu retorno após validação UI.
