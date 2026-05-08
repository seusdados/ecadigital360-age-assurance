# HML — Edge Functions redeploy + smoke tests

> **Status atual**: ⏸ Workflow GitHub Action **criado** (PR #64), aguardando:
> 1. Configuração de `SUPABASE_ACCESS_TOKEN` em GitHub Secrets pelo operador.
> 2. Disparo manual do workflow `Deploy HML Edge Functions`.
> 3. Smoke tests cURL e UI pelo operador.
>
> Deploy ainda **NÃO executado**. PROD intocada.
>
> Ambiente: HML apenas (`wljedzqgprkpqhuazdzv`).
> Commit `main` usado: `c868312053ce182f9cd971408609ccbf5c426366`.
> Data: 2026-05-08.
> Branch: `claude/hml-edge-redeploy-and-smoke-report`.

## 0. Update — workflow GitHub Action substitui CLI local

A abordagem original (operador rodar `supabase functions deploy` no notebook) **não é mais viável** — operador sem notebook. Foi substituída por workflow manual em GitHub Actions, criado em PR #64:

- Arquivo: `.github/workflows/deploy-hml-edge-functions.yml`
- Plan doc: `docs/audit/hml-edge-functions-github-actions-deploy-plan.md`
- Trigger: manual (`workflow_dispatch`) com input `confirm_hml_deploy = "DEPLOY_HML_EDGE_FUNCTIONS"`
- Secret: `SUPABASE_ACCESS_TOKEN` (único)
- Defesas: HML hardcoded com guard, function-by-function, fail-fast

**Esta seção §0 substitui o §3 e o §4 abaixo no que se refere a "como executar". Os §1, §2, §5, §6, §7, §8 (estado pré-flight, BEFORE state, smoke tests, princípios, riscos) continuam válidos.**

### 0.1. Próximos passos para o operador

1. Mergear PR #64 (workflow + plan).
2. Configurar repo secret `SUPABASE_ACCESS_TOKEN` em https://github.com/seusdados/ecadigital360-age-assurance/settings/secrets/actions.
3. Disparar o workflow em https://github.com/seusdados/ecadigital360-age-assurance/actions → "Deploy HML Edge Functions" → Run workflow → digitar `DEPLOY_HML_EDGE_FUNCTIONS`.
4. Aguardar conclusão (~15–30 min para 14 functions).
5. Avisar Claude para validar via MCP `list_edge_functions`.
6. Rodar smoke tests cURL com tenant API key (§5.2 abaixo).
7. Validar UI HML (§5.3 abaixo).

### 0.2. Status checklist consolidado

- [x] Pré-flight (main em c868312, tests 351/351, HML migrations alinhadas).
- [x] BEFORE state das 14 edge functions capturado (§2).
- [x] Workflow criado (PR #64).
- [x] Plan doc criado.
- [ ] PR #64 mergeado.
- [ ] Secret `SUPABASE_ACCESS_TOKEN` configurado pelo operador.
- [ ] Workflow disparado.
- [ ] POST state validado por Claude via MCP.
- [ ] Smoke tests cURL pelo operador.
- [ ] Smoke tests UI pelo operador.
- [ ] Update final deste relatório com resultados.

## 1. Pré-flight (todos ✅)

| Etapa | Resultado |
|---|---|
| `git fetch origin && git checkout main && git pull origin main` | Já em `c868312`, up-to-date |
| `git rev-parse HEAD` | `c868312053ce182f9cd971408609ccbf5c426366` ✅ (post-PRs #55–#62) |
| `pnpm typecheck` | 6/6 ✅ |
| `pnpm lint` | clean (1 warning a11y pré-existente) ✅ |
| `pnpm test` | 27 vitest files / **351 testes** + 1 integration (10 skipped) ✅ |
| `mcp__list_migrations(wljedzqgprkpqhuazdzv)` | 29 linhas (`000`–`017`, `020`–`030`) — Local = Remote ✅ |
| Verificação dos 14 arquivos `supabase/functions/<fn>/index.ts` | Todos os 14 presentes ✅ |

## 2. Estado BEFORE das 14 edge functions em HML

Capturado via MCP `list_edge_functions(wljedzqgprkpqhuazdzv)` antes de qualquer alteração.

| Function | Status | Versão | Updated at | `ezbr_sha256` (8 chars) |
|---|---|---|---|---|
| `parental-consent-session` | ACTIVE | **v19** | 2026-05-07 17:46 UTC | `72ea25c9` |
| `parental-consent-guardian-start` | ACTIVE | v18 | 2026-05-06 14:51 UTC | `71756cfa` |
| `parental-consent-confirm` | ACTIVE | v18 | 2026-05-06 14:51 UTC | `643ec99b` |
| `parental-consent-session-get` | ACTIVE | v18 | 2026-05-06 14:51 UTC | `0edc9108` |
| `parental-consent-revoke` | ACTIVE | v18 | 2026-05-06 14:51 UTC | `e316c231` |
| `parental-consent-token-verify` | ACTIVE | v18 | 2026-05-06 14:51 UTC | `260e75c2` |
| `parental-consent-text-get` | ACTIVE | v18 | 2026-05-06 14:51 UTC | `86d23580` |
| `safety-event-ingest` | ACTIVE | v18 | 2026-05-06 14:51 UTC | `6777cf1e` |
| `safety-rule-evaluate` | ACTIVE | v18 | 2026-05-06 14:51 UTC | `7541c262` |
| `safety-rules-write` | ACTIVE | v18 | 2026-05-06 14:52 UTC | `8ceafd02` |
| `safety-alert-dispatch` | ACTIVE | v18 | 2026-05-06 14:52 UTC | `7066db26` |
| `safety-step-up` | ACTIVE | v18 | 2026-05-06 14:52 UTC | `577338ca` |
| `safety-aggregates-refresh` | ACTIVE | v18 | 2026-05-06 14:52 UTC | `b954b72b` |
| `safety-retention-cleanup` | ACTIVE | v18 | 2026-05-06 14:52 UTC | `28d000da` |

Observações:
- `parental-consent-session` está em v19 porque ontem (2026-05-07) aplicamos um hot-fix do bug `policy_version_id` (commit `a9f425f` na branch P0).
- Todas as outras 13 estão em v18, que correspondem ao deploy P0 inicial em 2026-05-06.
- **Nenhuma** das 14 funções tem o conteúdo dos PRs #62 (Consent hardening) e #61 (Safety hardening) que foram mergeados hoje em `main` (`fa5552e` e `c868312`). Confirmado pelos hashes `ezbr_sha256` antigos.

## 3. Bloqueador para deploy automático nesta sessão

| Tentativa | Resultado |
|---|---|
| `which supabase` (CLI global) | não instalado |
| `npx supabase --version` | OK (v2.98.2 baixou) |
| `npx supabase projects list` | **falha**: `Access token not provided. Supply an access token by running supabase login or setting the SUPABASE_ACCESS_TOKEN environment variable.` |
| `~/.supabase/access-token` | não existe |
| `env | grep -i supabase` | nada |

**Implicação**: a sessão atual de Claude Code **não está autenticada** no Supabase CLI. Sem `supabase login` (que abre browser) ou `SUPABASE_ACCESS_TOKEN` exportada, o comando `supabase functions deploy` **não funciona**.

### Por que não usar o MCP `deploy_edge_function` mesmo assim?

Porque ele exige bundling manual de **todos** os arquivos transitivamente importados, e as 14 funções importam:

1. Bibliotecas externas (Deno std HTTPS) — Deno resolve em runtime, não precisa bundle.
2. Helpers locais em `supabase/functions/_shared/**` — ~30 arquivos.
3. **Cross-monorepo**: `../../../packages/shared/src/**` — múltiplos arquivos por função (privacy, taxonomy, decision, retention, webhooks, parental-consent, safety, etc.).

Bundle manual de 14 funções × ~30–50 arquivos transitivos = **300+ arquivos** com risco real de:

- Faltar um arquivo → função sobe mas crasha em runtime.
- Caminho de import errado → 500 em produção.
- Inconsistência entre o `deno.json` da raiz e o que o bundler envia.

Por isso, conforme a regra do operador "**Se houver erro de deploy, pare e reporte**", paramos aqui e geramos comandos exatos para o operador rodar localmente com `supabase login` configurado.

## 4. Comandos exatos para o operador rodar (HML apenas)

### 4.1. Prep

```bash
# 1) Confirmar branch correta
cd /caminho/para/ecadigital-age-assurance
git checkout main
git pull origin main
git rev-parse HEAD  # esperado: c868312053ce182f9cd971408609ccbf5c426366

# 2) Confirmar auth
supabase login           # abre browser; OU exporte SUPABASE_ACCESS_TOKEN
supabase projects list   # deve listar AgeKey-hml + AgeKey-prod entre outros

# 3) Linkar HML (não link PROD!)
supabase link --project-ref wljedzqgprkpqhuazdzv
```

### 4.2. Deploy (14 funções, função por função)

Salve este script como `scripts/deploy/redeploy-hml-consent-safety.sh` (não commit segredo, só este script é seguro):

```bash
#!/usr/bin/env bash
# Redeploy 14 edge functions to HML (wljedzqgprkpqhuazdzv) after merge of #62 + #61.
# Run: bash scripts/deploy/redeploy-hml-consent-safety.sh 2>&1 | tee /tmp/agekey-hml-redeploy-$(date +%s).log
set -euo pipefail

PROJECT_REF="wljedzqgprkpqhuazdzv"  # HML — DO NOT change to PROD

FUNCTIONS=(
  parental-consent-session
  parental-consent-guardian-start
  parental-consent-confirm
  parental-consent-session-get
  parental-consent-text-get
  parental-consent-token-verify
  parental-consent-revoke
  safety-event-ingest
  safety-rule-evaluate
  safety-rules-write
  safety-alert-dispatch
  safety-step-up
  safety-aggregates-refresh
  safety-retention-cleanup
)

for fn in "${FUNCTIONS[@]}"; do
  echo "=========================================="
  echo "Deploying $fn to HML ..."
  echo "=========================================="
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
  echo
done

echo "All 14 functions deployed."
```

Ou, comandos individuais (mais controle entre cada um):

```bash
supabase functions deploy parental-consent-session       --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy parental-consent-guardian-start --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy parental-consent-confirm       --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy parental-consent-session-get   --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy parental-consent-text-get      --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy parental-consent-token-verify  --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy parental-consent-revoke        --project-ref wljedzqgprkpqhuazdzv

supabase functions deploy safety-event-ingest            --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy safety-rule-evaluate           --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy safety-rules-write             --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy safety-alert-dispatch          --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy safety-step-up                 --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy safety-aggregates-refresh      --project-ref wljedzqgprkpqhuazdzv
supabase functions deploy safety-retention-cleanup       --project-ref wljedzqgprkpqhuazdzv
```

Cada comando deve retornar algo como:

```
Bundling Function: parental-consent-session
Deploying Function: parental-consent-session (project ref: wljedzqgprkpqhuazdzv)
Deployed Function parental-consent-session on project wljedzqgprkpqhuazdzv
```

Se algum falhar, **PARE**, salve o stack trace e me avise — não rodar os subsequentes até resolver.

### 4.3. Validação pós-deploy (Claude faz via MCP)

Após você rodar os 14 deploys, me avise. Vou rodar:

```python
mcp__list_edge_functions(project_id="wljedzqgprkpqhuazdzv")
```

E comparar com este snapshot BEFORE — esperado:

- `version` de cada uma das 14 funções **incrementou** (v18 → v20 ou v19→v20 para `parental-consent-session`).
- `ezbr_sha256` de cada uma **mudou** (novo bundle).
- `updated_at` recente (timestamp atual).

Se algum não mudar: deploy não chegou; investigar.

## 5. Smoke tests HML

### 5.1. SQL smoke tests (Claude pode executar — read-only via MCP)

Independente do deploy, posso validar via SQL:

```sql
-- Tabelas Consent + Safety presentes
SELECT count(*) FROM information_schema.tables
WHERE table_schema='public'
AND table_name IN (
  'parental_consent_requests','parental_consents','parental_consent_revocations',
  'parental_consent_tokens','consent_text_versions','guardian_contacts','guardian_verifications',
  'safety_subjects','safety_interactions','safety_events','safety_rules',
  'safety_alerts','safety_aggregates','safety_evidence_artifacts','safety_model_runs'
);
-- Esperado: 15

-- RLS habilitado
SELECT count(*) FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relrowsecurity=true
AND c.relname LIKE ANY(ARRAY['parental_consent_%','safety_%','guardian_%','consent_text_%']);
-- Esperado: 15

-- Migrations alinhadas (000-017 + 020-030, sem 018/019)
SELECT count(*) FROM supabase_migrations.schema_migrations;
-- Esperado: 29
```

(Vou rodar essas queries assim que você confirmar deploy concluído.)

### 5.2. cURL smoke tests (operador roda — exigem tenant API key)

Os scripts já estão em main (PR #57 mergeado): `scripts/smoke/{consent,safety}-smoke.sh`.

Variáveis necessárias (obter do operador, **não commitar**):

```bash
export AGEKEY_HML_BASE_URL="https://wljedzqgprkpqhuazdzv.functions.supabase.co"
export AGEKEY_HML_TENANT_API_KEY="<sua tenant API key, NÃO commit>"
export AGEKEY_HML_APPLICATION_ID="<UUID da application em HML>"
export AGEKEY_HML_TEST_USER_REF="smoke-user-$(date +%s)"
export AGEKEY_HML_TEST_RESOURCE="smoke-resource-001"

# Os scripts de PR #57 usam BASE_URL/TENANT_API_KEY/APPLICATION_ID/USER_REF/RESOURCE
# Se quiser usar nomes AGEKEY_HML_*, precisa adaptar; ou:
export BASE_URL=$AGEKEY_HML_BASE_URL
export TENANT_API_KEY=$AGEKEY_HML_TENANT_API_KEY
export ANON_KEY=<o anon key publicável de HML, opcional>
export APPLICATION_ID=$AGEKEY_HML_APPLICATION_ID
export USER_REF=$AGEKEY_HML_TEST_USER_REF
# placeholders adicionais documentados no próprio script:
export ACTOR_REF_HMAC=$(echo -n "actor-smoke" | sha256sum | cut -d' ' -f1)
export COUNTERPARTY_REF_HMAC=$(echo -n "counterparty-smoke" | sha256sum | cut -d' ' -f1)
export CHILD_REF_HMAC=$(echo -n "child-smoke" | sha256sum | cut -d' ' -f1)
export DEV_CONTACT_VALUE="dev-test-$(date +%s)@agekey.example"
```

Rodar:

```bash
bash scripts/smoke/core-smoke.sh    # opcional, valida regressão Core
bash scripts/smoke/consent-smoke.sh # cobre 7 endpoints Consent
bash scripts/smoke/safety-smoke.sh  # cobre 7 endpoints Safety + 9 testes negativos privacy guard
```

Verificações esperadas no consent-smoke.sh (resultado esperado por linha de teste):

- create session → HTTP 200, retorna `consent_request_id`, `guardian_panel_url`, `consent_text_version_id`. **Body NÃO contém** `email`, `phone`, `cpf`, `name`, `birthdate`, `external_user_ref` raw.
- guardian-start → HTTP 200, retorna `guardian_session_id`, `verification_id`, `contact_masked`. NÃO retorna OTP em texto plano. Provider (noop em HML) registrado em log.
- text-get → HTTP 200, retorna `consent_text_version` com `body_markdown`, `body_hash`, `language`, `status`.
- confirm (manual com OTP recebido por noop log) → HTTP 200, retorna `consent_id`, `decision_envelope`, `consent_text_hash`. NÃO contém PII.
- session-get → HTTP 200, status atualizado.
- token-verify → HTTP 200, válido se não revogado.
- revoke → HTTP 200, gera audit `parental_consent_revoked`. token-verify subsequente retorna `valid=false, revoked=true, reason_code=TOKEN_REVOKED`.

Verificações esperadas no safety-smoke.sh:

- ingest evento metadata-only válido → HTTP 200, retorna `decision: no_risk_signal | logged | soft_blocked | …` e `decision_envelope`.
- **9 testes negativos** (já automatizados no script): payload com `message`, `raw_text`, `image`, `video`, `audio`, `birthdate`, `email`, `phone`, ou `raw_text` aninhado → HTTP 400, `reason_code: SAFETY_RAW_CONTENT_REJECTED` ou `SAFETY_PII_DETECTED`.
- rule-evaluate (read-only) → HTTP 200, retorna decisão sem persistir evento.
- alert-dispatch (operador admin) → HTTP 200, status alert atualiza.
- step-up → HTTP 200, retorna `decision_envelope` + `verification_session_id` (criado no Core).
- aggregates-refresh (cron Bearer) → HTTP 200 com count.
- retention-cleanup (cron Bearer) → HTTP 200; não apaga `legal_hold=true`.

Regra absoluta para Safety: `content_included=false` e `pii_included=false` em todas as respostas. Validado pelos testes negativos (HTTP 400 imediato).

### 5.3. UI smoke tests HML (operador, browser)

Não tenho acesso a browser. Operador deve verificar:

| # | Página | Esperado |
|---|---|---|
| 1 | `https://<admin-hml>/login` | login com user válido → dashboard, sem redirect-loop em `/onboarding` |
| 2 | `/onboarding` (com user novo) | aceita criação de tenant, sem 500 |
| 3 | `/dashboard` | KPIs, sidebar, sem erro |
| 4 | `/applications` | lista applications do tenant |
| 5 | `/policies` | 10 policies seed |
| 6 | `/(app)/consent` ou `/parental-consent/<id>` | painel parental carrega |
| 7 | `/(app)/safety` | overview Safety |
| 8 | `/(app)/safety/rules` | lista 5 regras seed |
| 9 | `/(app)/safety/alerts` | lista de alertas (provavelmente vazia em HML) |

Se algum 500/erro: salvar screenshot + Network panel e me reportar.

## 6. Confirmação de princípios

Esta sessão de Claude Code:

- ❌ **Não executou nada em PROD.** Verificado: zero chamadas MCP contra `tpdiccnmsnjtjwhardij`.
- ❌ **Não rodou** `supabase db push`, `migration repair`, `db reset`, `db pull` em qualquer ambiente.
- ❌ **Não alterou** schema, dados, migrations, RLS, roles, triggers em HML ou PROD.
- ❌ **Não habilitou nem desabilitou** feature flags em HML/PROD (apenas leitura via MCP).
- ❌ **Não criou novas features.** Único objetivo seria propagar hardening **já mergeado** em `main` para HML.
- ❌ **Não fez deploy** de edge functions em sessão (bloqueado por auth ausente).
- ✅ **Apenas leitura** via MCP (`list_migrations`, `list_edge_functions`).
- ✅ **Apenas geração** de relatório + comandos para operador.

## 7. Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| 1 | Operador rodar `supabase functions deploy` sem `--project-ref` ou apontando para PROD | **Crítica** | Comandos no §4.2 incluem `--project-ref wljedzqgprkpqhuazdzv` explícito; operador deve confirmar antes |
| 2 | Operador rodar `supabase db push` por engano após link de HML | Alta | **NÃO RODAR** — só `supabase functions deploy <fn>` é necessário |
| 3 | Algum deploy falhar mid-way (rede, build error) | Média | Comandos são idempotentes; rodar de novo o que falhou |
| 4 | Hardening do `parental-consent-session` interage mal com a v19 atual (que tem o fix do `policy_version_id`) | Baixa | PR #62 não removeu o fix; commit `fa5552e` herdou de `c868312` que herdou de `a9f425f` |
| 5 | Smoke tests UI mostrarem regressão em fluxo já existente | Média | Hardening foi additive (Decision Envelope opcional, audit split, flag→503); tests vitest 351/351 confirmam compat |
| 6 | OTP provider real ativado por engano (variáveis `AGEKEY_CONSENT_OTP_PROVIDER`) | Baixa | Default em HML hoje é `noop`; redeploy não muda flag |

## 8. Recomendação sobre próxima decisão de PROD

**Inalterada** desde os relatórios de PR #55 e PR #59:

- PROD permanece com Core + 017 (Phase 1 já aplicada em sessão anterior).
- **Não aplicar Consent/Safety em PROD** sem decisão de produto formalizada.
- Quando produto autorizar: seguir `docs/audit/prod-migration-application-plan.md` (já em `main`) — Phase 0 (snapshot, env vars, flags) → Phase 2 (Consent 020–023) → Phase 3 (Safety 024–027) → Phase 4 (retention/post-merge 028–030).
- Em PROD, redeploy de edge functions de Consent/Safety **só após** as migrations correspondentes estarem aplicadas. Hardening em si é compatível, mas chamar uma function que faz `INSERT INTO parental_consent_requests` antes da tabela existir gera 500.

## 9. Próximo passo concreto

1. **Você** roda os 14 `supabase functions deploy` do §4.2 em HML, com auth configurada.
2. **Você** salva o log dos 14 deploys.
3. **Você** roda smoke tests do §5.2 (consent, safety) com sua tenant API key.
4. **Você** confirma UI do §5.3 num browser.
5. **Você** me avisa o resultado.
6. **Eu** re-executo `mcp__list_edge_functions(wljedzqgprkpqhuazdzv)` e comparo versões/hashes.
7. **Eu** rodo as queries SQL do §5.1 via MCP read-only.
8. **Eu** atualizo este relatório com os resultados (commit + push no mesmo PR).

## 10. Confirmação final

- ✅ `main` em `c868312` (post-PRs #55–#62, conforme aprovação anterior).
- ✅ Tests 351/351 verde em `main`.
- ✅ HML migration history alinhado (29 entradas).
- ✅ 14 edge functions identificadas no repo.
- ⏸ Deploy HML pendente: aguarda execução pelo operador (auth ausente nesta sessão).
- ❌ PROD inalterada (zero ação).
