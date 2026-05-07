# Histórico — Timeline alternativa em `main`

Esta pasta contém **registros históricos** de uma timeline alternativa de
desenvolvimento (`main` antes da reconciliação P0 ↔ main em 2026-05-07)
que produziu versões alternativas das Rodadas 3 (Parental Consent) e 4
(Safety Signals) durante uma sessão paralela de Claude Code.

Os 5 arquivos preservados aqui (audit reports das PRs #48, #50, #51, #52
e relatório consolidado) **não descrevem** o produto que está deployado
em homologação ou em produção. O produto real é a timeline P0
(documentada nos audit reports diretos de `docs/audit/`).

Eles são preservados como:

1. Registro do trabalho realizado naquela sessão (por completude
   profissional / auditabilidade).
2. Referência para entender por que a divergência ocorreu, caso uma
   auditoria pergunte futuramente.
3. Insumo para próximos PRs que queiram aproveitar boas ideias do
   design alternativo (ex.: o `agekey-core-canonical-contracts.md`
   consolidado já foi promovido para `docs/specs/`).

**Não use estes arquivos como referência de produto.** Para isso, veja:

- `docs/audit/agekey-canonical-modular-architecture-report.md`
- `docs/audit/agekey-core-readiness-canonical-alignment-report.md`
- `docs/audit/agekey-prd-consolidation-report.md`
- `docs/audit/agekey-safety-signals-implementation-report.md`
- `docs/audit/parental-consent-implementation-report.md`
- `docs/audit/agekey-p0-main-divergence-report.md`
- `docs/audit/agekey-p0-main-reconciliation-report.md`

Reconciliação realizada na branch `claude/reconcile-p0-main-agekey`.
