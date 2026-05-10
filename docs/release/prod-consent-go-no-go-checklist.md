# Checklist go/no-go — Release PROD do AgeKey Consent

> **Status**: Checklist preparatório. Nenhum item deve ser marcado como cumprido até a janela autorizada.
>
> Project ref PROD: `tpdiccnmsnjtjwhardij`.
> Escopo: somente Consent. Safety fica fora.
> Documento companheiro: `docs/release/prod-consent-release-runbook.md` e `docs/audit/prod-consent-release-readiness-final-report.md`.

---

## Como usar

- Cada item deve ser **independentemente verificável** por uma segunda pessoa.
- Não usar este checklist como evidência única — sempre cruzar com docs de origem.
- **Qualquer item ❌ vermelho na coluna direita = NO-GO**. Não se inicia a janela.
- Marcação só pode ser feita pelo operador responsável **no momento da janela**, não antes.

---

## 1. Validação técnica

| # | Item | Critério | Como verificar | Estado |
|---|---|---|---|---|
| 1.1 | HML validada ponta-a-ponta | 8/8 steps de `consent-smoke.sh` passaram | `docs/audit/hml-consent-mvp-end-to-end-smoke-success-report.md` | ☐ |
| 1.2 | HML estável nas últimas 24h pré-janela | Nenhum 5xx novo em `parental-consent-*` | MCP `get_logs(service=edge-function)` em HML | ☐ |
| 1.3 | `main` em commit auditável | SHA registrado e idêntico a base de deploy | `git rev-parse HEAD` | ☐ |
| 1.4 | Suite de testes verde | `pnpm test` 359/359 (ou superior) | CI da branch | ☐ |
| 1.5 | Typecheck verde | packages/* + apps/admin clean | `pnpm typecheck --filter @agekey/shared --filter @agekey/admin` | ☐ |
| 1.6 | Lint verde | clean (warning a11y pré-existente OK) | `pnpm -r lint` | ☐ |
| 1.7 | Migrations identificadas | Lista exata: 020, 021, 022, 023, 031 (+ 030 opcional) | Runbook §1.2 | ☐ |
| 1.8 | Migrations Safety NÃO listadas | 024, 025, 026, 027 ausentes do plano | Runbook §1.2 | ☐ |
| 1.9 | Migration 029 NÃO listada | Cross-cutting com Safety; defer para janela Safety | Readiness §6.2 | ☐ |
| 1.10 | Migration 028 NÃO listada (default) | Defer; cron retention pode ser separado | Readiness §6.2 | ☐ |
| 1.11 | Edge Functions Consent identificadas | Lista exata: 7 funções `parental-consent-*` | Runbook §2.2 | ☐ |
| 1.12 | Edge Functions Safety NÃO listadas | Nenhuma função `safety-*` no plano | Runbook §2.2 | ☐ |

## 2. Backup e recuperação

| # | Item | Critério | Como verificar | Estado |
|---|---|---|---|---|
| 2.1 | Backup PROD recente confirmado | Snapshot Supabase < 24h antes da janela | Dashboard Supabase → Database → Backups | ☐ |
| 2.2 | `backup_id` registrado | Documentado no log de execução | Anotar no documento da janela | ☐ |
| 2.3 | Plano de rollback compreendido pelo operador | Operador descreve em voz própria os passos da Fase 5 | Conversa pré-janela | ☐ |
| 2.4 | Rollback rápido testado em HML pelo menos uma vez | Setou flag OFF em HML e confirmou 503; depois ON | Histórico HML | ☐ |

## 3. Configuração de ambiente (Supabase Dashboard PROD)

| # | Item | Critério | Como verificar | Estado |
|---|---|---|---|---|
| 3.1 | `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | Setado para provider **real** (não `noop`) | Dashboard → Edge Functions → env vars | ☐ |
| 3.2 | Secrets do provider OTP | Configurados (ex.: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, etc.) | Dashboard → env vars | ☐ |
| 3.3 | `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` | URL pública real do painel parental PROD | Dashboard → env vars | ☐ |
| 3.4 | `AGEKEY_PARENTAL_CONSENT_ENABLED` | OFF inicialmente (será ON ao final da Fase 2) | Dashboard → env vars | ☐ |
| 3.5 | `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | **NÃO setado** (proibido em PROD) | Dashboard → env vars | ☐ |
| 3.6 | `AGEKEY_SAFETY_ENABLED` | NÃO setado / OFF | Dashboard → env vars | ☐ |
| 3.7 | Provider OTP testado (deliverability) | Operador recebeu OTP de teste em ambiente staging do provider | Provider dashboard | ☐ |

## 4. Tenant API key piloto PROD

| # | Item | Critério | Como verificar | Estado |
|---|---|---|---|---|
| 4.1 | Tenant piloto PROD criado | `tenants` em PROD tem ao menos 1 row para piloto | SQL read-only via MCP | ☐ |
| 4.2 | Application piloto PROD criada | `applications` para o tenant piloto | SQL read-only via MCP | ☐ |
| 4.3 | TENANT_API_KEY de PROD emitida | Operador tem a raw key no password manager (nunca em chat/log) | Operador confirma | ☐ |
| 4.4 | Hash da chave validado | hash local do operador = `applications.api_key_hash` em PROD | Operador computa local; NÃO enviar raw para Claude | ☐ |
| 4.5 | Application piloto `status='active'` | SQL read-only | MCP | ☐ |
| 4.6 | Policy piloto criada em PROD | `policies` com slug definido para o piloto | MCP | ☐ |
| 4.7 | `consent_text_versions` para a policy + locale `pt-BR` | `is_active=true` | MCP | ☐ |

## 5. Smoke tests prontos

| # | Item | Critério | Como verificar | Estado |
|---|---|---|---|---|
| 5.1 | `scripts/smoke/consent-smoke.sh` em main | mesmo arquivo do PR #67 | `git ls-files` | ☐ |
| 5.2 | Operador tem ambiente local para rodar | bash + jq + openssl + curl | `command -v jq openssl curl` | ☐ |
| 5.3 | `DEV_CONTACT_VALUE` definido para contato real do operador | email/SMS controlado pelo operador | Operador confirma | ☐ |
| 5.4 | Operador acessa caixa de contato em tempo real | para receber OTP no smoke pós-Fase 2 | Operador confirma | ☐ |
| 5.5 | Smoke pré-ativação plano (esperar 503) | comando documentado | Runbook §2.5 | ☐ |
| 5.6 | Smoke pós-ativação plano (esperar 200) | comando documentado | Runbook §3.2 | ☐ |
| 5.7 | Cleanup pós-smoke combinado | revogação imediata do token gerado em teste | Runbook §3.5 | ☐ |

## 6. Decisão executiva

| # | Item | Critério | Como verificar | Estado |
|---|---|---|---|---|
| 6.1 | Memo legal/produto assinado | Documento com `aprovado=true` por nome | `docs/release/prod-consent-legal-product-decision-memo.md` + assinatura externa | ☐ |
| 6.2 | RIPD do Consent revisado e aceito | Documento de RIPD do AgeKey Consent v1 | Pasta interna de compliance | ☐ |
| 6.3 | Tenant(s) piloto cientes da janela | Comunicação enviada e ack recebido | E-mail/Slack registrado | ☐ |
| 6.4 | Janela de manutenção definida | Início + fim em UTC | Runbook §0.6 | ☐ |
| 6.5 | Operador responsável definido | Nome registrado | Runbook §0.7 | ☐ |
| 6.6 | Aprovador legal/produto disponível durante janela | telefone/Slack on-call | Lista de contatos | ☐ |
| 6.7 | Plantão DBA definido (caso §5.3) | Nome + contato | Lista de contatos | ☐ |

## 7. Workflow de deploy PROD

| # | Item | Critério | Como verificar | Estado |
|---|---|---|---|---|
| 7.1 | Workflow `deploy-hml-edge-functions.yml` NÃO será usado | hardcoded para HML; usar workflow PROD ou CLI | Confirmação operador | ☐ |
| 7.2 | Workflow PROD criado em PR separado **ou** plano CLI documentado | uma das opções pronta antes da janela | Existe `.github/workflows/deploy-prod-edge-functions.yml` ou plano CLI no Runbook §2.3 | ☐ |
| 7.3 | `--no-verify-jwt` em todos os 7 deploys | confirmado no script/workflow | Inspeção | ☐ |
| 7.4 | Confirmação manual obrigatória no workflow PROD | input string específica (ex.: `DEPLOY_PROD_EDGE_FUNCTIONS_CONSENT`) | Inspeção do workflow | ☐ |
| 7.5 | Project ref PROD hardcoded com guard defensivo | `if [ "$REF" != "tpdiccnmsnjtjwhardij" ]; then exit 1; fi` | Inspeção | ☐ |
| 7.6 | `SUPABASE_ACCESS_TOKEN` para PROD configurado em GH Secrets | Settings → Secrets → Actions | Confirmação operador | ☐ |

## 8. Comunicação e governança

| # | Item | Estado |
|---|---|---|
| 8.1 | Status page atualizada com janela de manutenção (se aplicável) | ☐ |
| 8.2 | Canal de incidente combinado (#agekey-prod-incident ou similar) | ☐ |
| 8.3 | Postmortem template pronto (caso de incidente) | ☐ |
| 8.4 | Plano de rollback impresso/disponível offline | ☐ |
| 8.5 | Runbook impresso/disponível offline | ☐ |

## 9. Aprovações finais — go-live

| # | Aprovador | Decisão | Data/Hora UTC | Assinatura |
|---|---|---|---|---|
| 9.1 | Operador responsável | ☐ Go ☐ No-Go | ____________ | ____________ |
| 9.2 | Aprovador legal/produto | ☐ Go ☐ No-Go | ____________ | ____________ |
| 9.3 | Plantão DBA | ☐ Go ☐ No-Go | ____________ | ____________ |
| 9.4 | Decisão final | ☐ **GO** ☐ **NO-GO** | ____________ | ____________ |

**Critério para GO**: 9.1 + 9.2 + 9.3 todos Go, e nenhum item ❌ vermelho nas seções 1-8.

**Critério para NO-GO**: qualquer item ❌ vermelho ou qualquer aprovador No-Go.

---

## Histórico de revisão

| Data UTC | Quem | Alteração |
|---|---|---|
| 2026-05-10 | Claude (PR #?) | Versão inicial preparatória, sem execução. |
