# PROD Safety Signals — Go / No-Go Checklist

**Branch:** `claude/safety-signals-operational-hardening`
**Base SHA:** `0cd4d8e`
**Data:** 2026-05-10
**Status:** **DOCUMENTAÇÃO. NÃO EXECUTAR.** Esta checklist é para uso em uma futura janela executiva. Hoje, a recomendação consolidada é **NO-GO**.

---

## Como usar

Cada item tem três campos:
- **Status atual** (preenchido nesta sessão).
- **Quem assina off**.
- **GO se**.

Para autorizar Safety em PROD, **todos os itens precisam estar em GO assinados** ou explicitamente classificados como "aceitável por exceção" pelo Release Manager + Compliance.

---

## A. Pré-requisitos cronológicos

| # | Item | Status atual | Quem assina | GO se |
| --- | --- | --- | --- | --- |
| A1 | Consent MVP em PROD operando há ≥ 7 dias sem incidente | Consent ainda **não em PROD** | Release Manager + Eng Lead | Consent rodando, smoke verde por 7 dias |
| A2 | Janela de manutenção dedicada agendada e comunicada | n/a | Ops + Produto | janela ≥ 4h, fora do peak de tenants |
| A3 | Decisão executiva por escrito (memo + assinatura) | NO-GO atual | Eng + Produto + Legal + Ops | 4 assinaturas |
| A4 | Comunicação prévia a tenants (se aplicável) | n/a | Produto | enviada ≥ 48h antes |

## B. Dependências técnicas

| # | Item | Status atual | Quem assina | GO se |
| --- | --- | --- | --- | --- |
| B1 | Cron schedule formal para Safety (`030_safety_cron_schedule.sql` ou equivalente) | **Não existe** | Eng Lead | migration revisada, testada em HML, sem rotação destrutiva |
| B2 | UI ação em alert (ack/escalate/resolve/dismiss) plugada | **placeholder** (ver UI1) | Frontend Lead | botões funcionando contra `safety-alert-dispatch` |
| B3 | UI toggle `legal_hold` | **inexistente** (UI2) | Frontend Lead | endpoint dedicado + botão protegido |
| B4 | UI override de regra plugada em `actions.ts` | **placeholder com SQL** (UI3) | Frontend Lead | formulário funcional |
| B5 | Banner de ambiente PROD vs HML no admin | **inexistente** (UI6) | Frontend Lead | banner amarelo em todas as rotas admin de PROD |
| B6 | `audit_event` em `safety-step-up` (S1) | **não escrito** | Backend Lead | step-up grava `safety.step_up.created` |
| B7 | Idempotência de consent existente (C2) | **não implementado** | Backend Lead | safety-event-ingest reusa consent granted ativo |
| B8 | Rebloqueio em consent revoked/expired (C3) | **não implementado** | Backend Lead + Legal | rule-engine considera consent.revoked |
| B9 | Snapshot de `consent_text_version_id` (C4) | **parcial** | Backend Lead + Legal | versão do texto anexada ao alert |
| B10 | Validar existência de `safety_recompute_messages_24h` em PROD (G6) | **a verificar** | Backend Lead | função SQL existe ou migration documentada |
| B11 | Rate limit em `safety-step-up` (S3) | **não implementado** | Backend Lead | `checkRateLimit` aplicado |
| B12 | Cleanup expandido para `safety_alerts`, `safety_interactions`, `safety_subjects`, `safety_evidence_artifacts` (R5) | **só `safety_events`** | Backend Lead + Legal | decisão documentada (expandir ou aceitar limite) |
| B13 | Sanitização de `resolved_note` (UI5) | **livre** | Backend Lead | regex de "looks like email/phone/cpf" no Edge Function |

## C. Privacidade e Conformidade

| # | Item | Status atual | Quem assina | GO se |
| --- | --- | --- | --- | --- |
| C1 | Privacy Guard `safety_event_v1` ativo em todas as functions públicas | ✅ verificado | Compliance | sem regressão |
| C2 | Envelope público com `content_included=false`, `pii_included=false` | ✅ verificado | Compliance | smoke valida |
| C3 | Reason codes canônicos (`SAFETY_*`) | ✅ verificado | Compliance | catálogo intacto |
| C4 | Severity ↔ action invariant aplicado | ✅ verificado | Compliance | tests passam |
| C5 | RLS em todas tabelas multi-tenant | ✅ via migration 025 | Backend Lead | confirmação SQL |
| C6 | Legal hold blindado contra cleanup | ✅ verificado (filtro + GUC + auditoria) | Backend Lead + Legal | SQL idempotente |
| C7 | Vocabulário do dashboard sem termos proibidos | ✅ varredura zero | Produto + Legal | confirmação Frontend |
| C8 | DPO/Privacy Lead aprovou texto consent + safety | n/a | DPO | aprovado por escrito |

## D. Operacional

| # | Item | Status atual | Quem assina | GO se |
| --- | --- | --- | --- | --- |
| D1 | Smoke positivo Safety verde em HML há ≤ 24h | ✅ pode rodar agora | Eng de Smoke | exit 0 |
| D2 | Smoke negativo Safety verde em HML há ≤ 24h | ✅ via `assert_400` × 9 | Eng de Smoke | exit 0 |
| D3 | Cron secret PROD configurado (gerado novo) | ❌ não tocar nesta sessão | Ops + Eng Lead | secret existe, rotacionado, não é o de HML |
| D4 | `SAFETY_ALERT_ID` validado em smoke admin | depende de Gate 5 do runbook | Eng de Smoke | smoke admin verde |
| D5 | Backup PITR PROD ativo, último < 24h | n/a | Ops | confirmação Supabase |
| D6 | Workflow PROD aprovado (espelho do HML, hardcoded em PROD) | **não existe** | Ops + Eng Lead + Compliance | workflow auditado, exige duplo input + revisão de PR |
| D7 | On-call disponível +48h pós-release | n/a | Ops | escala definida |
| D8 | Rollback runbook revisado pelo executor | ✅ disponível | Release Manager | leitura registrada |

## E. Migrations

| # | Item | Status atual | Quem assina | GO se |
| --- | --- | --- | --- | --- |
| E1 | Migrations 024–027 testadas em HML há ≥ 30 dias | ✅ aplicadas em HML | Backend Lead | sem incidente em HML |
| E2 | Migrations 024–027 reaplicadas em sandbox isolado contra PROD-like | n/a | Eng de Banco | dry-run OK |
| E3 | Migration 030 (cron schedule) revisada e idempotente | ❌ não existe ainda | Eng de Banco | PR revisado, idempotente, sem destrutivo |
| E4 | Plano de rollback de migrations documentado | ✅ ver rollback runbook | Eng de Banco | reversibilidade clara |

## F. Pós-release vigilância

| # | Item | Status atual | Quem assina | GO se |
| --- | --- | --- | --- | --- |
| F1 | Dashboards Safety visíveis aos operadores | n/a | Ops + Frontend | links no admin |
| F2 | Alertas internos (Slack/email) configurados para erros 5xx Safety | n/a | Ops | regra de alerta ativa |
| F3 | SLO definido para `safety-event-ingest` p99 | n/a | Eng Lead | SLO documentado |
| F4 | Plano de retenção de logs ≥ 30 dias | ✅ Supabase default | Ops | confirmado |

---

## Veredito consolidado para esta janela

**NO-GO.** Itens críticos pendentes:

- **A1**: Consent ainda **não está em PROD**.
- **A3**: nenhum sign-off executivo.
- **B1**: cron schedule não existe.
- **B6, B7, B8, B9, B10, B11, B12, B13**: hardening operacional pendente.
- **D3, D6**: secrets PROD e workflow PROD não foram criados.
- **E3**: migration 030 não existe.

Próximas decisões pertencem a Eng + Produto + Legal + Ops.

**Esta sessão NÃO toca PROD.**
