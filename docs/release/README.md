# AgeKey — Release Docs Index

> **Status**: Índice consolidado dos documentos de release do AgeKey.
> **Atualizado em**: 2026-05-10 (após PR #83, commit `aca35891`).
> **Próxima release prevista**: AgeKey Consent MVP em PROD (status: 🟡 **GO WITH CONDITIONS**).

---

## Status agregado da release Consent PROD

| Eixo | Estado |
|---|---|
| Camada técnica | ✅ Pronta — HML 8/8 smoke validado, bugs do ciclo corrigidos |
| Governança | ⏸ **10 bloqueadores pendentes** (provider OTP, RIPD, memo, janela, operador, DBA, backup, workflow PROD, PANEL_BASE_URL, decisão tenant) |
| PROD | Phase 1 limpa (000-017); sem migrations 020-031; sem funções Consent/Safety |
| HML | Consent MVP operacional ponta-a-ponta; Safety metadata-only operacional no núcleo |
| Decisão final | Aguarda PO + DPO + Tech Lead |

---

## Como usar este índice

Cada documento abaixo está classificado por **propósito**. Use o índice para localizar rapidamente o documento certo para a tarefa atual:

- **Decidindo se autoriza release?** → §1 (Executivo)
- **Vai conduzir a janela?** → §2 (Runbooks operacionais)
- **Incidente?** → §3 (Rollback)
- **Vai testar pós-ativação?** → §4 (Smoke tests)
- **Quer entender a decisão arquitetural?** → §5 (ADR)
- **Quer ver o estado consolidado?** → §6 (Status boards)
- **Quer histórico/auditoria?** → §7 (Auditorias)

---

## 1. Documentos executivos

Para PO, DPO, Tech Lead, CEO/Diretor. Aprovação formal de release.

| Documento | Propósito | Status atual |
|---|---|---|
| [`prod-consent-mvp-executive-go-no-go-pack.md`](./prod-consent-mvp-executive-go-no-go-pack.md) | **Pacote executivo Go/No-Go**: recomendação técnica, escopo, evidências, riscos, decisão solicitada com 4 assinaturas | 🟡 GO WITH CONDITIONS |
| [`prod-consent-legal-product-decision-memo.md`](./prod-consent-legal-product-decision-memo.md) | Memo executivo PR #77: o que será ativado, o que não, por que não é KYC, riscos residuais aceitos | Aguarda assinatura |
| [`consent-safety-prod-decision-memo.md`](./consent-safety-prod-decision-memo.md) | Memo legacy de decisão Consent+Safety em PROD (referência histórica; superseded por executive go/no-go pack para Consent-only) | Histórico |
| [`hml-to-prod-release-checklist.md`](./hml-to-prod-release-checklist.md) | Checklist legacy de transição HML→PROD (referência histórica) | Histórico |
| [`prod-consent-go-no-go-checklist.md`](./prod-consent-go-no-go-checklist.md) | Checklist Consent PR #77 (~70 itens, aprovação por papéis) | Aguarda |

## 2. Runbooks operacionais

Para o operador da janela. Contém comandos preparados marcados como **"🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL"**.

| Documento | Propósito |
|---|---|
| [`prod-consent-mvp-execution-runbook.md`](./prod-consent-mvp-execution-runbook.md) | **Runbook operacional** Fase 0 (pré-flight) → Fase 6 (critérios de abort) |
| [`prod-consent-release-runbook.md`](./prod-consent-release-runbook.md) | Runbook PR #77 (versão equivalente, paralela a `docs/audit/prod-consent-mvp-release-runbook.md`) |

## 3. Rollback

| Documento | Propósito |
|---|---|
| [`prod-consent-mvp-rollback-runbook.md`](./prod-consent-mvp-rollback-runbook.md) | **9 cenários de rollback** (C1–C9): rápido (flag OFF, < 2 min) / função específica / migration (não automático) / fallback OTP |

## 4. Smoke tests

| Documento | Propósito |
|---|---|
| [`prod-consent-mvp-smoke-test-pack.md`](./prod-consent-mvp-smoke-test-pack.md) | **Pack de smoke** para PROD (sem DEV_RETURN_OTP); validação ausência PII; validação JWT; revoke; audit; logs; quais testes NÃO fazer em PROD |

Smoke script: `scripts/smoke/consent-smoke.sh` (em main, validado em HML 8/8 passos).

## 5. ADR

| Documento | Propósito |
|---|---|
| [`../adr/ADR-AGEKEY-CONSENT-PROD-RELEASE.md`](../adr/ADR-AGEKEY-CONSENT-PROD-RELEASE.md) | Registro arquitetural: contexto, decisão proposta, 7 alternativas rejeitadas, por que Safety fora, por que DEV_RETURN_OTP fora, por que Consent é primeiro |

## 6. Status boards e readiness

| Documento | Propósito |
|---|---|
| [`../audit/agekey-release-status-board.md`](../audit/agekey-release-status-board.md) | **Painel consolidado por módulo**: Core / Consent / Safety / Credential / Cron — estado em HML e PROD |
| [`../audit/prod-consent-release-readiness-board.md`](../audit/prod-consent-release-readiness-board.md) | **Painel de 25 itens** (Item / Status / Responsável / Evidência / Risco / Próxima ação) específico do release Consent PROD |

## 7. Auditorias e histórico

### 7.1. Validação HML

| Documento | Propósito |
|---|---|
| [`../audit/hml-consent-mvp-end-to-end-smoke-success-report.md`](../audit/hml-consent-mvp-end-to-end-smoke-success-report.md) | Evidência **HML 8/8 smoke** ponta-a-ponta (após PRs #66, #70/71, #73 e cadeia de rotações TENANT_API_KEY) |
| [`../audit/hml-consent-smoke-after-migration-031-report.md`](../audit/hml-consent-smoke-after-migration-031-report.md) | Smoke pós-migration 031 em HML (descoberta dos Bugs A e B) |
| [`../audit/hml-consent-smoke-decision-envelope-datetime-fix.md`](../audit/hml-consent-smoke-decision-envelope-datetime-fix.md) | Diagnóstico do bug DecisionEnvelope offset (PR #66) |
| [`../audit/hml-guardian-contacts-store-vault-create-secret-fix.md`](../audit/hml-guardian-contacts-store-vault-create-secret-fix.md) | Diagnóstico do bug vault/pgsodium (PR #70) |
| [`../audit/hml-migration-031-guardian-contacts-store-application-report.md`](../audit/hml-migration-031-guardian-contacts-store-application-report.md) | Aplicação da migration 031 em HML (PR #71) |

### 7.2. Estado PROD

| Documento | Propósito |
|---|---|
| [`../audit/prod-phase-1-migration-017-execution-report.md`](../audit/prod-phase-1-migration-017-execution-report.md) | Histórico da Phase 1 (Core + 017) aplicada em PROD |
| [`../audit/prod-schema-gap-diagnostic-report.md`](../audit/prod-schema-gap-diagnostic-report.md) | Diagnóstico pré-Phase 1 dos gaps PROD |
| [`../audit/prod-consent-mvp-preflight-readiness-report.md`](../audit/prod-consent-mvp-preflight-readiness-report.md) | **Pré-flight read-only** com inspeção MCP de PROD (PR #81) |
| [`../audit/prod-consent-release-final-go-no-go-review.md`](../audit/prod-consent-release-final-go-no-go-review.md) | Revisão final consolidada Go/No-Go (PR #78) |

### 7.3. Pacote Consent PROD (PR #79)

| Documento | Propósito |
|---|---|
| [`../audit/prod-consent-mvp-release-decision-memo.md`](../audit/prod-consent-mvp-release-decision-memo.md) | Memo decisão (versão paralela ao memo em `docs/release/`) |
| [`../audit/prod-consent-mvp-release-runbook.md`](../audit/prod-consent-mvp-release-runbook.md) | Runbook (versão paralela) |
| [`../audit/prod-consent-mvp-go-no-go-checklist.md`](../audit/prod-consent-mvp-go-no-go-checklist.md) | Checklist (versão paralela) |
| [`../audit/prod-consent-release-governance-automation-report.md`](../audit/prod-consent-release-governance-automation-report.md) | Relatório consolidado da rodada de automação (PR #83) |

### 7.4. Rotações de credenciais (HML)

| Documento | Propósito |
|---|---|
| [`../audit/hml-tenant-api-key-rotation-2026-05-09.md`](../audit/hml-tenant-api-key-rotation-2026-05-09.md) | Rotação #1 (PR #65) — hash `1624f0d2` |
| [`../audit/hml-tenant-api-key-rotation-2026-05-09-2.md`](../audit/hml-tenant-api-key-rotation-2026-05-09-2.md) | Rotação #2 (PR #68) — hash `6a9edf77` |
| [`../audit/hml-tenant-api-key-rotation-2026-05-10.md`](../audit/hml-tenant-api-key-rotation-2026-05-10.md) | Rotação #3 (PR #74) — hash `e37743cd` |
| [`../audit/hml-tenant-api-key-rotation-2026-05-10-2.md`](../audit/hml-tenant-api-key-rotation-2026-05-10-2.md) | Rotação #4 (PR #75) — hash `5365b30c` (atual) |

### 7.5. Outros

| Documento | Propósito |
|---|---|
| [`agekey-p0-release-notes.md`](./agekey-p0-release-notes.md) | Release notes da Phase 1 (P0) — Core em PROD |
| [`../audit/agekey-env-feature-flag-matrix.md`](../audit/agekey-env-feature-flag-matrix.md) | Matriz canônica de env vars e feature flags |
| [`../audit/vercel-supabase-deploy-readiness.md`](../audit/vercel-supabase-deploy-readiness.md) | Checklist de prontidão Vercel + Supabase |
| [`../audit/hml-edge-functions-redeploy-and-smoke-report.md`](../audit/hml-edge-functions-redeploy-and-smoke-report.md) | Histórico de redeploys HML e smoke tests por ciclo |
| [`../audit/hml-smoke-contract-alignment-report.md`](../audit/hml-smoke-contract-alignment-report.md) | Alinhamento de scripts smoke aos contratos reais (PR #67) |
| [`../audit/hml-edge-functions-github-actions-deploy-plan.md`](../audit/hml-edge-functions-github-actions-deploy-plan.md) | Plano companion ao workflow GHA HML (PR #64) |

---

## 8. Workflows GitHub Actions

| Workflow | Status |
|---|---|
| `.github/workflows/deploy-hml-edge-functions.yml` | ✅ Existe; **HML hardcoded** (`wljedzqgprkpqhuazdzv`); ⚠ não usar para PROD |
| `.github/workflows/deploy-prod-edge-functions.yml` | ❌ **NÃO existe**; criar em PR separado **antes** da janela Consent PROD (recomendado) |

---

## 9. Mapa de duplicidades documentais conhecidas

Para evitar drift, alguns documentos têm versões paralelas em `docs/release/` e `docs/audit/`. **Ambas estão em main** e foram criadas em sprints diferentes; equivalentes em conteúdo:

| Tópico | `docs/release/` | `docs/audit/` |
|---|---|---|
| Memo decisão | `prod-consent-legal-product-decision-memo.md` | `prod-consent-mvp-release-decision-memo.md` |
| Runbook | `prod-consent-release-runbook.md` + `prod-consent-mvp-execution-runbook.md` | `prod-consent-mvp-release-runbook.md` |
| Checklist | `prod-consent-go-no-go-checklist.md` | `prod-consent-mvp-go-no-go-checklist.md` |

**Documento autoritativo para a janela**: usar os de `docs/release/` (mais recentes; pacote PR #83 com comandos marcados como "🔒 NÃO EXECUTAR SEM AUTORIZAÇÃO FORMAL").

---

## 10. Próxima ação automatizável

Quando os 10 bloqueadores de governança forem resolvidos pelo operador:

1. Criar PR separado para workflow GHA dedicado a PROD (com `tpdiccnmsnjtjwhardij` hardcoded).
2. Validar via MCP read-only o estado PROD imediatamente antes da janela.
3. Aplicar migrations 020-023 + 031 (+ opcional 030) via `mcp__apply_migration` **com autorização explícita**.
4. Deploy 7 funções Consent com `--no-verify-jwt` via workflow PROD ou CLI.
5. Smoke pré-ativação + ativação flag + smoke pós-ativação.
6. Monitoramento T+0 a T+72h.
7. Postmortem light em T+72h (criar `docs/audit/prod-consent-mvp-release-execution-report.md`).

---

## 11. Histórico deste índice

| Data UTC | Commit | Alteração |
|---|---|---|
| 2026-05-10 | (este PR) | Versão inicial do índice consolidado, post PR #83. |
