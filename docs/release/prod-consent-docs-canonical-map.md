# Canonical Map — Documentos de Release AgeKey Consent MVP PROD

> **Propósito**: definir qual documento é **autoritativo** vs **histórico** para cada concern do release Consent PROD, reduzindo drift entre versões paralelas criadas em sprints distintos.
> **Atualizado em**: 2026-05-10 (após PR #86, commit `71c39a4a`).

---

## 1. Princípios da classificação

| Pasta | Função canônica |
|---|---|
| `docs/release/` | **Autoritativa** para execução, decisão, runbook, rollback e smoke test. Materiais que serão usados durante e antes da janela. |
| `docs/audit/` | **Histórica/evidencial**. Reports de validação, diagnósticos, pré-flights, snapshots de estado. Não substituem os autoritativos. |
| `docs/adr/` | **Decisões arquiteturais** (Architecture Decision Records). Imutáveis após status final. |
| `compliance/` | **Governança**: RIPD, Privacy by Design, retenção, subprocessadores, incident response. |

**Regra de ouro**: em caso de conflito entre `docs/release/` e `docs/audit/`, **prevalece `docs/release/`**.

---

## 2. Documentos autoritativos (use estes na janela)

| Documento | Localização | Use para |
|---|---|---|
| **Index consolidado** | `docs/release/README.md` | Localizar qualquer documento de release rapidamente |
| **Executive Go/No-Go pack** | `docs/release/prod-consent-mvp-executive-go-no-go-pack.md` | Decisão executiva (PO + DPO + Tech Lead) |
| **Execution runbook** | `docs/release/prod-consent-mvp-execution-runbook.md` | Fase 0–6 durante a janela |
| **Rollback runbook** | `docs/release/prod-consent-mvp-rollback-runbook.md` | Acionamento em incidente (9 cenários) |
| **Smoke test pack** | `docs/release/prod-consent-mvp-smoke-test-pack.md` | Validação pós-ativação |
| **Decision memo (PR #77)** | `docs/release/prod-consent-legal-product-decision-memo.md` | Memo executivo legacy (paralelo ao Executive Go/No-Go pack — manter ambos até janela) |
| **Go/No-Go checklist (PR #77)** | `docs/release/prod-consent-go-no-go-checklist.md` | Checklist de itens operacionais |
| **Runbook (PR #77)** | `docs/release/prod-consent-release-runbook.md` | Versão equivalente, paralela ao Execution Runbook |
| **ADR** | `docs/adr/ADR-AGEKEY-CONSENT-PROD-RELEASE.md` | Decisão arquitetural — Status: Proposed |

---

## 3. Documentos históricos / paralelos

| Documento | Localização | Função histórica |
|---|---|---|
| Memo PR #79 (audit) | `docs/audit/prod-consent-mvp-release-decision-memo.md` | Versão paralela do memo executivo. **Para consulta histórica/contexto**. |
| Runbook PR #79 (audit) | `docs/audit/prod-consent-mvp-release-runbook.md` | Versão paralela do runbook. **Para consulta histórica/contexto**. |
| Checklist PR #79 (audit) | `docs/audit/prod-consent-mvp-go-no-go-checklist.md` | Versão paralela do checklist. **Para consulta histórica/contexto**. |
| Final Go/No-Go Review | `docs/audit/prod-consent-release-final-go-no-go-review.md` | Revisão consolidada antes do PR #79 (snapshot histórico) |
| Pre-flight PR #81 | `docs/audit/prod-consent-mvp-preflight-readiness-report.md` | Inspeção MCP read-only de PROD (snapshot de estado) |
| Readiness Board | `docs/audit/prod-consent-release-readiness-board.md` | Painel de 25 itens — paralelo ao Executive Go/No-Go pack |
| Status Board | `docs/audit/agekey-release-status-board.md` | Painel por módulo (evolução temporal) |
| Governance Automation Report | `docs/audit/prod-consent-release-governance-automation-report.md` | Relatório da rodada de automação (PR #83) |

---

## 4. Mapeamento por concern

### 4.1. Decisão executiva

| Concern | Documento autoritativo | Documento histórico |
|---|---|---|
| Resumo + recomendação Go/No-Go | `docs/release/prod-consent-mvp-executive-go-no-go-pack.md` | `docs/audit/prod-consent-release-final-go-no-go-review.md` |
| Memo de decisão (com assinaturas) | `docs/release/prod-consent-legal-product-decision-memo.md` | `docs/audit/prod-consent-mvp-release-decision-memo.md` |
| Decisão arquitetural | `docs/adr/ADR-AGEKEY-CONSENT-PROD-RELEASE.md` | — |

### 4.2. Operação técnica

| Concern | Documento autoritativo | Documento histórico |
|---|---|---|
| Runbook (Fase 0–6) | `docs/release/prod-consent-mvp-execution-runbook.md` | `docs/release/prod-consent-release-runbook.md` (PR #77), `docs/audit/prod-consent-mvp-release-runbook.md` (PR #79) |
| Checklist Go/No-Go | `docs/release/prod-consent-go-no-go-checklist.md` | `docs/audit/prod-consent-mvp-go-no-go-checklist.md`, `docs/audit/prod-consent-release-readiness-board.md` |
| Pre-launch checklist (manual) | `docs/audit/agekey-release-pre-launch-checklist.md` (este pacote) | — |

### 4.3. Rollback

| Concern | Documento autoritativo |
|---|---|
| Cenários e procedimentos | `docs/release/prod-consent-mvp-rollback-runbook.md` |

### 4.4. Smoke tests

| Concern | Documento autoritativo |
|---|---|
| Pack PROD (sem DEV_RETURN_OTP) | `docs/release/prod-consent-mvp-smoke-test-pack.md` |
| Script | `scripts/smoke/consent-smoke.sh` (em main, validado em HML 8/8) |

### 4.5. Compliance e governança

| Concern | Documento autoritativo |
|---|---|
| RIPD (LGPD art. 38) | `compliance/ripd-agekey.md` |
| Privacy by Design | `compliance/privacy-by-design-record.md` |
| Política de retenção | `compliance/data-retention-policy.md` |
| Subprocessadores | `compliance/subprocessors-register.md` |
| Incident response | `compliance/incident-response-playbook.md` |

### 4.6. Infraestrutura

| Concern | Documento autoritativo |
|---|---|
| Ambientes (DEV/HML/PROD) | `infrastructure/environments.md` |
| Secrets | `infrastructure/secrets.md` |
| Vercel deploy | `infrastructure/vercel-deploy.md` |
| Supabase hardening | `infrastructure/supabase-hardening.md` |
| Env vars + feature flags | `docs/audit/agekey-env-feature-flag-matrix.md` |
| Deploy readiness | `docs/audit/vercel-supabase-deploy-readiness.md` |

### 4.7. Validação HML (evidência)

| Concern | Documento autoritativo |
|---|---|
| Validação end-to-end HML | `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` |

### 4.8. Estado PROD (read-only)

| Concern | Documento autoritativo |
|---|---|
| Phase 1 (Core + 017) | `docs/audit/prod-phase-1-migration-017-execution-report.md` |
| Pre-flight Consent MVP | `docs/audit/prod-consent-mvp-preflight-readiness-report.md` |

---

## 5. Em caso de conflito entre documentos

**Ordem de precedência** (do mais autoritativo para o menos):

1. **Documento canônico em `docs/release/`** (mais recente em main).
2. **ADR em `docs/adr/`** se a discussão for arquitetural.
3. **Documento de `compliance/`** se a discussão for legal/governança.
4. **Última atualização autenticada do status board** (`docs/audit/agekey-release-status-board.md`).
5. Demais documentos em `docs/audit/` (snapshots históricos).

Se o conflito é entre dois documentos em `docs/release/` (versões paralelas dos PRs #77 e #83), prevalece o **mais novo**, salvo se o mais antigo for explicitamente marcado como autoritativo neste mapa.

---

## 6. Recomendação para evitar drift futuro

### 6.1. Antes de criar novo documento de release

1. Verificar este mapa (`docs/release/prod-consent-docs-canonical-map.md`).
2. Se houver documento autoritativo para o concern, **editar** o existente em vez de criar paralelo.
3. Se for genuinamente novo, atualizar este mapa no mesmo PR.

### 6.2. Antes de mergear PR que toca docs/release/ ou docs/audit/

- Confirmar que não introduz versão paralela acidental.
- Atualizar este mapa se a estrutura mudar.
- Atualizar `docs/release/README.md` (índice) se for caso de adição.

### 6.3. Postmortem após qualquer release executado

- Documento de evidência (`docs/audit/<release>-execution-report.md`).
- Atualização do `docs/audit/agekey-release-status-board.md`.
- Atualização do `compliance/privacy-by-design-record.md` se aplicável.

### 6.4. Consolidação periódica

A cada **3 meses** ou após **2 releases** (o que vier primeiro):

- Revisar este mapa.
- Eliminar documentos `docs/audit/*` que viraram puramente históricos (mover para `docs/audit/archive/` se necessário).
- Resolver duplicidades persistentes (decisão: manter ou consolidar?).

---

## 7. Histórico

| Data UTC | Commit | Alteração |
|---|---|---|
| 2026-05-10 | (este PR) | Versão inicial do canonical map. |
