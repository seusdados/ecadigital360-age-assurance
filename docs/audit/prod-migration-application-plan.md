# PROD — Plano de aplicação de migrations em fases

> **Não executado.** Este documento é estritamente um **plano** —
> nenhuma migração foi aplicada em PROD nesta sessão.
>
> Acompanha: `docs/audit/prod-schema-gap-diagnostic-report.md`
> (diagnóstico do estado atual).
>
> Branch: `claude/prod-migration-history-plan` (PR #55).
>
> Projeto: `tpdiccnmsnjtjwhardij` (AgeKey-prod).

## Resumo das fases

| Fase | Escopo | Migrations aplicadas | Criticidade | Dependência de decisão de produto |
|---|---|---|---|---|
| **Fase 0** | Pré-flight | — | Bloqueante | Não |
| **Fase 1** | Core fix (redirect-loop) | 017 | Baixa | Não |
| **Fase 2** | Consent | 020–023 | Média | **Sim** — decisão de abrir Consent em PROD |
| **Fase 3** | Safety | 024–027 | Média | **Sim** — decisão de abrir Safety em PROD |
| **Fase 4** | Retention/post-merge | 028–030 | Média | Não (junto com 2 ou 3) |
| **Fase 5** | Smoke tests | — | Bloqueante após cada fase | Não |
| **Fase 6** | Relatório final | — | Pós-execução | Não |

Cada fase depende explicitamente da fase anterior ter passado nos
smoke tests. Falha em qualquer smoke test → rollback ou parada para
investigação.

---

## Fase 0 — Pré-flight

**Objetivo**: garantir todos os pré-requisitos antes de tocar PROD.

| # | Item | Comando / verificação | Estado esperado |
|---|---|---|---|
| 0.1 | `main` em `bbf9a46` ou posterior | `git fetch origin main && git log -1 origin/main --format='%H %s'` | SHA `bbf9a46` ou descendente |
| 0.2 | HML validada com schema completo | `supabase migration list --project-ref wljedzqgprkpqhuazdzv` | 29 migrations aplicadas (000–017, 020–030) |
| 0.3 | HML smoke tests passando | curl em `parental-consent-session` + `safety-event-ingest` em HML | HTTP 200 em ambos |
| 0.4 | **Snapshot completo de PROD criado** | Dashboard Supabase → Database → Backups → Take Snapshot | Status `Ready`, timestamp anotado |
| 0.5 | PITR (Point-in-Time Recovery) habilitado | Dashboard → Database → Backups | `Enabled` |
| 0.6 | Variáveis de ambiente confirmadas | Dashboard Vercel + Supabase secrets | `AGEKEY_PARENTAL_CONSENT_ENABLED`, `AGEKEY_SAFETY_SIGNALS_ENABLED`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` configuradas |
| 0.7 | Feature flags em **`false`** (até produto liberar) | `select decrypted_secret from vault.decrypted_secrets where name like 'AGEKEY_%_ENABLED'` | `false` em ambos |
| 0.8 | Extensão `pg_cron` habilitada (necessária para 028) | `select extname, extversion from pg_extension where extname = 'pg_cron'` | 1 linha |
| 0.9 | Sem usuários críticos em janela | Métricas Vercel (request rate) + agenda comercial | Janela de baixo tráfego confirmada |
| 0.10 | Stakeholders notificados | Comunicação 24h antes via canal de produto | Confirmação por escrito |
| 0.11 | Plano de rollback impresso/aberto em outra aba | `prod-schema-gap-diagnostic-report.md` §6.8 | À mão durante execução |
| 0.12 | Branch `main` checada localmente, sem mods | `git status -s && git rev-parse HEAD` | Tree limpa |

**Critério de saída**: todos os 12 itens acima checados ✅. Qualquer ❌
**bloqueia** a aplicação. Em particular, **sem 0.4 (snapshot) não
prossiga**.

---

## Fase 1 — Core fix (redirect-loop)

**Objetivo**: aplicar `017_fix_tenant_self_access` para resolver o
bug de redirect-loop em `/onboarding`.

**Migrations aplicadas**: `017`.

**Risco**: Baixo. 2 CREATE POLICY + 2 COMMENT ON POLICY. Idempotente.

**Comando recomendado** (atomic):

```bash
psql "postgres://postgres:$PG_PASSWORD@db.tpdiccnmsnjtjwhardij.supabase.co:5432/postgres" <<'EOF'
BEGIN;

-- Aplicar conteúdo de supabase/migrations/017_fix_tenant_self_access.sql
\i supabase/migrations/017_fix_tenant_self_access.sql

-- Registrar no bookkeeping
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '017',
  'fix_tenant_self_access',
  ARRAY[
    'CREATE POLICY tenant_users_select_self ON tenant_users FOR SELECT USING (user_id = auth.uid())',
    'CREATE POLICY tenants_select_for_member ON tenants FOR SELECT USING (id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))',
    'COMMENT ON POLICY tenant_users_select_self ON tenant_users IS ''Permite usuário autenticado ler suas próprias linhas (resolve circularidade com current_tenant_id() durante bootstrap de sessão).''',
    'COMMENT ON POLICY tenants_select_for_member ON tenants IS ''Permite usuário autenticado ler tenants aos quais pertence (necessário para sidebar e tenant switcher futuro).'''
  ]::text[]
);

COMMIT;
EOF
```

**Smoke tests da Fase 1**:

| # | Teste | Esperado |
|---|---|---|
| 1.1 | `select count(*) from supabase_migrations.schema_migrations where name = 'fix_tenant_self_access'` | `1` |
| 1.2 | `select count(*) from pg_policies where policyname in ('tenant_users_select_self','tenants_select_for_member')` | `2` |
| 1.3 | Login em `https://admin.agekey.<...>` com user de teste | Landing direto no dashboard, **sem redirect-loop em `/onboarding`** |
| 1.4 | Onboarding: criar novo tenant via UI | Sucesso |

**Critério de saída**: 4 testes ✅.

**Rollback se falhar**:

```sql
DROP POLICY IF EXISTS tenant_users_select_self ON tenant_users;
DROP POLICY IF EXISTS tenants_select_for_member ON tenants;
DELETE FROM supabase_migrations.schema_migrations WHERE name = 'fix_tenant_self_access';
```

---

## Fase 2 — Consent

**Objetivo**: aplicar o módulo AgeKey Parental Consent.

**Migrations aplicadas**: `020_parental_consent_core`,
`021_parental_consent_guardian`, `022_parental_consent_rls`,
`023_parental_consent_webhooks`.

**Risco**: Médio. Cria 7 tabelas novas + RLS + triggers.

**Pré-requisito de produto**: `AGEKEY_PARENTAL_CONSENT_ENABLED` deve
permanecer em **`false`** até validação completa do módulo. Isso
impede tráfego antes de RLS + webhooks estarem prontos.

**Comando recomendado** (atomic):

```bash
psql "$PROD_PG_URL" <<'EOF'
BEGIN;

\i supabase/migrations/020_parental_consent_core.sql
\i supabase/migrations/021_parental_consent_guardian.sql
\i supabase/migrations/022_parental_consent_rls.sql
\i supabase/migrations/023_parental_consent_webhooks.sql

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('020', 'parental_consent_core',     ARRAY[]::text[]),
  ('021', 'parental_consent_guardian', ARRAY[]::text[]),
  ('022', 'parental_consent_rls',      ARRAY[]::text[]),
  ('023', 'parental_consent_webhooks', ARRAY[]::text[]);

COMMIT;
EOF
```

> Nota: o `statements` array é deixado vazio por simplicidade. O CLI
> moderno aceita isso. Se quiser preencher, use o helper de §7 do
> diagnostic-report.

**Smoke tests da Fase 2** (todos via SQL ou MCP, **sem habilitar
flag**):

| # | Teste | Esperado |
|---|---|---|
| 2.1 | Tabelas criadas | 7 linhas: `parental_consent_requests`, `parental_consents`, `parental_consent_revocations`, `parental_consent_tokens`, `consent_text_versions`, `guardian_contacts`, `guardian_verifications` |
| 2.2 | RLS habilitada nas 7 | `relrowsecurity = true` para todas |
| 2.3 | Policies por tabela | ≥ 1 policy SELECT em cada |
| 2.4 | Triggers de webhook | `fan_out_*` triggers existem em `parental_consent_requests` (INSERT) e `parental_consents` (INSERT) |
| 2.5 | `consent_text_versions` seed (se existir) | linha default ou nenhuma — verificar arquivo 020 |
| 2.6 | Edge function `parental-consent-session` retorna `503` (flag false) | curl com flag false → 503 |

**Critério de saída**: 6 testes ✅.

**Rollback se falhar**:

Restore do snapshot é mais seguro. Alternativa via DDL:

```sql
DROP TRIGGER IF EXISTS ... ON parental_consent_requests;
-- ... (todos os triggers da 023)
DROP TABLE IF EXISTS public.guardian_verifications CASCADE;
DROP TABLE IF EXISTS public.guardian_contacts CASCADE;
DROP TABLE IF EXISTS public.consent_text_versions CASCADE;
DROP TABLE IF EXISTS public.parental_consent_tokens CASCADE;
DROP TABLE IF EXISTS public.parental_consent_revocations CASCADE;
DROP TABLE IF EXISTS public.parental_consents CASCADE;
DROP TABLE IF EXISTS public.parental_consent_requests CASCADE;
DROP TYPE IF EXISTS parental_consent_request_status;
-- ... (outros types da 020)
DELETE FROM supabase_migrations.schema_migrations WHERE name LIKE 'parental_consent_%';
```

**Decisão de produto** que precede esta fase:

- O time de produto está pronto para abrir Consent em PROD?
- A documentação de integração (`docs/modules/parental-consent/`)
  está disponível para os tenants?
- Os webhooks de tenants estão configurados e testados em HML?

Se qualquer ❌, **adiar Fase 2** e ir direto para Fase 4
(retention/RLS hardening) sem Consent.

---

## Fase 3 — Safety

**Objetivo**: aplicar o módulo AgeKey Safety Signals.

**Migrations aplicadas**: `024_safety_signals_core`,
`025_safety_signals_rls`, `026_safety_signals_webhooks`,
`027_safety_signals_seed_rules`.

**Risco**: Médio. Cria 8 tabelas + RLS + triggers + seeds.

**Pré-requisito de produto**: `AGEKEY_SAFETY_SIGNALS_ENABLED` em
**`false`** até validação completa.

**Comando recomendado** (atomic):

```bash
psql "$PROD_PG_URL" <<'EOF'
BEGIN;

\i supabase/migrations/024_safety_signals_core.sql
\i supabase/migrations/025_safety_signals_rls.sql
\i supabase/migrations/026_safety_signals_webhooks.sql
\i supabase/migrations/027_safety_signals_seed_rules.sql

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('024', 'safety_signals_core',       ARRAY[]::text[]),
  ('025', 'safety_signals_rls',        ARRAY[]::text[]),
  ('026', 'safety_signals_webhooks',   ARRAY[]::text[]),
  ('027', 'safety_signals_seed_rules', ARRAY[]::text[]);

COMMIT;
EOF
```

**Smoke tests da Fase 3**:

| # | Teste | Esperado |
|---|---|---|
| 3.1 | Tabelas criadas | 8 linhas Safety: `safety_subjects`, `safety_interactions`, `safety_events`, `safety_rules`, `safety_alerts`, `safety_aggregates`, `safety_evidence_artifacts`, `safety_model_runs` |
| 3.2 | RLS habilitada | `relrowsecurity = true` para todas |
| 3.3 | Policies | ≥ 1 SELECT, ≥ 1 INSERT em cada (tenant-scoped) |
| 3.4 | Trigger `safety_events_no_mutation` | existe em `safety_events` (UPDATE/DELETE bloqueados sem GUC `agekey.retention_cleanup`) |
| 3.5 | Trigger `safety_evidence_artifacts_legal_hold` | existe |
| 3.6 | Seed de safety_rules globais | `select count(*) from safety_rules where tenant_id is null` = `5` |
| 3.7 | View `safety_webhook_deliveries` | existe |
| 3.8 | Edge function `safety-event-ingest` retorna `503` (flag false) | curl com flag false → 503 |

**Critério de saída**: 8 testes ✅.

**Rollback**: análogo à Fase 2.

---

## Fase 4 — Retention/post-merge

**Objetivo**: agendar cron de retention, aplicar fixes pós-merge,
habilitar RLS em partições legadas (idempotente em PROD).

**Migrations aplicadas**: `028_retention_cron_schedule`,
`029_post_merge_p0_fixes`, `030_enable_rls_audit_billing_partitions`.

**Risco**: Médio (028 depende de `pg_cron`); baixo nas outras.

**Pré-requisito**:

- `pg_cron` habilitado (Fase 0.8).
- Função `safety_retention_cleanup_run()` ou equivalente existe (criada
  por 024 ou 028 — verificar local).

**Comando recomendado** (atomic):

```bash
psql "$PROD_PG_URL" <<'EOF'
BEGIN;

\i supabase/migrations/028_retention_cron_schedule.sql
\i supabase/migrations/029_post_merge_p0_fixes.sql
\i supabase/migrations/030_enable_rls_audit_billing_partitions.sql

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('028', 'retention_cron_schedule',          ARRAY[]::text[]),
  ('029', 'post_merge_p0_fixes',              ARRAY[]::text[]),
  ('030', 'enable_rls_audit_billing_partitions', ARRAY[]::text[]);

COMMIT;
EOF
```

**Smoke tests da Fase 4**:

| # | Teste | Esperado |
|---|---|---|
| 4.1 | Cron job criado | `select count(*) from cron.job where jobname like '%retention%'` ≥ `1` |
| 4.2 | Cron schedule correto | `select schedule from cron.job where jobname = '<...>'` corresponde ao definido em 028 |
| 4.3 | Cron `active = true` | confirmado |
| 4.4 | RLS em partições audit | 13 partições + default com `relrowsecurity = true` (provavelmente já estava — idempotente) |
| 4.5 | RLS em partições billing | mesma confirmação para 13 + default |
| 4.6 | Fixes pós-merge aplicados | depende do conteúdo de 029 — verificar arquivo local antes para listar |

**Critério de saída**: todos ✅.

**Rollback** (caso necessário):

```sql
SELECT cron.unschedule('safety-retention-cleanup-daily');
-- (ALTERs idempotentes da 029 e 030 normalmente não precisam rollback)
DELETE FROM supabase_migrations.schema_migrations WHERE name IN
  ('retention_cron_schedule', 'post_merge_p0_fixes', 'enable_rls_audit_billing_partitions');
```

---

## Fase 5 — Smoke tests integrados (pós-todas as fases)

**Objetivo**: validar funcionamento end-to-end do produto em PROD.

| # | Teste | Origem | Comando / passos | Esperado |
|---|---|---|---|---|
| 5.1 | Login no painel admin | UI | login com user existente | Dashboard direto |
| 5.2 | Onboarding | UI | criar novo tenant | Sucesso, tenant aparece |
| 5.3 | Dashboard | UI | navegar entre seções | Sem erros |
| 5.4 | Applications | UI/API | listar applications do tenant | Lista correta, dados isolados por tenant |
| 5.5 | Policies | UI/API | listar 10 policies seed | 10 linhas |
| 5.6 | Parental Consent (apenas se Fase 2 aplicada e flag ON em janela controlada) | curl | `parental-consent-session` retorna `consent_request_id` | HTTP 200 + body com request_id |
| 5.7 | Safety Signals (apenas se Fase 3 aplicada e flag ON em janela controlada) | curl | `safety-event-ingest` retorna `decision` | HTTP 200 + decision |
| 5.8 | Audit events (qualquer ação anterior) | SQL | `select count(*) from audit_events` cresceu | ≥ 1 evento novo registrado |
| 5.9 | Webhooks | dashboard | webhook_endpoints registrados ainda válidos | sim |
| 5.10 | Stubs SD-JWT VC e ZKP/BBS+ | feature flags | `AGEKEY_CREDENTIAL_MODE_ENABLED` e `AGEKEY_PROOF_MODE_ENABLED` ainda em `false` | confirmado |
| 5.11 | Feature flags coerentes | env + secrets | mesmas flags entre Vercel e Supabase | confirmado |
| 5.12 | `supabase migration list` | CLI | mostra 29 migrations alinhadas | local = remoto, sem mismatch |

**Critério de saída**: 12 ✅, com particularidade de que 5.6 e 5.7
**só** rodam se a respectiva fase tiver sido aplicada **E** o produto
autorizar habilitar a flag temporariamente para teste (ou criar tenant
de smoke específico).

**Se qualquer falhar**: parar, investigar, registrar em execution
report. Decidir entre continuar (se cosmético), rollback (se crítico)
ou abrir incidente.

---

## Fase 6 — Relatório final

**Após** execução real (futura) das Fases 1–5, criar:

`docs/audit/prod-migration-application-report.md`

Conteúdo obrigatório:

1. **Cabeçalho**: SHA da `main` aplicada, project ref, timestamp de
   início/fim, snapshot ID pré-aplicação.
2. **Resumo executivo**: quais fases foram aplicadas (1, 2, 3, 4 ou
   subset), quais foram puladas, e por quê.
3. **Output de cada comando**: `psql` outputs, mensagens de
   `BEGIN/COMMIT`, contagens de linhas afetadas.
4. **Smoke tests por fase**: tabela com resultado de cada teste com
   timestamp.
5. **Anomalias** encontradas: qualquer warning, erro recuperável,
   tempo de execução fora do esperado.
6. **Tempo total**: tempo de cada fase + tempo total + tempo de
   downtime efetivo (se houver).
7. **Decisões tomadas em runtime**: ex.: "decidimos não aplicar
   Fase 3 porque produto não estava pronto".
8. **Rollback** (se acionado): qual fase, motivo, comandos
   executados, estado pós-rollback.
9. **Pendências pós-deploy**: itens deferidos para PRs futuras.
10. **Confirmação de princípios**: zero KYC, zero PII em payload
    público, zero ZKP/SD-JWT em produção, zero score universal,
    zero interceptação, zero spyware.
11. **Próximas ações**: monitorar CRON, watch dashboards Vercel +
    Supabase por 24h, etc.
12. **Anexos**: snapshots de `supabase migration list` antes/depois,
    counts de tabelas-chave antes/depois.

**Não criar este relatório agora.** Será criado depois da execução
real, quando autorizada.

---

## Critérios globais de não-execução

Esta sessão **não executa** nenhuma das fases acima. Para qualquer
fase ser executada de fato, é obrigatório:

1. Autorização **expressa** do usuário, indicando exatamente quais
   fases devem rodar.
2. Confirmação de que Fase 0 está integralmente concluída.
3. Janela de manutenção declarada por escrito.
4. Snapshot Ready confirmado.
5. Plano de rollback à mão.
6. Stakeholder de produto alinhado para Fases 2 e 3.

---

## Referência cruzada

- Diagnóstico: `docs/audit/prod-schema-gap-diagnostic-report.md`.
- Plano original (overview): `docs/audit/prod-migration-history-reconciliation-plan.md`.
- Plano de HML (referência de processo): `docs/audit/hml-migration-history-reconciliation-plan.md`.
- Execução de HML (referência de processo): `docs/audit/hml-migration-history-reconciliation-execution-report.md`.
