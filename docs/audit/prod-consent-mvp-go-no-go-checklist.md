# Checklist Go/No-Go — Release PROD do AgeKey Consent MVP

> **Status**: Checklist preparatório. Nenhum item deve ser marcado como cumprido até a janela autorizada.
>
> Project ref PROD: `tpdiccnmsnjtjwhardij`. Escopo: somente Consent. Safety **fora**.
> Companheiros: `docs/audit/prod-consent-mvp-release-decision-memo.md`, `docs/audit/prod-consent-mvp-release-runbook.md`.

---

## Como usar

- Cada item deve ser **independentemente verificável** por uma segunda pessoa.
- Não usar este checklist como evidência única — sempre cruzar com docs de origem.
- **Qualquer item ❌ vermelho = NO-GO**. Não se inicia a janela.
- Marcação só pode ser feita pelo operador responsável **no momento da janela**, não antes.

---

## 1. Validação técnica HML

| # | Item | Critério | Como verificar | Estado |
|---|---|---|---|---|
| 1.1 | HML validada ponta-a-ponta | 8/8 steps de `consent-smoke.sh` passaram | `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` | ☐ |
| 1.2 | HML estável nas últimas 24h pré-janela | Nenhum 5xx novo em `parental-consent-*` | MCP `get_logs(service=edge-function)` em HML | ☐ |
| 1.3 | `main` em commit auditável (`f4ddcb91` ou descendente) | SHA registrado | `git rev-parse HEAD` | ☐ |
| 1.4 | Suite de testes verde | `pnpm test` 359/359 (ou superior) | CI da branch | ☐ |
| 1.5 | Typecheck verde | packages + admin clean | `pnpm typecheck --filter @agekey/shared --filter @agekey/admin` | ☐ |
| 1.6 | Lint clean | warning a11y pré-existente OK | `pnpm -r lint` | ☐ |

## 2. Migrations revisadas

| # | Item | Critério | Estado |
|---|---|---|---|
| 2.1 | 5 migrations Consent identificadas | 020, 021, 022, 023, 031 listadas no runbook | ☐ |
| 2.2 | Migration 030 (RLS audit/billing) avaliada | aplicar (recomendado) ou skip explícito | ☐ |
| 2.3 | Safety migrations NÃO listadas no plano | 024-027 ausentes | ☐ |
| 2.4 | Migration 028 (cron retention) NÃO listada | defer; decisão separada | ☐ |
| 2.5 | Migration 029 (cross-cutting) NÃO listada | safety_recompute_messages_24h falha sem 024 | ☐ |
| 2.6 | 7 Edge Functions Consent identificadas | lista exata `parental-consent-*` | ☐ |
| 2.7 | Funções Safety NÃO listadas | nenhuma `safety-*` no plano | ☐ |

## 3. Backup PROD

| # | Item | Critério | Como verificar | Estado |
|---|---|---|---|---|
| 3.1 | Snapshot Supabase PROD < 24h | confirmado | Dashboard Supabase → Database → Backups | ☐ |
| 3.2 | `backup_id` registrado | documentado | Anotar no log da janela | ☐ |

## 4. Env vars conferidas (PROD Dashboard)

| # | Variável | Valor esperado | Estado |
|---|---|---|---|
| 4.1 | `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | provider **real** (`twilio`/`mailgun`/etc.); **nunca `noop`** | ☐ |
| 4.2 | Secrets do provider OTP | configurados (TWILIO_ACCOUNT_SID etc.) | ☐ |
| 4.3 | `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` | URL pública real | ☐ |
| 4.4 | `AGEKEY_PARENTAL_CONSENT_ENABLED` | OFF inicialmente (será ON na Fase 3) | ☐ |
| 4.5 | `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | **NÃO setado** (proibido em PROD) | ☐ |
| 4.6 | `AGEKEY_SAFETY_ENABLED` | NÃO setado / OFF | ☐ |
| 4.7 | `SAFETY_CRON_SECRET` | NÃO setado | ☐ |
| 4.8 | Provider OTP testado (deliverability) | OTP de teste recebido em ambiente sandbox do provider | ☐ |

## 5. Feature flags conferidas

| # | Item | Estado |
|---|---|---|
| 5.1 | `AGEKEY_PARENTAL_CONSENT_ENABLED` OFF antes da janela | ☐ |
| 5.2 | `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` ausente em PROD | ☐ |
| 5.3 | `AGEKEY_SAFETY_ENABLED` OFF | ☐ |
| 5.4 | Flag SD-JWT VC real OFF | ☐ |
| 5.5 | Flag gateway real OFF | ☐ |
| 5.6 | Flag ZKP real OFF | ☐ |

## 6. Tenant API key piloto PROD

| # | Item | Critério | Estado |
|---|---|---|---|
| 6.1 | Tenant piloto criado em PROD | `tenants` tem ao menos 1 row | ☐ |
| 6.2 | Application piloto criada com `status='active'` | `applications` para tenant piloto | ☐ |
| 6.3 | Policy piloto criada (slug definido) | `policies` para tenant piloto | ☐ |
| 6.4 | `consent_text_versions` ativo (locale `pt-BR`) | `is_active=true` | ☐ |
| 6.5 | Raw TENANT_API_KEY custodiada por operador | nunca em chat/log/PR | ☐ |
| 6.6 | Hash da chave validado | hash local do operador = `applications.api_key_hash` em PROD | ☐ |

## 7. Workflow de deploy PROD

| # | Item | Critério | Estado |
|---|---|---|---|
| 7.1 | Workflow `Deploy HML Edge Functions` NÃO será usado | hardcoded para HML | ☐ |
| 7.2 | Workflow PROD novo OU plano CLI documentado | uma das opções pronta antes da janela | ☐ |
| 7.3 | `--no-verify-jwt` em todos os 7 deploys | confirmado no script/workflow | ☐ |
| 7.4 | Confirmação manual obrigatória no workflow PROD (se workflow) | input string específica | ☐ |
| 7.5 | Project ref PROD hardcoded com guard defensivo | `if [ "$REF" != "tpdiccnmsnjtjwhardij" ]; then exit 1; fi` | ☐ |
| 7.6 | `SUPABASE_ACCESS_TOKEN` PROD configurado em GH Secrets (se workflow) | Settings → Secrets → Actions | ☐ |

## 8. Smoke test owner definido

| # | Item | Estado |
|---|---|---|
| 8.1 | Operador conhece o `consent-smoke.sh` | ☐ |
| 8.2 | Operador tem ambiente local (bash + jq + openssl + curl) | ☐ |
| 8.3 | `DEV_CONTACT_VALUE` definido para contato real do operador | ☐ |
| 8.4 | Operador acessa caixa de contato em tempo real (para receber OTP) | ☐ |
| 8.5 | Smoke pré-ativação plano (esperar 503) | ☐ |
| 8.6 | Smoke pós-ativação plano (esperar 200, dev_otp = null) | ☐ |
| 8.7 | Cleanup pós-smoke combinado (revogar token de teste) | ☐ |

## 9. Rollback conferido

| # | Item | Estado |
|---|---|---|
| 9.1 | Rollback rápido via flag (< 2min) compreendido | ☐ |
| 9.2 | Operador testou setar/desetar flag em HML pelo menos uma vez | ☐ |
| 9.3 | Rollback de função específica (Restore versão anterior) compreendido | ☐ |
| 9.4 | Rollback de migration **NÃO automático** confirmado pelo operador | ☐ |
| 9.5 | Plantão DBA on-call definido (caso §9.4) | ☐ |

## 10. Janela definida

| # | Item | Estado |
|---|---|---|
| 10.1 | Início UTC: __________ | ☐ |
| 10.2 | Fim UTC (estimativa): __________ | ☐ |
| 10.3 | Tenant(s) piloto cientes da janela | ☐ |
| 10.4 | Status page atualizada (se aplicável) | ☐ |
| 10.5 | Canal de incidente combinado (Slack, etc.) | ☐ |

## 11. Decisão executiva registrada

| # | Item | Estado |
|---|---|---|
| 11.1 | Memo `docs/audit/prod-consent-mvp-release-decision-memo.md` assinado por produto | ☐ |
| 11.2 | Memo assinado por legal / DPO | ☐ |
| 11.3 | Memo assinado por tech lead | ☐ |
| 11.4 | RIPD do AgeKey Consent v1 aceito formalmente | ☐ |
| 11.5 | Operador responsável definido | ☐ |
| 11.6 | Aprovador legal/produto on-call durante a janela | ☐ |

---

## 12. Aprovações finais — go-live

| # | Aprovador | Decisão | Data/Hora UTC | Assinatura |
|---|---|---|---|---|
| 12.1 | Operador responsável | ☐ Go ☐ No-Go | ____________ | ____________ |
| 12.2 | Aprovador legal/produto | ☐ Go ☐ No-Go | ____________ | ____________ |
| 12.3 | Plantão DBA | ☐ Go ☐ No-Go | ____________ | ____________ |
| 12.4 | Decisão final | ☐ **GO** ☐ **NO-GO** | ____________ | ____________ |

**Critério para GO**: 12.1 + 12.2 + 12.3 todos Go, e nenhum item ❌ vermelho nas seções 1-11.

**Critério para NO-GO**: qualquer item ❌ vermelho ou qualquer aprovador No-Go.

---

## Histórico de revisão

| Data UTC | Quem | Alteração |
|---|---|---|
| 2026-05-10 | Claude (PR #?) | Versão inicial preparatória, sem execução. |
