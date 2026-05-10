# PROD Safety Signals — Release Decision Memo

**Branch:** `claude/safety-signals-operational-hardening`
**Base SHA:** `0cd4d8e`
**Data:** 2026-05-10
**Decisão proposta:** **NO-GO para Safety em PROD nesta janela.**
**Status:** **NÃO EXECUTAR. Apenas documentação. Decisão final pertence a Eng + Produto + Legal.**

---

## 1. Sumário executivo

O AgeKey Safety Signals **não está pronto para PROD** nesta janela e **não deve** ser deployado em PROD junto com Consent. Razões:

1. **Dependência funcional:** Safety insere em `parental_consent_requests` e cria `verification_sessions`. Esses recursos só estarão estáveis em PROD após a janela do Consent MVP.
2. **Cron schedule pendente** para `safety-retention-cleanup` e `safety-aggregates-refresh`.
3. **UI Safety tem gaps operacionais** (sem ação para escalonar/resolver alert via UI, sem UI de override de regra plugada).
4. **Auditoria parcial** em `safety-step-up`.
5. **Operação manual** em HML ainda não validou alertas reais nem cron com secret.

A recomendação canônica é: **Consent PROD → janela operacional dedicada → Safety PROD em janela separada**.

## 2. Princípios não-negociáveis preservados

| Princípio | Aplicado em código | Válido para PROD |
| --- | --- | --- |
| Metadata-only no MVP | ✅ Privacy Guard `safety_event_v1` | sim |
| Não armazena conteúdo bruto | ✅ apenas `payload_hash` + `content_hash` | sim |
| Não aceita raw_text/PII em payload público v1 | ✅ HTTP 400 + reason code canônico | sim |
| Não intercepta tráfego | ✅ recebe metadata via API key do tenant | sim |
| Não monitora dispositivo fora da app | ✅ | sim |
| Sem juízo jurídico | ✅ vocabulário do dashboard ("alerta", "evento", "sinal") | sim |
| Reason codes canônicos | ✅ `SAFETY_*` | sim |
| Severity↔action invariant | ✅ rule-engine | sim |
| Sem score universal cross-tenant | ✅ todas as queries são RLS-gated | sim |
| RLS multi-tenant | ✅ migration 025 | sim |
| service_role server-side only | ✅ via Edge Functions | sim |
| Envelope público minimizado | ✅ `content_included=false`, `pii_included=false` | sim |
| Privacy Guard em `safety_event_v1` | ✅ aplicado em ingest e rule-evaluate | sim |

Estes princípios são **estruturais** e **estão satisfeitos no código que iria para PROD**. A questão não é correção, é prontidão operacional + dependência cronológica.

## 3. Dependências críticas para Safety PROD

### 3.1 Consent MVP em PROD

- ✅ Consent já tem GO WITH CONDITIONS, runbook, checklist (PR #79, #83).
- ❌ Consent ainda **não foi executado em PROD** (estado atual).
- **Safety PROD pressupõe Consent MVP em PROD operando**. Sem isso:
  - `parental_consent_requests` não existe em PROD.
  - Edge Functions `parental-consent-*` não respondem em PROD.
  - Webhook `consent.*` não está disponível para o tenant.

### 3.2 Migrations Safety em PROD

PROD tem hoje **apenas Core + migration 017**. As migrations Safety (`024–027`) **não estão aplicadas em PROD**. Aplicá-las exige:

- Janela própria.
- Decisão executiva de Eng + Legal.
- Rollback playbook validado em HML.
- Aprovação operacional pré-execução.
- **Esta sessão NÃO aplica nenhuma migration.**

### 3.3 Cron schedule

Migration `028_retention_cron_schedule.sql` agenda apenas o `agekey-retention-job` do **Core**. Safety precisa de uma migration adicional (tentativamente `030_safety_cron_schedule.sql`) que agende:

- `safety-retention-cleanup` (recomendado: 03:30 UTC diário, depois do retention-job do Core).
- `safety-aggregates-refresh` (recomendado: a cada 6h, idempotente).

Sem isso, o operador roda os endpoints manualmente, o que **não é viável em PROD**.

### 3.4 Feature flags

- `AGEKEY_SAFETY_SIGNALS_ENABLED` é `false` por default (correto).
- `AGEKEY_PARENTAL_CONSENT_ENABLED` deve ser `true` em PROD para que `consent-check` funcione.
- `AGEKEY_SAFETY_DEFAULT_EVENT_RETENTION_CLASS` permanece `event_90d`.
- `AGEKEY_SAFETY_RETENTION_CLEANUP_BATCH_SIZE` = 500 (default seguro).

**Esta sessão NÃO altera feature flags.**

### 3.5 Secrets

- `SAFETY_CRON_SECRET` precisa estar configurado em PROD via Supabase Edge Functions secrets.
- Token deve ser gerado novo em PROD (não reusar HML).
- **Esta sessão NÃO toca secrets.**

## 4. Itens em aberto que bloqueiam GO

| ID | Item | Origem | Severidade |
| --- | --- | --- | --- |
| B1 | Cron schedule formal para Safety (R1 da retention-readiness) | Retention | Alta |
| B2 | UI de ação em alert (ack/escalate/resolve/dismiss) — UI1 | UI | Média |
| B3 | UI de toggle legal_hold — UI2 | UI | Média |
| B4 | UI de override de regra plugada em `actions.ts` — UI3 | UI | Média |
| B5 | Banner de ambiente PROD vs HML — UI6 | UI | Baixa |
| B6 | `audit_event` para step-up — S1 | Step-up | Média |
| B7 | Idempotência de consent existente — C2 | Consent-check | Média |
| B8 | Rebloqueio em consent revoked/expired — C3 | Consent-check | Alta para regulatório |
| B9 | Snapshot de `consent_text_version_id` — C4 | Consent-check | Alta para regulatório |
| B10 | Verificar existência de `safety_recompute_messages_24h` em PROD — G6 | Operational Assessment | Crítica antes de schedule |
| B11 | Rate limit em `safety-step-up` — S3 | Step-up | Média |
| B12 | Cleanup expandido para `safety_alerts`, `safety_interactions` etc. — R5 | Retention | Média |
| B13 | Resolved note sanitization — UI5 | UI | Média |

## 5. Decisão proposta

### 5.1 Safety em PROD: **NO-GO** nesta janela

Motivo: 13 itens em aberto (B1–B13) listados acima.

### 5.2 Próximos marcos

| Marco | Ação | Quando |
| --- | --- | --- |
| M1 | Executar Consent MVP em PROD conforme runbook existente | Quando Eng + Legal aprovarem |
| M2 | Endurecer Safety HML — alert real metadata-only encadeado, cron com secret autorizado | Sessão futura |
| M3 | Endereçar B1, B6, B11 (PRs pequenos de plataforma) | Pré-PROD |
| M4 | Endereçar B7, B8, B9 (PRs de consent-check) | Pré-PROD |
| M5 | Endereçar B2, B3, B4, B5, B13 (PRs de UI) | Pré-PROD |
| M6 | Endereçar B12 (cleanup expandido) | Pré-PROD ou pós-MVP, depende de risco regulatório |
| M7 | Migration `030_safety_cron_schedule.sql` em HML, validar 1 ciclo, depois em PROD em janela própria | Pré-PROD |
| M8 | Pré-flight readiness Safety PROD (espelho do `prod-consent-mvp-preflight-readiness-report.md`) | Imediatamente antes de M9 |
| M9 | Janela executiva Safety PROD: aplica migrations 024–027, deploy edge functions, habilita flag, smoke positivo + negativo, monitora 48h | Decisão executiva separada |

### 5.3 O que está fora desta sessão

- **Não aplicar migrations.**
- **Não rodar `db push`, `migration repair`, `db reset`, `db pull`.**
- **Não alterar feature flags remotas.**
- **Não rodar cron com secret.**
- **Não fazer deploy.**
- **Não tocar PROD em nenhuma camada.**
- **Não criar workflow PROD.**
- **Não tocar secrets.**
- **Não implementar análise de conteúdo bruto.**
- **Não enviar a LLM externo.**

## 6. Histórico que apoia a decisão

- `docs/audit/agekey-safety-signals-implementation-report.md` — implementação MVP.
- `docs/audit/safety-hardening-next-report.md` — Round 5 hardening.
- `docs/audit/prod-consent-safety-release-options.md` — opções de release combinada vs separada.
- `docs/release/consent-safety-prod-decision-memo.md` — decisão prévia.
- `docs/audit/hml-safety-operational-assessment.md` — esta sessão.
- `docs/audit/hml-safety-step-up-readiness.md` — esta sessão.
- `docs/audit/hml-safety-consent-check-readiness.md` — esta sessão.
- `docs/audit/hml-safety-retention-readiness.md` — esta sessão.
- `docs/audit/hml-safety-ui-readiness.md` — esta sessão.

## 7. Sign-off proposto

| Pessoa | Papel | Decisão |
| --- | --- | --- |
| _(Eng Lead)_ | Plataforma / Edge Functions | _(pendente)_ |
| _(Produto)_ | Owner Safety | _(pendente)_ |
| _(Legal)_ | Compliance | _(pendente)_ |
| _(Ops/SRE)_ | Operação | _(pendente)_ |

A decisão final é **dos donos do produto e do compliance**, não desta sessão. Esta sessão produz apenas o pacote informativo.
