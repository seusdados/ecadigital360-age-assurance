# PROD — Go/No-Go Checklist por opção (Consent / Safety / Retention)

> Documento companheiro de
> `docs/audit/prod-consent-safety-release-options.md`.
> **Nada é executado** por este checklist. Todos os itens são gates
> humanos a serem confirmados antes da execução autorizada por opção.
> Data: 2026-05-07.
> Projeto-alvo: PROD `tpdiccnmsnjtjwhardij`.

## 0. Como usar

- Cada gate deve ser marcado ✅ antes de prosseguir.
- Marcar ❌ em qualquer item = **STOP** e investigar/resolver.
- Use o gate "Autorização humana explícita" no fim de cada opção como
  o único trigger de execução.
- Ordem canônica recomendada: **A → C → D → E** (ver
  `prod-consent-safety-release-options.md` §8).

---

## 1. Pré-requisitos universais (todas as opções)

Itens independentes da opção escolhida.

### 1.1. Sanity do repositório

- [ ] `pnpm typecheck` verde (5/5 packages).
- [ ] `pnpm lint` sem regressão nova.
- [ ] `pnpm test` verde (vitest, sem regressão de baseline).
- [ ] Branch a ser referenciado tem CI verde no GitHub Actions.
- [ ] SHA do release vai ser explicitamente registrado no commit
      message do "execution report" da opção.

### 1.2. HML como ground truth

- [ ] HML (`wljedzqgprkpqhuazdzv`) tem 020–030 aplicadas.
- [ ] HML `schema_migrations` tem versões sequenciais 000–030
      (PR #54 mergeado).
- [ ] HML smoke tests funcionais (Consent + Safety) passaram
      end-to-end em SHA candidata.
- [ ] HML não tem advisor crítico aberto há ≥ 24 h (`get_advisors
      type=security` e `type=performance`).

### 1.3. Backup / Snapshot PROD

- [ ] Snapshot Supabase ≤ 24 h gravado e id documentado.
- [ ] Plano de restore validado em HML (testado em rodada anterior, ou
      ensaiado fora-de-banda).
- [ ] Caminho de restore documentado em `prod-rollback-playbook-
      consent-safety.md` foi revisado por humano.

### 1.4. Flags

- [ ] Vercel (apps/admin): todas as 10 flags listadas em
      `prod-feature-flags-readiness.md` setadas `false` em PROD env.
- [ ] Supabase Edge Function secrets (`supabase secrets list
      --project-ref tpdiccnmsnjtjwhardij`): todas as 10 flags com
      `false` (ou ausentes — default).
- [ ] Default canônico
      (`packages/shared/src/feature-flags/feature-flags.ts`) confirma
      `false` para as 6 flags conhecidas pelo runtime.

### 1.5. Comunicação

- [ ] Stakeholders internos (engineering, product, support) avisados
      ≥ 24 h.
- [ ] Janela aprovada (03:00–05:00 UTC, ou janela combinada).
- [ ] Plano de "no-incidente" documentado: quem é on-call, canal de
      Slack/contato.
- [ ] Plano de rollback compartilhado.

### 1.6. Conformidade com proibições do contrato técnico

- [ ] Nenhum `supabase db push` planejado contra PROD.
- [ ] Nenhum `supabase migration repair` planejado.
- [ ] Nenhum `supabase db reset` planejado.
- [ ] Nenhum `supabase db pull` planejado.
- [ ] Toda execução é via `mcp__7a0f7dd2-...__apply_migration`
      ou SQL Editor Supabase (read-only via MCP é permitido para
      verificação).
- [ ] Nenhuma migration destrutiva incluída.
- [ ] Nenhum SD-JWT VC / ZKP / OTP real / gateway real é deployado
      simultaneamente.
- [ ] Nenhum secret comitado.

---

## 2. Opção A — Manter PROD como está

- [ ] Pré-requisitos universais §1.1, §1.4 e §1.6 ✅.
- [ ] Não há tenant comercial em onboarding Consent ou Safety.
- [ ] `supabase migration list --linked` (após `supabase link
      --project-ref tpdiccnmsnjtjwhardij`) retorna 18 linhas (000–017),
      sem mismatch local-only ou remote-only.
- [ ] Curl `parental-consent-session` em PROD retorna `503` /
      `400 SYSTEM_INVALID_REQUEST` (curto-circuito por flag), **sem**
      tocar banco.
- [ ] Curl `safety-event-ingest` em PROD idem.
- [ ] **Autorização humana**: produto + engenharia confirmaram que A
      é o estado desejado pelos próximos N dias.

---

## 3. Opção C — Aplicar Fase 2 (Consent: 020–023)

### 3.1. Gates de pré-aplicação

- [ ] Pré-requisitos universais §1.1 a §1.6 ✅ (todos).
- [ ] Diagnóstico de schema PROD (referência:
      `docs/audit/prod-schema-gap-diagnostic-report.md`) confirma:
  - [ ] tabelas Consent **ausentes** (nenhuma das 7).
  - [ ] tabelas Core 000–017 presentes.
  - [ ] `crypto_keys` tem 1+ chave ES256 ativa.
  - [ ] `webhook_endpoints` schema atual.
- [ ] Extension `extensions.vault` ou `supabase_vault` instalada em
      PROD (`select extname from pg_extension where extname like
      '%vault%';`).
- [ ] Migrations 020–023 conferem byte-a-byte com as aplicadas em HML
      (mesma SHA).
- [ ] PR de 020–023 (PR #36) mergeado em main há ≥ 7 dias.
- [ ] Smoke test Consent end-to-end em HML executado e verde **na
      mesma SHA candidata**.
- [ ] Plano de rollback §1 do `prod-rollback-playbook-consent-safety.md`
      revisado.

### 3.2. Gates de execução

- [ ] Operação registrada em runbook com timestamp UTC inicial.
- [ ] Snapshot final imediatamente antes de aplicar (≤ 30 min).
- [ ] `apply_migration 020` executada → verificar 5 tabelas + indexes.
- [ ] `apply_migration 021` executada → verificar Vault RPCs:
      `select proname from pg_proc where proname like
      'guardian_contacts_%';` retorna 3 linhas.
- [ ] `apply_migration 022` executada → verificar `relrowsecurity =
      true` em 7 tabelas Consent.
- [ ] `apply_migration 023` executada → verificar 4 triggers
      `parental_consent*` em `pg_trigger`.

### 3.3. Gates pós-aplicação

- [ ] `select count(*) from parental_consent_requests;` retorna 0.
- [ ] `select count(*) from consent_text_versions;` retorna 0.
- [ ] Curl `parental-consent-session` em PROD com flag OFF retorna
      curto-circuito (não toca banco).
- [ ] `get_advisors type=security` em PROD não tem novo CRITICAL.
- [ ] Logs de Edge Functions Consent não mostram erro 500.
- [ ] Tabela `schema_migrations` em PROD tem 4 novas linhas (020,
      021, 022, 023) com `name` correto.
- [ ] Período de observação ≥ 30 min sem incidente.
- [ ] **Autorização humana** explícita registrada para passar para
      Opção D ou parar em C.

---

## 4. Opção D — Aplicar Fase 3 (Safety: 024–027)

### 4.1. Gates de pré-aplicação

- [ ] Opção C concluída e estável ≥ 30 min (mesma janela) ou ≥ 24 h
      (janelas separadas).
- [ ] Pré-requisitos universais §1.1 a §1.6 ✅ atualizados (snapshot
      novo).
- [ ] Diagnóstico de schema PROD confirma tabelas Safety
      **ausentes** (nenhuma das 8).
- [ ] Tabelas Consent 020–023 presentes em PROD.
- [ ] PR de 024–027 (PR #37) mergeado em main há ≥ 7 dias.
- [ ] Smoke test Safety end-to-end em HML verde na mesma SHA.
- [ ] Plano de rollback §2 do
      `prod-rollback-playbook-consent-safety.md` revisado.
- [ ] Privacy guard `safety_event_v1` confirmado em código (rejeita
      message/raw_text/image/video/audio) — referência:
      `packages/shared/__tests__/safety-schemas.test.ts`.

### 4.2. Gates de execução

- [ ] Snapshot ≤ 30 min antes da aplicação.
- [ ] `apply_migration 024` executada → 8 tabelas + 1 view criadas.
- [ ] `apply_migration 025` executada → RLS + 2 triggers append-only.
- [ ] `apply_migration 026` executada → 2 triggers fan-out.
- [ ] `apply_migration 027` executada → 5 rows globais em
      `safety_rules`.

### 4.3. Gates pós-aplicação

- [ ] `select count(*) from safety_rules where tenant_id is null;`
      retorna 5.
- [ ] `select count(*) from safety_events;` retorna 0.
- [ ] `select count(*) from safety_alerts;` retorna 0.
- [ ] `select relrowsecurity from pg_class where relname like
      'safety_%';` — todas 8 com `true`.
- [ ] `select tgname from pg_trigger where tgname like
      '%safety%';` retorna 4+ triggers.
- [ ] Curl `safety-event-ingest` em PROD com flag OFF retorna
      curto-circuito.
- [ ] `get_advisors type=security` em PROD não tem novo CRITICAL.
- [ ] Tabela `schema_migrations` tem +4 linhas (024, 025, 026, 027).
- [ ] **Autorização humana** explícita para passar para Opção E.

---

## 5. Opção E — Aplicar Fase 4 (Retention: 028–030)

### 5.1. Gates de pré-aplicação

- [ ] Opções C e D concluídas e estáveis.
- [ ] Extension `pg_cron` instalada em PROD (`select extname from
      pg_extension where extname='pg_cron';` retorna 1 linha).
- [ ] Extension `pg_net` instalada em PROD.
- [ ] Edge Function `retention-job` deployada em PROD e responde a
      Bearer token com `200`.
- [ ] Edge Function `retention-job` em HML provou que **não apaga
      legal_hold** em test fixture (verificação manual em HML).
- [ ] GUC `agekey.retention_job_url` configurada (`SHOW
      agekey.retention_job_url;` retorna URL válida) — alternativamente,
      via `ALTER DATABASE postgres SET ...` antes de aplicar.
- [ ] GUC `agekey.cron_secret` configurada com valor que casa com
      Bearer aceito pela Edge Function `retention-job`.
- [ ] Snapshot ≤ 30 min antes da aplicação.
- [ ] PR de 028–030 (PR P0/sequência reconciliação) mergeado em main.
- [ ] Plano de rollback §§3–5 do
      `prod-rollback-playbook-consent-safety.md` revisado.

### 5.2. Gates de execução

- [ ] `apply_migration 028` executada → `select * from cron.job
      where jobname='agekey-retention-job';` retorna 1 linha com
      `schedule='0 3 * * *'`.
- [ ] `apply_migration 029` executada → `select proname from pg_proc
      where proname in ('set_current_tenant',
      'safety_recompute_messages_24h',
      'build_parental_consent_event_payload');` retorna 3 linhas.
- [ ] `apply_migration 030` executada → `select count(*) from pg_class
      where relname like 'audit_events_%' and relrowsecurity = true;`
      ≥ 13 (12 mensais + 1 default).

### 5.3. Gates pós-aplicação

- [ ] `cron.job_run_details` não acumulou erros nas próximas 24 h.
- [ ] Primeira execução do cron retornou `200` da Edge Function
      `retention-job`.
- [ ] Nenhum `legal_hold = true` foi tocado por retention (consultar
      `safety_evidence_artifacts` antes/depois — contagem igual).
- [ ] `select test, safety_recompute_messages_24h();` em PROD retorna
      bigint (idealmente 0 já que não há eventos reais ainda).
- [ ] `get_advisors type=performance` não tem novo CRITICAL.
- [ ] Tabela `schema_migrations` tem +3 linhas (028, 029, 030).
- [ ] Total `schema_migrations` em PROD = 29 linhas (000–017 +
      020–030).
- [ ] **Autorização humana** explícita registrando que Fase 4 está
      concluída e PROD está em paridade com HML (sem flag ainda ON).

---

## 6. Pós-aplicação universal (após qualquer opção)

- [ ] Execution report criado em `docs/audit/prod-phase-<n>-migration-
      <ids>-execution-report.md` com:
  - timestamps de cada passo;
  - SQL executado (cópia);
  - resultado de cada smoke test;
  - SHA do código aplicado;
  - id do snapshot;
  - eventuais incidentes.
- [ ] Diff de `schema_migrations` antes/depois capturado.
- [ ] Diff de `pg_proc` / `pg_trigger` / `pg_class` capturado.
- [ ] PR atualizando este checklist com gates marcados (cópia do
      estado real ✅/❌).
- [ ] `Database` types do admin regenerados se aplicável (após D).
- [ ] Stakeholders avisados de conclusão.

---

## 7. Critérios de no-go inegociáveis

Em qualquer momento, marque NO-GO se:

- ❌ Snapshot não pode ser capturado.
- ❌ HML não está verde no SHA candidato.
- ❌ Vault (Consent) ou pg_cron/pg_net (Retention) não disponíveis.
- ❌ Curl pré-aplicação em endpoint do módulo retorna `200` em vez de
      `503` com flag OFF (sinal de flag misconfigurada).
- ❌ Diagnóstico schema PROD não confere com expectativa (ex: tabela
      Consent já existe parcialmente).
- ❌ Advisor crítico aberto em PROD (security/performance) que não
      foi triado.
- ❌ Stakeholders não confirmaram janela.

Qualquer um destes ❌ = aborta + report + retomar em janela posterior.

---

## 8. Anexos cruzados

- `docs/audit/prod-consent-safety-release-options.md`
- `docs/audit/prod-feature-flags-readiness.md`
- `docs/audit/prod-rollback-playbook-consent-safety.md`
