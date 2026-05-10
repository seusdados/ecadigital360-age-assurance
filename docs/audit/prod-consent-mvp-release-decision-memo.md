# PROD — Memo de decisão executiva: release do AgeKey Consent MVP

> **Status**: Documento preparatório para decisão executiva. **Nada executado em PROD.** Aguarda aprovação produto + legal/DPO + tech lead. Safety **fora** desta janela.
>
> Project ref PROD: `tpdiccnmsnjtjwhardij` — não tocado.
> Project ref HML: `wljedzqgprkpqhuazdzv` — base validada.
> Commit `main` na decisão: `f4ddcb9125ceffb1f5402fd78ec4e5647f5cd38d`.
> Companheiros: `docs/audit/prod-consent-mvp-release-runbook.md`, `docs/audit/prod-consent-mvp-go-no-go-checklist.md`, `docs/audit/agekey-release-status-board.md`.

---

## 1. Estado atual de HML

### 1.1. Validação técnica

- 33 Edge Functions ativas, **33/33 com `verify_jwt: false`**.
- Migrations `000-017` + `020-031` (30 entradas em `schema_migrations`).
- Migration `031_fix_guardian_contacts_store` aplicada (vault.create_secret).
- TENANT_API_KEY ativa: hash `5365b30c…` (operada exclusivamente pelo operador).
- env var `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` em HML (necessária para smoke; **proibida em PROD**).

### 1.2. Suíte de testes (em `main`)

- `pnpm test` 359/359 ✅
- `pnpm typecheck` packages/admin verde ✅
- `pnpm -r lint` clean ✅

---

## 2. Evidência de Consent MVP end-to-end em HML

`consent-smoke.sh` passou **8/8 passos** em HML (referência: `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md`):

1. `parental-consent-session` → HTTP 200, `consent_request_id`, `guardian_panel_token`, `consent_text`, `decision_envelope.decision=pending_guardian` ✅
2. `parental-consent-session-get/<id>?token=…` → HTTP 200, `status=awaiting_guardian` ✅
3. `parental-consent-text-get/<id>?token=…` → HTTP 200, `text_body` + `text_hash` ✅
4. `parental-consent-guardian-start/<id>` → HTTP 200, `guardian_verification_id`, `contact_masked`, `dev_otp` (em HML apenas) ✅
5. `parental-consent-confirm/<id>` → HTTP 200, `parental_consent_id`, `token.jwt`, `decision=approved`, `assurance_level=AAL-C1` ✅
6. `parental-consent-token-verify` (positivo) → HTTP 200, `valid=true`, `revoked=false` ✅
7. `parental-consent-revoke/<parental_consent_id>` → HTTP 200, `revoked_at` ✅
8. `parental-consent-token-verify` (pós-revoke) → HTTP 200, `valid=false`, `revoked=true`, `reason_code=TOKEN_REVOKED` ✅

Garantias provadas:
- `decision_envelope.content_included = false`, `pii_included = false` em todos os envelopes.
- Nenhuma resposta pública contém PII (email/telefone/CPF/RG/birthdate/name) em texto claro.
- `contact_masked` aplicado.
- JWT minimizado (sem birthdate/email/child_ref em claro).
- Token revogado é detectado online.

---

## 3. Estado atual de PROD (read-only, sem ação nesta rodada)

| Item | Estado |
|---|---|
| Schema | Phase 1: Core + migration `017_fix_tenant_self_access` |
| Migrations 020-031 | ❌ NÃO aplicadas |
| Edge Functions Consent | ❌ NÃO deployadas |
| Edge Functions Safety | ❌ NÃO deployadas |
| Feature flag `AGEKEY_PARENTAL_CONSENT_ENABLED` | ❌ OFF (default → 503 defensivo) |
| Provider OTP | ⏸ A confirmar pelo operador antes da janela |
| Backup recente | ⏸ A confirmar pelo operador antes da janela |
| Tenant API key piloto PROD | ⏸ A emitir antes da janela |

Referência: `docs/audit/prod-phase-1-migration-017-execution-report.md`.

---

## 4. Diferença entre HML e PROD (delta a propagar)

| Eixo | HML | PROD após esta janela |
|---|---|---|
| Migrations 020, 021, 022, 023, 031 | ✅ aplicadas | ⇒ aplicar |
| Migrations Safety 024-027 | ✅ aplicadas (escopo HML) | ⇒ **NÃO aplicar** |
| Migration 028 (cron retention) | ✅ aplicada (HML) | ⇒ **defer** (decisão separada) |
| Migration 029 (cross-cutting) | ✅ aplicada (HML) | ⇒ **NÃO aplicar** (referencia tabelas Safety; `safety_recompute_messages_24h` não compila sem 024) |
| Migration 030 (RLS audit/billing) | ✅ aplicada | ⇒ aplicar (defensivo, recomendado) |
| 7 Edge Functions Consent | ✅ deployadas v22-v23 com `verify_jwt: false` | ⇒ deploy v1+ com `--no-verify-jwt` |
| 7 Edge Functions Safety | ✅ deployadas (HML) | ⇒ **NÃO deployar** |
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | ON (env var em HML) | ⇒ ON ao final da Fase 3 (decisão executiva) |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | ON (HML para smoke) | ⇒ **NÃO setar** (proibido em PROD) |
| `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | `noop` + `DEV_RETURN_OTP=true` (HML) | ⇒ **provider real obrigatório** (Twilio/Mailgun/SES/etc.) |
| `AGEKEY_SAFETY_ENABLED` | ON em HML | ⇒ **NÃO setar** (Safety fora) |

---

## 5. Migrations necessárias para Consent em PROD

### 5.1. Núcleo Consent — **5 obrigatórias**

| Ordem | Migration | O que faz |
|---|---|---|
| 1 | `020_parental_consent_core.sql` | Tabelas: parental_consent_requests, parental_consents, parental_consent_revocations, parental_consent_tokens, consent_text_versions |
| 2 | `021_parental_consent_guardian.sql` | Tabelas: guardian_contacts, guardian_verifications. RPC `guardian_contacts_store` (versão original; substituída por 031) |
| 3 | `022_parental_consent_rls.sql` | RLS policies para tabelas Consent |
| 4 | `023_parental_consent_webhooks.sql` | Triggers de webhook fan-out para eventos parental_consent.* |
| 5 | `031_fix_guardian_contacts_store.sql` | Substitui body de `guardian_contacts_store` para usar `vault.create_secret()`; previne `42501 permission denied for function _crypto_aead_det_noncegen` |

### 5.2. Defensiva opcional — **1 recomendada**

| Migration | O que faz |
|---|---|
| `030_enable_rls_audit_billing_partitions.sql` | Habilita RLS em partições `audit_events_*` e `billing_events_*` que já existem em PROD desde o Core |

### 5.3. **Não aplicar** nesta janela

- `024_safety_signals_core.sql` — Safety fora.
- `025_safety_signals_rls.sql` — Safety fora.
- `026_safety_signals_webhooks.sql` — Safety fora.
- `027_safety_signals_seed_rules.sql` — Safety fora.
- `028_retention_cron_schedule.sql` — defer (decisão separada quando provider OTP e cron estiverem definidos).
- `029_post_merge_p0_fixes.sql` — referencia tabelas Safety; falha sem 024.

---

## 6. Funções necessárias para Consent

7 Edge Functions (escopo Consent). Deploy via `supabase functions deploy <fn> --project-ref tpdiccnmsnjtjwhardij --no-verify-jwt`:

1. `parental-consent-session`
2. `parental-consent-guardian-start`
3. `parental-consent-confirm`
4. `parental-consent-session-get`
5. `parental-consent-text-get`
6. `parental-consent-token-verify`
7. `parental-consent-revoke`

**`--no-verify-jwt` é obrigatório**: AgeKey Consent usa autenticação própria via header `X-AgeKey-API-Key` (validada por `_shared/auth.ts`), não JWT do Supabase Auth. Sem o flag, a plataforma rejeita requests com 401 antes de chegar no código da função (regressão observada e mitigada em HML — referência: `docs/audit/hml-edge-functions-redeploy-and-smoke-report.md`).

**Não deployar Safety**: nenhuma das 7 funções `safety-*` deve ser deployada em PROD nesta janela.

---

## 7. Feature flags necessárias

| Flag | Estado durante a janela | Justificativa |
|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | OFF até Fase 3 → ON após smoke pré-ativação | Default 503 protege contra ativação prematura |
| `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | Provider **real** (`twilio`, `mailgun`, etc.) | `deliverOtp` lança quando provider=`noop` e DEV_RETURN_OTP off (`_shared/parental-consent/otp.ts:61-65`) |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | **NÃO setar / `false`** | Proibido em PROD — retornaria OTP em cleartext |
| `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` | URL pública real do painel parental PROD | Compõe o `guardian_panel_url` retornado |
| `AGEKEY_SAFETY_ENABLED` | **NÃO setar / `false`** | Safety fora desta janela |
| `SAFETY_CRON_SECRET` | **NÃO setar** | Sem Safety, sem cron Safety |
| (futuro) ZKP / SD-JWT VC real flags | OFF | Adapters continuam stubs canônicos |
| (futuro) Gateway real flag | OFF | Sem gateways novos |

---

## 8. Riscos consolidados

### 8.1. Bloqueadores antes da janela

| # | Risco | Mitigação obrigatória |
|---|---|---|
| R1 | Provider OTP real não configurado | Operador configura provider e valida deliverability em sandbox |
| R2 | RIPD Consent v1 não fechado | DPO assina antes da janela |
| R3 | Backup recente PROD não confirmado | Operador confirma snapshot < 24h, registra `backup_id` |
| R4 | Tenant API key piloto PROD não emitida | Emissão via `applications-write` ou bootstrap; raw custodiada apenas pelo operador |
| R5 | Workflow GHA PROD não criado | Recomendado: novo workflow dedicado a PROD (PR separado, **antes** da janela) com `tpdiccnmsnjtjwhardij` hardcoded e confirmação `DEPLOY_PROD_EDGE_FUNCTIONS_CONSENT` |

### 8.2. Operacionais (mitigáveis na janela)

| # | Risco | Mitigação |
|---|---|---|
| R6 | Confusão HML vs PROD em comandos | Project ref hardcoded e visível em cada comando; runbook explícito; operador confirma duas vezes |
| R7 | `--no-verify-jwt` esquecido em algum deploy | Loop `for fn in ...` no runbook; checagem pós-deploy via MCP `list_edge_functions` confirma `verify_jwt: false` |
| R8 | Migration 029 deferida → webhook payload v1 sem `payload_hash` v2 | Documentado; corrigido na janela Safety futura |
| R9 | Cron retention não agendado (028 deferida) | `retention-job` invocável manualmente até janela 028 |
| R10 | Smoke pode revelar diferenças PROD vs HML (rate limit, timeouts, network) | Smoke faseado: pré-ativação primeiro |

### 8.3. Latentes (monitorar pós-release)

| # | Risco | Mitigação contínua |
|---|---|---|
| R11 | Provider OTP delivery rate baixa | Monitor `delivered=false` em audit_events; SLA do provider |
| R12 | Vault encryption performance em alto volume | Monitor latência de `guardian-start`; rate limit já existe |
| R13 | Webhook fan-out backpressure | Monitor `webhooks-worker` execution_time |
| R14 | Tenant pode usar `child_ref_hmac` que de fato é PII | Privacy Guard rejeita PII conhecida; revisão contratual com tenant |

---

## 9. Rollback

### 9.1. Rollback **rápido** (recomendado)

```
Dashboard Supabase PROD → Settings → Edge Functions → Environment variables
→ Editar AGEKEY_PARENTAL_CONSENT_ENABLED para "false" (ou deletar)
→ Salvar
```

- Workers reciclam em ~30s.
- 7 funções Consent voltam a responder `503` por design.
- Tráfego interrompido sem perda de dados.
- **Tempo: < 2 minutos.**

### 9.2. Rollback de função específica (bug em deploy)

- Dashboard Supabase → Edge Functions → "Restore" versão anterior.

### 9.3. ⛔ Rollback de migration — **nunca automático**

- 020-023 + 031 fazem `CREATE TABLE`/`CREATE OR REPLACE FUNCTION`.
- Reverter exige `DROP TABLE` cascata → perde dados de consent já criados.
- **Requer aprovação produto/legal + DBA on-call**.

---

## 10. Smoke tests pós-release

### 10.1. Pré-ativação (flag OFF)

- 1 chamada a `parental-consent-session` esperando **HTTP 503 ServiceUnavailableError** com `reason_code: SYSTEM_INVALID_REQUEST`.
- Confirma plumbing OK + módulo defensivamente desligado.

### 10.2. Pós-ativação (flag ON)

`scripts/smoke/consent-smoke.sh` adaptado para PROD. Mesmo fluxo dos 8 passos validados em HML, com **diferenças críticas**:

- `dev_otp` **não** vai aparecer (DEV_RETURN_OTP off em PROD).
- O OTP é entregue **realmente** via provider real ao `DEV_CONTACT_VALUE` (que deve ser do operador).
- Após confirmar com OTP real, **revogar imediatamente** (Step 7) o token de teste.

### 10.3. Checagens manuais obrigatórias

- ❌ Zero PII em qualquer resposta pública.
- ✅ `contact_masked` aplicado.
- ✅ JWT minimizado.
- ✅ `decision_envelope.content_included = false`, `pii_included = false`.
- ✅ `audit_events_<partição>` cresceu por cada operação.
- ✅ Logs Edge Function sem stack trace inesperado.

---

## 11. Critérios go/no-go

### 11.1. Go (todos verdes)

- ✅ HML validada ponta-a-ponta (8/8).
- ✅ `main` em commit auditável (`f4ddcb91` ou descendente).
- ✅ Suite verde (`pnpm test` 359/359).
- ✅ Provider OTP real configurado em PROD.
- ✅ Decisão produto/legal/DPO formalizada (este memo assinado).
- ✅ Backup PROD recente confirmado.
- ✅ Janela de manutenção definida (UTC).
- ✅ Operador responsável definido.
- ✅ Tenant piloto definido + comunicado.
- ✅ Plano de rollback compreendido.
- ✅ Workflow PROD ou plano CLI definido (não usar workflow HML hardcoded).

### 11.2. No-go (qualquer um vermelho)

- ❌ Provider OTP não real (proibido `noop` em PROD).
- ❌ Decisão legal não fechada.
- ❌ Backup não confirmado.
- ❌ HML smokes regridem antes da janela.
- ❌ Sem operador responsável.

---

## 12. Recomendação técnica

**A camada técnica está pronta.** Não há débito de engenharia bloqueando o release Consent em PROD.

**O gate atual é governança**:
1. Provider OTP real configurado.
2. Memo legal/produto assinado por produto + legal/DPO + tech lead.
3. Tenant piloto + janela + operador definidos.

Quando esses 3 itens estiverem cumpridos, **recomendo Go** para janela controlada Consent-only em PROD, seguindo o runbook companheiro (`docs/audit/prod-consent-mvp-release-runbook.md`).

**Não recomendo**:
- Aplicar Safety na mesma janela (aumenta superfície e força fechar 2 RIPDs).
- Aplicar migration 029 ou 028 na mesma janela (cross-cutting; aplicar com Safety futuro).
- Usar workflow GHA HML para PROD (project ref hardcoded para HML).
- Habilitar `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` em PROD (proibido por design).

---

## 13. Decisão executiva solicitada

| Item | Aprovação |
|---|---|
| Escopo Consent-only em PROD | ☐ Aprovado ☐ Recusado |
| Safety **fora** desta janela | ☐ Confirmado |
| Provider OTP escolhido | _______________________ |
| Tenant piloto | _______________________ |
| Janela de manutenção (UTC) | _______________________ |
| Operador responsável | _______________________ |
| RIPD Consent v1 aceito | ☐ Sim ☐ Não |

**Assinaturas**:

| Papel | Nome | Data UTC | Assinatura |
|---|---|---|---|
| Produto (PO) | _____________ | _________ | _____________ |
| Legal / DPO | _____________ | _________ | _____________ |
| Engenharia (Tech Lead) | _____________ | _________ | _____________ |
| Decisão final | — | _________ | ☐ **APROVADO** ☐ **RECUSADO** |

---

## 14. Confirmações de não-ação (esta rodada)

- ❌ **PROD intocada.** Zero chamadas MCP contra `tpdiccnmsnjtjwhardij`.
- ❌ Nenhum `db push`, `migration repair`, `db reset`, `db pull`.
- ❌ Nenhuma migration aplicada.
- ❌ Nenhum SQL aplicado em qualquer ambiente.
- ❌ Nenhum deploy executado.
- ❌ Nenhuma alteração de feature flags.
- ❌ Nenhuma alteração de schema, migrations, RLS, dados ou secrets.
- ❌ Nenhuma migration nova criada.
- ❌ Nenhum código runtime alterado.
- ❌ Nenhuma raw TENANT_API_KEY solicitada ou registrada.
- ❌ Nenhuma nova funcionalidade implementada.
- ❌ Safety **não** habilitado em PROD.
- ❌ DEV_RETURN_OTP **não** habilitado em PROD.
- ✅ Apenas: 4 documentos preparatórios em `docs/audit/`.
