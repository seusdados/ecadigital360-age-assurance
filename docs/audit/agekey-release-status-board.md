# AgeKey — Release Status Board

> Painel consolidado de estado por módulo, em HML e PROD. Atualizado em 2026-05-10 após PR #78 (commit `f4ddcb91`).
>
> Este documento é uma **visão de estado**, não plano de execução. Para execução: ver runbook companheiro.

---

## Snapshot

| Módulo | HML | PROD | Próximo gate |
|---|---|---|---|
| **Core** | ✅ Operacional | ✅ Operacional (Phase 1 + migration 017) | — |
| **Consent (parental)** | ✅ Operacional ponta-a-ponta (8/8 smoke) | ⏸ **Pending decision** (decisão executiva pendente) | Memo legal/produto + provider OTP + janela |
| **Safety Signals** | ✅ Partial OK (núcleo metadata-only + 9 privacy guards) | ❌ **Not scheduled** (fora da janela atual) | RIPD próprio + janela separada |
| **Credential / Proof** (ZKP, SD-JWT VC, gateway) | ✅ Honest stubs only (adapter registry) | ✅ Honest stubs only | Roadmap futuro (decisão de produto) |
| **Cron / Retention** (`028_retention_cron_schedule`) | ✅ Aplicada em HML | ❌ **Pending PROD decision** (defer) | Decisão sobre cron em PROD após Consent live |

---

## 1. Core

### 1.1. HML

| Item | Estado |
|---|---|
| Migrations 000-017 | ✅ aplicadas |
| 19 Edge Functions Core (`verifications-*`, `applications-*`, `policies-*`, `issuers-*`, `audit-list`, `proof-artifact-url`, `jwks`, `key-rotation`, `webhooks-worker`, `retention-job`, `trust-registry-refresh`, `tenant-bootstrap`) | ✅ deployadas, v18-v19, `verify_jwt: false` |
| Adapter registry (`zkp`/`vc`/`gateway`/`fallback`) | ✅ stubs canônicos |
| RLS habilitado | ✅ |

### 1.2. PROD

| Item | Estado |
|---|---|
| Migrations 000-017 | ✅ aplicadas (referência: `docs/audit/prod-phase-1-migration-017-execution-report.md`) |
| 19 Edge Functions Core | ✅ deployadas |
| Adapter registry | ✅ stubs canônicos |
| RLS habilitado | ✅ |

---

## 2. Consent (parental)

### 2.1. HML

| Item | Estado |
|---|---|
| Migrations 020-023 + 031 | ✅ aplicadas |
| 7 Edge Functions Consent (`parental-consent-session`, `-guardian-start`, `-confirm`, `-session-get`, `-text-get`, `-token-verify`, `-revoke`) | ✅ deployadas, v22-v23, `verify_jwt: false` |
| `consent-smoke.sh` end-to-end | ✅ 8/8 passos |
| `decision_envelope.content_included = false`, `pii_included = false` | ✅ confirmado |
| Token revogado detectado online | ✅ confirmado |
| `vault.create_secret()` em `guardian_contacts_store` | ✅ confirmado (migration 031) |
| `AGEKEY_PARENTAL_CONSENT_ENABLED=true` | ✅ |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true` | ✅ (necessário para smoke; **proibido em PROD**) |
| Provider OTP | `noop` (HML) |
| TENANT_API_KEY ativa | ✅ rotacionada (4 vezes); raw custodiada por operador |

### 2.2. PROD

| Item | Estado |
|---|---|
| Migrations 020-023 + 031 | ❌ NÃO aplicadas |
| 7 Edge Functions Consent | ❌ NÃO deployadas |
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | ❌ OFF (default 503 defensivo) |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | ❌ NÃO setar (proibido) |
| Provider OTP real | ⏸ pendente decisão + configuração |
| Tenant API key piloto | ⏸ pendente emissão |
| Memo de decisão executiva | ⏸ pendente assinatura |
| RIPD Consent v1 | ⏸ pendente formalização |
| Backup recente PROD | ⏸ a confirmar antes da janela |
| Janela de manutenção | ⏸ pendente definição |
| Operador responsável | ⏸ pendente nomeação |

**Próximo gate**: cumprir os 6 itens pendentes em PROD acima → seguir runbook (`docs/audit/prod-consent-mvp-release-runbook.md`).

---

## 3. Safety Signals

### 3.1. HML

| Item | Estado |
|---|---|
| Migrations 024-027 | ✅ aplicadas |
| 7 Edge Functions Safety (`safety-event-ingest`, `-rule-evaluate`, `-rules-write`, `-alert-dispatch`, `-step-up`, `-aggregates-refresh`, `-retention-cleanup`) | ✅ deployadas, v22, `verify_jwt: false` |
| `safety-event-ingest` (POST clean) | ✅ HTTP 200, `decision_envelope` minimizado |
| `safety-rule-evaluate` (dry-run) | ✅ HTTP 200 |
| `safety-rules-write` (admin) | ✅ HTTP 200 com contrato `{rule_code, enabled, severity, actions[], config_json}` |
| 9 Privacy Guard negative tests | ✅ todos retornam 400 (raw_text, message, image, video, audio, birthdate, email, phone, raw_text root) |
| `safety-alert-dispatch` | ⏸ requer `safety_alert_id` real; SKIP em smoke padrão |
| `safety-step-up` | ⏸ requer `safety_alert_id` real; SKIP em smoke padrão |
| `safety-aggregates-refresh` (cron) | ⏸ requer `SAFETY_CRON_SECRET`; SKIP em smoke público |
| `safety-retention-cleanup` (cron) | ⏸ idem |

### 3.2. PROD

| Item | Estado |
|---|---|
| Migrations 024-027 | ❌ **NÃO aplicar nesta rodada** (Safety fora) |
| 7 Edge Functions Safety | ❌ **NÃO deployar nesta rodada** |
| `AGEKEY_SAFETY_ENABLED` | ❌ NÃO setar / OFF |
| `SAFETY_CRON_SECRET` | ❌ NÃO setar |
| RIPD Safety próprio | ⏸ pendente |

**Próximo gate**: janela Safety **separada**, com seu próprio memo de decisão e RIPD próprio. Não na janela Consent atual.

---

## 4. Credential / Proof

### 4.1. Adapters

| Adapter | Estado HML | Estado PROD |
|---|---|---|
| `zkp` (Zero-Knowledge Proof) | ✅ Honest stub (rejeita prova; reason=ZKP_STUB_NOT_IMPLEMENTED) | ✅ Honest stub |
| `vc` (Verifiable Credential / SD-JWT VC) | ✅ Honest stub | ✅ Honest stub |
| `gateway` (Gov.br / Serpro / Receita Federal / etc.) | ✅ Honest stub (sem integrador real) | ✅ Honest stub |
| `fallback` (Liveness + OCR via parceiro) | ✅ Honest stub | ✅ Honest stub |

### 4.2. Próximos gates

- **ZKP real**: depende de issuer/holder com Digital Credentials API ou wallet específica. Roadmap separado.
- **SD-JWT VC real**: depende de adoção de wallets compatíveis. Roadmap separado.
- **Gateway real**: depende de contrato com integrador (Gov.br / Serpro / etc.). Roadmap separado.
- **Fallback real**: depende de contrato com parceiro de liveness + OCR. Roadmap separado.

Nenhum desses entra na janela Consent atual.

---

## 5. Cron / Retention

### 5.1. HML

| Item | Estado |
|---|---|
| Migration `028_retention_cron_schedule` | ✅ aplicada |
| `pg_cron` schedule `agekey-retention-job` | ✅ ativa em HML |
| GUC `agekey.retention_job_url` | ✅ configurada em HML |
| GUC `agekey.cron_secret` | ✅ configurada em HML |
| Edge Function `retention-job` | ✅ Core (já deployada) |

### 5.2. PROD

| Item | Estado |
|---|---|
| Migration `028_retention_cron_schedule` | ❌ **NÃO aplicada nesta rodada** (defer) |
| `pg_cron` schedule | ❌ NÃO ativa |
| GUCs `agekey.retention_job_url` / `agekey.cron_secret` | ❌ não configuradas |
| Edge Function `retention-job` | ✅ disponível em PROD (Core); pode ser invocada manualmente |

**Próximo gate**: decisão separada sobre janela de cron retention após Consent estabilizar em PROD.

**Workaround interim**: invocar `retention-job` manualmente quando necessário; sem cron automático.

---

## 6. Migrations cross-cutting

| Migration | HML | PROD | Notas |
|---|---|---|---|
| `028_retention_cron_schedule` | ✅ | ❌ defer | ver §5 |
| `029_post_merge_p0_fixes` | ✅ | ❌ **bloqueada** | contém `safety_recompute_messages_24h` que referencia tabelas Safety; só pode aplicar após 024-027 ou via cherry-pick em migration nova |
| `030_enable_rls_audit_billing_partitions` | ✅ | ⏸ recomendado aplicar com Consent | endurecimento defensivo de RLS em audit/billing; independente de Consent/Safety |

---

## 7. Edge Functions — versões consolidadas

### 7.1. HML

| Categoria | Quantidade | Versões | `verify_jwt` |
|---|---|---|---|
| Core | 19 | v18-v19 | `false` |
| Consent | 7 | v22-v23 | `false` |
| Safety | 7 | v22 | `false` |
| **Total HML** | **33** | — | **33/33 = `false`** |

### 7.2. PROD

| Categoria | Quantidade | Versões | `verify_jwt` |
|---|---|---|---|
| Core | 19 | v? (a confirmar via MCP no momento da janela) | `false` (assumido) |
| Consent | 0 | — | — |
| Safety | 0 | — | — |
| **Total PROD** | **19** | — | — |

---

## 8. Convenção `verify_jwt`

- HML: 33/33 funções com `verify_jwt: false` ✅ (validado via MCP `list_edge_functions` em 2026-05-09 19:32 UTC após workflow GHA com `--no-verify-jwt`).
- PROD: 19/19 Core com `verify_jwt: false` (estado atual; Consent será deployado com `--no-verify-jwt` na janela futura).
- **Convenção**: AgeKey usa `X-AgeKey-API-Key` (header) com auth próprio em `_shared/auth.ts`, **não** JWT do Supabase Auth. Toda função AgeKey deve ser deployada com `--no-verify-jwt` para evitar que a plataforma rejeite com 401 antes de chegar no código.

---

## 9. TENANT_API_KEY (HML)

- Cronologia de rotações: 4 rotações em HML (PRs #65, #68, #74, #75) por exposição em log/chat.
- Atual hash em HML (first 8): `5365b30c…` (PR #75).
- Raw key custodiada exclusivamente pelo operador. Nunca em chat/log/PR/audit.
- PROD: tenant API key piloto **a emitir** antes da janela.

---

## 10. Documentos relacionados (cross-reference)

| Eixo | Documento |
|---|---|
| Estado HML completo | `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` |
| Estado PROD Phase 1 | `docs/audit/prod-phase-1-migration-017-execution-report.md` |
| Diagnóstico de gaps PROD | `docs/audit/prod-schema-gap-diagnostic-report.md` |
| Memo de decisão Consent PROD (este pacote) | `docs/audit/prod-consent-mvp-release-decision-memo.md` |
| Runbook Consent PROD (este pacote) | `docs/audit/prod-consent-mvp-release-runbook.md` |
| Checklist Consent PROD (este pacote) | `docs/audit/prod-consent-mvp-go-no-go-checklist.md` |
| Pacote alternativo de release Consent | `docs/release/prod-consent-release-runbook.md`, `docs/release/prod-consent-go-no-go-checklist.md`, `docs/release/prod-consent-legal-product-decision-memo.md` |
| Revisão final Go/No-Go | `docs/audit/prod-consent-release-final-go-no-go-review.md` |
| Workflow GHA HML (referência) | `.github/workflows/deploy-hml-edge-functions.yml` |

---

## 11. Histórico de atualização

| Data UTC | Commit | Alteração |
|---|---|---|
| 2026-05-10 | `f4ddcb91` (após PR #78) | Versão inicial do status board. |
