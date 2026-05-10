# PROD Consent — Revisão final Go/No-Go (read-only)

> **Status**: Revisão consolidada **somente leitura**. Nenhuma ação executada nesta rodada. Aguarda decisão executiva (produto/legal/DPO).
>
> Project ref PROD: `tpdiccnmsnjtjwhardij` — não tocado.
> Project ref HML: `wljedzqgprkpqhuazdzv` — base validada.
> Commit `main` na revisão: `ba2c536b13398dce0f831a389c18eab0f0e9902c` (post-PR #77).
> Escopo: somente AgeKey Consent. Safety **fora**.

---

## 1. Estado atual consolidado

### 1.1. `main`

- HEAD: `ba2c536b` (post-PR #77, doc-only).
- Suite: `pnpm test` 359/359 ✅
- Typecheck packages/admin verde ✅ (`apps/website` ainda com falha pré-existente de deps; **não bloqueia** Edge Functions / packages / admin).
- Lint: clean (1 warning a11y pré-existente). ✅
- Migrations versionadas: 31 arquivos (`000`–`017` + `020`–`031`).
- Edge Functions versionadas: 33 (19 Core + 7 Consent + 7 Safety).

### 1.2. HML (`wljedzqgprkpqhuazdzv`)

- 30 entradas em `schema_migrations` (`000`–`017` + `020`–`030` + `031` registrada como `20260509222948`).
- 33 Edge Functions ativas, 33/33 com `verify_jwt: false`.
- Convenção `verify_jwt: false` 100% padronizada.
- TENANT_API_KEY ativa: hash `5365b30c…` (PR #75).
- `consent-smoke.sh` validado **8/8 passos** end-to-end (`docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md`).
- Safety metadata-only operacional (event-ingest, rule-evaluate, rules-write, 9 privacy guards); pendentes apenas alert-dispatch/step-up (precisam alert real) e cron (precisam SAFETY_CRON_SECRET).
- env var `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` ativa em HML — **não deve estar em PROD**.

### 1.3. PROD (`tpdiccnmsnjtjwhardij`) — read-only, sem alteração

- Schema atual: Phase 1 — Core + migration `017_fix_tenant_self_access` (ref: `docs/audit/prod-phase-1-migration-017-execution-report.md`).
- Migrations 020–031: **NÃO aplicadas**.
- Edge Functions Consent: **NÃO deployadas**.
- Edge Functions Safety: **NÃO deployadas**.
- Feature flags Consent: **OFF** (default → 503 defensivo).
- Provider OTP: **a confirmar pelo operador** antes da janela.
- Backup recente: a confirmar no momento da janela.

---

## 2. Escopo aprovado para esta janela (Consent-only)

### 2.1. Migrations a aplicar — **5 obrigatórias + 1 opcional**

| Ordem | Migration | Tipo | Necessidade |
|---|---|---|---|
| 1 | `020_parental_consent_core.sql` | DDL aditivo | **obrigatória** |
| 2 | `021_parental_consent_guardian.sql` | DDL aditivo | **obrigatória** |
| 3 | `022_parental_consent_rls.sql` | RLS defensivo | **obrigatória** |
| 4 | `023_parental_consent_webhooks.sql` | Triggers de webhook | **obrigatória** |
| 5 | `031_fix_guardian_contacts_store.sql` | CREATE OR REPLACE FUNCTION | **obrigatória** (corrige bug de pgsodium em managed Supabase) |
| 6 | `030_enable_rls_audit_billing_partitions.sql` | RLS em partições audit/billing pré-existentes | **opcional** (endurecimento defensivo, recomendado) |

**Confirmação dirigida ao operador**: 020-023 + 031 bastam. 030 é defensivo e **recomendado** mas **não bloqueante**.

### 2.2. Edge Functions a deployar — **exatamente 7**

| Slug | Versão atual em HML (referência) |
|---|---|
| `parental-consent-session` | v23 |
| `parental-consent-guardian-start` | v22 |
| `parental-consent-confirm` | v22 |
| `parental-consent-session-get` | v22 |
| `parental-consent-text-get` | v22 |
| `parental-consent-token-verify` | v23 |
| `parental-consent-revoke` | v22 |

Em PROD, primeiro deploy → `version=1` para cada uma. Todas com `--no-verify-jwt`. Todas com `verify_jwt: false`.

### 2.3. Env vars / secrets a configurar em PROD (Supabase Dashboard)

| Variável | Valor | Status |
|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | provider real (ex.: `twilio`, `mailgun`) — **nunca `noop`** | ⚠ pré-requisito; bloqueador se ausente |
| Secrets do provider (depende) | ex.: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | ⚠ pré-requisito |
| `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` | URL pública real do painel parental PROD | ⚠ pré-requisito |
| `AGEKEY_PARENTAL_CONSENT_PANEL_TTL_SECONDS` | default `86400` (24h) — opcional override | opcional |
| `AGEKEY_PARENTAL_CONSENT_TOKEN_TTL_SECONDS` | default `3600` (1h) — opcional override | opcional |
| `AGEKEY_PARENTAL_CONSENT_DEFAULT_EXPIRY_DAYS` | default `365` — opcional override | opcional |

### 2.4. Feature flags — estado durante a janela

| Flag | Estado **antes** das migrations | Estado **antes** dos deploys | Estado **antes** do smoke |
|---|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | OFF / não definida | OFF / não definida | **ON** (final da Fase 2 do runbook) |
| `AGEKEY_SAFETY_ENABLED` | OFF / não definida | OFF / não definida | OFF / não definida |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | **NÃO setar** | **NÃO setar** | **NÃO setar** (proibido em PROD) |

A flag `AGEKEY_PARENTAL_CONSENT_ENABLED` deve ser ligada **apenas após**:
1. Migrations Consent aplicadas.
2. Edge Functions Consent deployadas com `--no-verify-jwt`.
3. Provider OTP real configurado.
4. Smoke pré-ativação retornou 503 (provando defensiva ativa).

### 2.5. Smoke tests pós-release

#### 2.5.1. Pré-ativação (com flag OFF)

- 1 chamada a `parental-consent-session` esperando **HTTP 503 ServiceUnavailableError** com `reason_code: SYSTEM_INVALID_REQUEST`.
- Confirma plumbing OK + módulo defensivamente desligado.

#### 2.5.2. Pós-ativação (com flag ON)

`scripts/smoke/consent-smoke.sh` adaptado para PROD. **8 passos**:

1. `parental-consent-session` → HTTP 200 + consent_request_id.
2. `parental-consent-session-get/<id>?token=…` → HTTP 200, status=awaiting_guardian.
3. `parental-consent-text-get/<id>?token=…` → HTTP 200, text_body + text_hash.
4. `parental-consent-guardian-start/<id>` → HTTP 200, **dev_otp = null** (PROD), contact_masked aplicado.
5. (manual) operador pega OTP recebido em email/SMS no contato configurado.
6. `parental-consent-confirm/<id>` (com OTP real) → HTTP 200, parental_consent_id, token.jwt.
7. `parental-consent-token-verify` (positivo) → HTTP 200, valid=true.
8. `parental-consent-revoke/<parental_consent_id>` → HTTP 200, revoked_at.
9. `parental-consent-token-verify` (pós-revoke) → HTTP 200, valid=false, revoked=true, reason_code=TOKEN_REVOKED.

#### 2.5.3. Checagens manuais obrigatórias

- ❌ Zero PII em qualquer resposta pública (email/telefone/CPF/RG/birthdate/name em texto claro).
- ✅ `contact_masked` aplicado.
- ✅ JWT minimizado (sem birthdate/email/child_ref em claro).
- ✅ `decision_envelope.content_included = false` e `pii_included = false`.
- ✅ `audit_events_<partição_atual>` cresceu com volume esperado.
- ✅ Logs Edge Function sem stack trace inesperado.

### 2.6. Rollback — possíveis vs proibidos

#### 2.6.1. Rollback **rápido** (recomendado para problemas operacionais)

```
Dashboard Supabase PROD → Settings → Edge Functions → Environment variables
→ Editar AGEKEY_PARENTAL_CONSENT_ENABLED para "false" (ou deletar)
→ Salvar
```

- Workers reciclam em ~30s.
- 7 funções Consent voltam a responder `503` por design.
- Tráfego interrompido sem perda de dados.
- **Tempo: < 2 minutos.**

#### 2.6.2. Rollback de função específica (bug em deploy)

- Dashboard Supabase → Edge Functions → "Restore" versão anterior da função.
- Útil se houver bug isolado em uma das 7 funções.

#### 2.6.3. ⛔ Rollback de migrations — **NÃO automático**

- 020-023 + 031 fazem `CREATE TABLE`, `CREATE INDEX`, `CREATE OR REPLACE FUNCTION`.
- Reverter exige `DROP TABLE` cascata → **perde dados de consent já criados**.
- Decisão sob aprovação produto/legal + DBA on-call.
- **Regra absoluta**: nunca rollback automático de migration em PROD.

---

## 3. Fora de escopo (confirmação expressa)

### 3.1. Safety Signals — diferido

- ❌ Migration `024_safety_signals_core.sql` — **NÃO aplicar**.
- ❌ Migration `025_safety_signals_rls.sql` — **NÃO aplicar**.
- ❌ Migration `026_safety_signals_webhooks.sql` — **NÃO aplicar**.
- ❌ Migration `027_safety_signals_seed_rules.sql` — **NÃO aplicar**.
- ❌ 7 Edge Functions Safety — **NÃO deployar**:
  - `safety-event-ingest`
  - `safety-rule-evaluate`
  - `safety-rules-write`
  - `safety-alert-dispatch`
  - `safety-step-up`
  - `safety-aggregates-refresh`
  - `safety-retention-cleanup`
- ❌ Flag `AGEKEY_SAFETY_ENABLED` — **NÃO setar / OFF**.
- ❌ Secrets cron Safety (`SAFETY_CRON_SECRET`) — **NÃO configurar**.

Justificativa: Safety v1 é metadata-only por design, mas exige RIPD próprio (LGPD: tratamento de relacionamento adulto-menor é base legal sensível). Ficará para janela posterior com seu próprio memo de decisão.

### 3.2. Migrations cross-cutting que **NÃO** vão nesta janela

- ❌ `028_retention_cron_schedule.sql` — **defer**. Cron schedule do `retention-job` requer `agekey.cron_secret` GUC + `agekey.retention_job_url` GUC; aplicar apenas quando provider OTP e cron estiverem definidos para PROD. Não bloqueia Consent MVP (retention-job pode ser invocado manualmente até lá).
- ❌ `029_post_merge_p0_fixes.sql` — **NÃO aplicar como está**. Contém 3 RPCs: (1) `set_current_tenant` (genérico, OK), (2) `safety_recompute_messages_24h` que **referencia tabelas safety_events/safety_interactions** — vai **falhar** sem 024-027 aplicadas; (3) `build_parental_consent_event_payload` v2 (relevante para Consent). Aplicar exigiria cherry-pick em migration nova — **fora do escopo desta rodada por orientação do operador**. Sem ela, webhook Consent usa `build_parental_consent_event_payload` v1 da migration 023 — payload é entregue e assinado HMAC; apenas o campo `payload_hash` segue cálculo v1. Não é bloqueador funcional.

### 3.3. Outros itens explicitamente fora

- ❌ **ZKP** (Zero-Knowledge Proof real) — não nesta janela. Adapter `zkp` continua com stub canônico em Core; não é ativado em PROD.
- ❌ **SD-JWT VC real** (Selective Disclosure JWT Verifiable Credential) — não nesta janela. Adapter `vc` continua com stub canônico; não é ativado em PROD.
- ❌ **Gateways novos** — não nesta janela. Adapter `gateway` continua com stub canônico; nenhum integrador externo conectado.
- ❌ **Smoke UI no painel admin PROD** — opcional pós-release, não obrigatório nesta rodada.
- ❌ **Tenant API key adicional além do piloto** — gestão posterior; piloto controlado primeiro.

---

## 4. Comandos propostos (não executados)

### 4.1. Pré-flight

```bash
# Não executar nesta revisão; é referência do runbook
git fetch origin
git checkout main
git pull origin main
git rev-parse HEAD       # registrar SHA exato da janela
pnpm test                # esperado: 359/359 ou superior
```

### 4.2. Aplicar migrations (na ordem) — via `mcp__apply_migration` em PROD

```python
# REVISÃO ONLY — não chamar
mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="020_parental_consent_core",
  query=<SQL exato de supabase/migrations/020_parental_consent_core.sql>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="021_parental_consent_guardian",
  query=<SQL exato>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="022_parental_consent_rls",
  query=<SQL exato>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="023_parental_consent_webhooks",
  query=<SQL exato>)

mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="031_fix_guardian_contacts_store",
  query=<SQL exato de supabase/migrations/031_fix_guardian_contacts_store.sql>)

# Opcional defensiva:
mcp__apply_migration(project_id="tpdiccnmsnjtjwhardij",
  name="030_enable_rls_audit_billing_partitions",
  query=<SQL exato>)
```

### 4.3. Deploy Edge Functions Consent (CLI local pelo operador)

```bash
# REVISÃO ONLY — não executar
export SUPABASE_PROJECT_REF=tpdiccnmsnjtjwhardij  # PROD — confirmar duas vezes
export SUPABASE_ACCESS_TOKEN=<token de PROD; nunca commitar>

for fn in \
  parental-consent-session \
  parental-consent-guardian-start \
  parental-consent-confirm \
  parental-consent-session-get \
  parental-consent-text-get \
  parental-consent-token-verify \
  parental-consent-revoke
do
  supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt
done
```

⛔ **Não usar** o workflow `Deploy HML Edge Functions` — ele tem `wljedzqgprkpqhuazdzv` (HML) hardcoded. Para PROD, o caminho recomendado é workflow novo dedicado a PROD em PR separado, **antes da janela**.

### 4.4. Validação pós-deploy (read-only via MCP)

```python
# REVISÃO ONLY — chamar somente na janela autorizada
mcp__list_edge_functions(project_id="tpdiccnmsnjtjwhardij")
# Esperado:
#   - 7 novas funções parental-consent-* presentes
#   - cada uma com verify_jwt: false
#   - 19 Core inalteradas
#   - 0 funções safety-*
```

### 4.5. Habilitar feature flag

```
Dashboard Supabase PROD → Settings → Edge Functions → Environment variables
→ Adicionar AGEKEY_PARENTAL_CONSENT_ENABLED = true
→ Salvar
→ (forçar reciclagem de workers via deploy noop de uma função)
```

### 4.6. Smoke pós-ativação

```bash
# REVISÃO ONLY — operador rodará na janela
export BASE_URL=https://tpdiccnmsnjtjwhardij.functions.supabase.co
export TENANT_API_KEY=<chave piloto PROD>
export APPLICATION_SLUG=<slug piloto PROD>
export POLICY_SLUG=<slug policy PROD>
export CHILD_REF_HMAC=$(printf 'smoke-prod-%s' "$(date +%s)" | openssl dgst -sha256 -hex | awk '{print $2}')
export DEV_CONTACT_VALUE="<contato real do operador para receber OTP>"

bash scripts/smoke/consent-smoke.sh
```

---

## 5. Matriz de risco consolidada

### 5.1. Riscos bloqueantes (resolver antes do go-live)

| # | Risco | Severidade | Mitigação obrigatória antes da janela |
|---|---|---|---|
| **R1** | Provider OTP real não configurado em PROD | Crítica | `deliverOtp` lança por design quando provider=noop e DEV_RETURN_OTP=false; **bloqueador**. Operador deve configurar provider real (Twilio/Mailgun/SES/Sinch/Zenvia/etc.) e validar deliverability em sandbox do provider antes da janela. |
| **R2** | RIPD/análise legal Consent não fechada | Alta | Memo `docs/release/prod-consent-legal-product-decision-memo.md` deve estar assinado por produto + legal/DPO + tech lead. |
| **R3** | Backup recente PROD não confirmado | Alta | Operador confirma snapshot Supabase < 24h antes da janela; registra `backup_id`. |
| **R4** | Tenant API key piloto PROD não emitida | Média | Plano de emissão das primeiras keys via `applications-write` ou bootstrap em PROD; raw custodiada exclusivamente pelo operador. |
| **R5** | Workflow PROD GHA não criado | Média | Se operador preferir workflow auditável vs CLI manual: criar `.github/workflows/deploy-prod-edge-functions.yml` em PR separado **antes** da janela, com confirmação `DEPLOY_PROD_EDGE_FUNCTIONS_CONSENT` e project ref hardcoded. |

### 5.2. Riscos operacionais (mitigáveis na janela)

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R6 | Confusão HML vs PROD em comandos do operador | Crítica (mas mitigável) | Project ref **sempre** hardcoded e visível em cada comando; operador confirma duas vezes; runbook explícito |
| R7 | `--no-verify-jwt` esquecido em algum deploy | Alta | Loop `for fn in ...` no runbook garante consistência; checagem pós-deploy via MCP confirma `verify_jwt: false` |
| R8 | Migration 029 cross-cutting deferida → webhook payload v1 sem `payload_hash` v2 | Baixa | Documentado; será corrigido na janela Safety |
| R9 | Cron retention não agendado (028 deferida) | Baixa | `retention-job` pode ser invocado manualmente até janela 028 |
| R10 | Smoke pode revelar diferenças PROD vs HML (rate limit, timeouts, network) | Média | Smoke faseado: pré-ativação primeiro; depois pós-ativação em janela controlada |

### 5.3. Riscos latentes (monitorar pós-release)

| # | Risco | Mitigação contínua |
|---|---|---|
| R11 | Provider OTP delivery rate baixa | Monitor `delivered=false` em audit_events; SLA do provider |
| R12 | Vault encryption performance em alto volume | Monitor latência de `guardian-start`; rate-limit por consent_request_id já existe |
| R13 | Webhook fan-out backpressure | Monitor `webhooks-worker` execution_time |
| R14 | Tenant pode usar `child_ref_hmac` que de fato é PII | Privacy Guard rejeita PII conhecida; revisão contratual com tenant |

### 5.4. Riscos legais/governança (decisão de produto + legal)

| # | Risco | Aceito por |
|---|---|---|
| R15 | LGPD: contato do responsável é PII; tratado em vault e via provider terceiro | DPO assina memo |
| R16 | Comunicação tenant piloto: uso e responsabilidades | Contrato com cláusula específica antes |
| R17 | Reversibilidade: clientes precisam saber que podem revogar | UX do painel parental cobre |
| R18 | Auditoria interna trimestral | Compromisso pós-release |

---

## 6. Checklist Go/No-Go consolidado

| # | Item | Necessário? | Estado atual |
|---|---|---|---|
| **A** | **Validação técnica** | | |
| A.1 | HML validada ponta-a-ponta (8/8 steps) | obrigatório | ✅ |
| A.2 | `main` em commit auditável (`ba2c536b` ou descendente) | obrigatório | ✅ |
| A.3 | Suite verde (`pnpm test` 359/359) | obrigatório | ✅ |
| A.4 | Migrations Consent identificadas (020-023, 031, 030 opcional) | obrigatório | ✅ |
| A.5 | 7 Edge Functions Consent identificadas | obrigatório | ✅ |
| A.6 | Safety NÃO listado | obrigatório | ✅ |
| **B** | **Configuração de ambiente** | | |
| B.1 | Provider OTP real configurado em PROD | obrigatório | ⏸ pendente operador |
| B.2 | Secrets do provider em PROD | obrigatório | ⏸ pendente operador |
| B.3 | `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` em PROD | obrigatório | ⏸ pendente operador |
| B.4 | `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` **NÃO definida** em PROD | obrigatório | ⏸ pendente operador |
| **C** | **Backup e recuperação** | | |
| C.1 | Snapshot Supabase PROD < 24h | obrigatório | ⏸ pendente operador |
| C.2 | Plano de rollback compreendido pelo operador | obrigatório | ⏸ pendente operador |
| **D** | **Tenant piloto** | | |
| D.1 | Tenant piloto criado em PROD | obrigatório | ⏸ pendente operador |
| D.2 | Application piloto criada com `status=active` | obrigatório | ⏸ pendente operador |
| D.3 | Policy piloto criada (slug definido) | obrigatório | ⏸ pendente operador |
| D.4 | `consent_text_versions` ativo (locale `pt-BR`) | obrigatório | ⏸ pendente operador |
| D.5 | Raw TENANT_API_KEY custodiada por operador (nunca em chat/log) | obrigatório | ⏸ pendente operador |
| **E** | **Decisão executiva** | | |
| E.1 | Memo legal/produto assinado | obrigatório | ⏸ pendente decisor |
| E.2 | RIPD do AgeKey Consent v1 aceito | obrigatório | ⏸ pendente decisor |
| E.3 | Tenant piloto ciente da janela e dos termos | obrigatório | ⏸ pendente operador + tenant |
| E.4 | Janela de manutenção definida (UTC) | obrigatório | ⏸ pendente operador |
| E.5 | Operador responsável definido | obrigatório | ⏸ pendente operador |
| E.6 | Plantão DBA on-call (caso §2.6.3) | obrigatório | ⏸ pendente operador |
| **F** | **Workflow de deploy PROD** | | |
| F.1 | Workflow `Deploy HML Edge Functions` NÃO será usado | obrigatório | ✅ documentado |
| F.2 | Workflow PROD novo OU plano CLI confirmado | obrigatório | ⏸ pendente operador |
| F.3 | `--no-verify-jwt` em todos os 7 deploys | obrigatório | ✅ documentado |
| F.4 | `SUPABASE_ACCESS_TOKEN` para PROD configurado (se workflow) | condicional | ⏸ pendente operador |

**Critério para GO**: todos A.* + B.* + C.* + D.* + E.* + F.* = ✅ ou cumpridos no momento da janela.

**Critério para NO-GO**: qualquer item B.* ou E.* vermelho/pendente.

---

## 7. Decisão pendente

### 7.1. O que precisa ser decidido **antes** de abrir a janela

1. ✅ Aprovar **escopo** (Consent-only, Safety fora) — depende de produto/legal/DPO assinarem o memo.
2. ⏸ **Provider OTP real** escolhido e contratado — operador + produto.
3. ⏸ **Tenant piloto** definido (lista de empresas/clientes) — produto.
4. ⏸ **Janela de manutenção** definida (data/hora UTC) — operador + produto + tenant.
5. ⏸ **Operador responsável** nomeado para a janela — operador.
6. ⏸ **Memo legal/produto assinado** — produto + legal/DPO + tech lead.
7. ⏸ **RIPD Consent v1** aceito formalmente — DPO.
8. ⏸ **Decisão sobre criação de workflow GHA PROD** vs CLI manual — operador (recomendação: workflow auditável).

### 7.2. O que **NÃO** precisa ser decidido nesta rodada

- ❌ Safety (terá memo + janela próprios depois).
- ❌ ZKP / SD-JWT VC / gateways novos (roadmap separado).
- ❌ Cron retention 028 (defer; pode ser janela posterior independente).
- ❌ Migration 029 (cross-cutting; aplicar com janela Safety futura, com cherry-pick se necessário).

---

## 8. Recomendação final

### 8.1. Avaliação técnica — ✅ Pronto

A camada técnica está **pronta** para release Consent em PROD:

- HML validado ponta-a-ponta (8/8 steps).
- Bugs identificados em HML resolvidos (DecisionEnvelope offset, vault.create_secret, token-verify column, env var DEV_RETURN_OTP, 4 rotações TENANT_API_KEY).
- Documentação completa: readiness + runbook + checklist + memo.
- Migrations limpas (020-023 + 031, ordem definida).
- Edge Functions deployáveis com `--no-verify-jwt` e `verify_jwt: false`.
- Plano de rollback rápido (< 2 min via flag).

### 8.2. Avaliação de governança — ⏸ Pendente decisão executiva

Para proceder com a janela, depende de:

- Decisão produto/legal/DPO sobre escopo (escrita + assinada).
- Configuração operacional do provider OTP em PROD.
- Identificação do tenant piloto + comunicação contratual.
- Janela e responsável definidos.

### 8.3. Posição

**Recomendação**: estamos **TECNICAMENTE Go** para uma janela controlada de release Consent em PROD assim que os 7 itens da §7.1 sejam cumpridos. **GOVERNANÇA é o gate atual**, não engenharia.

**Sugestão de sequência**:
1. Decisão executiva (memo assinado): T-7 dias.
2. Configuração provider OTP + tenant piloto + comunicação: T-3 dias.
3. Janela de manutenção: T-0 (~2h, com Fases 0–4 do runbook).
4. Observação intensa: T+0 a T+72h.
5. Postmortem: T+72h.

### 8.4. Avisos finais

- ⚠ **Não executar nada em PROD sem autorização explícita de operação** (não apenas de revisão).
- ⚠ A `TENANT_API_KEY` PROD é responsabilidade do operador desde o momento da emissão; nunca em chat, log, commit, PR ou comentário.
- ⚠ Safety **não** entra nesta janela — adicionar Safety na mesma janela aumenta superfície de risco e força fechar 2 RIPDs em paralelo. Manter separado.
- ⚠ `apps/website` ainda tem build quebrado em main (deps Next/Node ausentes). Não bloqueia Edge Functions / packages / admin. PR separado quando convier.

---

## 9. Confirmações de não-ação (esta revisão)

- ❌ **PROD intocada.** Zero chamadas MCP contra `tpdiccnmsnjtjwhardij`.
- ❌ Nenhum `db push`, `migration repair`, `db reset`, `db pull` em qualquer ambiente.
- ❌ Nenhum SQL aplicado em qualquer ambiente.
- ❌ Nenhum deploy executado.
- ❌ Nenhuma alteração de feature flags.
- ❌ Nenhuma alteração de schema, migrations, RLS, dados ou secrets.
- ❌ Nenhum segredo exposto.
- ❌ Nenhuma raw TENANT_API_KEY solicitada nem registrada.
- ❌ Nenhuma migration nova criada.
- ❌ Nenhum código runtime alterado.
- ❌ Nenhuma alteração de workflow.
- ✅ Apenas: consolidação de leitura dos documentos preparatórios já em `main` + escrita deste relatório de revisão.

---

## 10. Referências cruzadas

| Documento | Conteúdo | Estado |
|---|---|---|
| `docs/audit/prod-consent-release-readiness-final-report.md` | Estado, recorte de migrations, dependências, riscos, go/no-go | ✅ em main (PR #77) |
| `docs/release/prod-consent-release-runbook.md` | Fase 0 → Fase 5, comandos exatos | ✅ em main (PR #77) |
| `docs/release/prod-consent-go-no-go-checklist.md` | ~70 itens, aprovação por papéis | ✅ em main (PR #77) |
| `docs/release/prod-consent-legal-product-decision-memo.md` | Memo executivo de decisão | ✅ em main (PR #77) |
| `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` | Validação HML completa (8/8) | ✅ em main (PR #76) |
| `docs/audit/prod-phase-1-migration-017-execution-report.md` | Estado atual PROD (Phase 1) | ✅ em main (anterior) |
| `docs/audit/prod-schema-gap-diagnostic-report.md` | Diagnóstico PROD pré-Phase 1 | ✅ em main (anterior) |
| Este documento | Revisão final consolidada Go/No-Go | ✅ a ser commitado |
