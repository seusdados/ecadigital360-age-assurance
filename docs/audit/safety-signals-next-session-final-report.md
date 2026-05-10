# Safety Signals — Next Session Final Report

**Branch:** `claude/safety-signals-operational-hardening`
**SHA da base (origin/main):** `0cd4d8ebfd931c4edec486176ee78a0bc33349ba` ("fix(website): SVG motion + render polish (overlap fix + crisp rendering) (#84)")
**Data:** 2026-05-10
**Tipo:** Rodada de hardening operacional Safety, somente HML + documentação. PROD intocada.

---

## 1. Sumário executivo

Esta sessão entregou um pacote de operação e documentação de PROD readiness para AgeKey Safety Signals, sem tocar PROD, sem aplicar migrations, sem alterar feature flags remotas e sem executar deploys. Veredito final consolidado: **Safety está OPERACIONAL EM HML com gates conhecidos** e **NO-GO PROD nesta janela**.

Deliverables principais:
- 1 script hardened (`scripts/smoke/safety-smoke.sh`).
- 5 relatórios de readiness HML (operational, step-up, consent-check, retention, UI).
- 4 documentos de release PROD (memo, runbook, checklist, rollback runbook).
- 1 relatório final (este documento).

## 2. Branch + estado

| Item | Valor |
| --- | --- |
| Branch atual | `claude/safety-signals-operational-hardening` |
| Base SHA | `0cd4d8ebfd931c4edec486176ee78a0bc33349ba` |
| Origin/main | `0cd4d8e` (sincronizado) |
| Working tree pré-sessão | limpa |
| Working tree pós-sessão | só os arquivos listados em §4 |

## 3. Arquivos analisados (read-only)

### 3.1 Edge Functions Safety
- `supabase/functions/safety-event-ingest/index.ts` (460 linhas)
- `supabase/functions/safety-rule-evaluate/index.ts` (182)
- `supabase/functions/safety-rules-write/index.ts` (230)
- `supabase/functions/safety-alert-dispatch/index.ts` (125)
- `supabase/functions/safety-step-up/index.ts` (135)
- `supabase/functions/safety-aggregates-refresh/index.ts` (73)
- `supabase/functions/safety-retention-cleanup/index.ts` (215)

### 3.2 Helpers
- `supabase/functions/_shared/safety/feature-flags.ts` (25)
- `supabase/functions/_shared/safety/payload-hash.ts`
- `supabase/functions/_shared/safety/aggregates.ts`
- `supabase/functions/_shared/safety/step-up.ts` (49)
- `supabase/functions/_shared/safety/consent-check.ts` (80)
- `supabase/functions/_shared/safety/subject-resolver.ts`

### 3.3 Pure libs
- `packages/shared/src/safety/relationship.ts`
- `packages/shared/src/safety/rule-engine.ts`
- `packages/shared/src/schemas/safety.ts`
- `packages/shared/src/privacy/*` (referenciado, não lido)

### 3.4 Migrations (apenas leitura)
- `supabase/migrations/024_safety_signals_core.sql`
- `supabase/migrations/025_safety_signals_rls.sql`
- `supabase/migrations/026_safety_signals_webhooks.sql`
- `supabase/migrations/027_safety_signals_seed_rules.sql`
- `supabase/migrations/028_retention_cron_schedule.sql` (Core only — gap R1 documentado)

### 3.5 Admin routes
- `apps/admin/app/(app)/safety/{layout,page,events/page,alerts/page,alerts/[id]/page,rules/{page,new/page,[id]/page,actions},subjects/page,interactions/page,evidence/page,retention/page,integration/page,settings/page,reports/page}.tsx`
- 15 arquivos cobertos.

### 3.6 Workflow
- `.github/workflows/deploy-hml-edge-functions.yml` (HML hardcoded; PROD não tem espelho — gap D6).

### 3.7 Smoke script anterior
- `scripts/smoke/safety-smoke.sh` (versão 248 linhas).

## 4. Arquivos criados / alterados nesta sessão

### Alterado
- `scripts/smoke/safety-smoke.sh` — substituído (353 linhas). Hardening: contadores PASS/FAIL/SKIP, classes separadas (Public/Admin/Cron), validação de envelope `content_included=false` + `pii_included=false`, exit code coerente, sem ecoar credenciais.

### Criado (docs/audit/)
- `docs/audit/hml-safety-operational-assessment.md`
- `docs/audit/hml-safety-step-up-readiness.md`
- `docs/audit/hml-safety-consent-check-readiness.md`
- `docs/audit/hml-safety-retention-readiness.md`
- `docs/audit/hml-safety-ui-readiness.md`
- `docs/audit/safety-signals-next-session-final-report.md` (este arquivo)

### Criado (docs/release/)
- `docs/release/prod-safety-signals-release-decision-memo.md`
- `docs/release/prod-safety-signals-release-runbook.md`
- `docs/release/prod-safety-signals-go-no-go-checklist.md`
- `docs/release/prod-safety-signals-rollback-runbook.md`

**Total:** 1 script alterado + 10 documentos novos.

## 5. Testes executados

| Comando | Resultado | Tempo |
| --- | --- | --- |
| `pnpm install --prefer-offline` | OK | ~30s |
| `pnpm typecheck` | 7/7 successful | 21s |
| `pnpm lint` | 2/2 successful (1 aria warning pré-existente em `policy-form.tsx`, não relacionado a Safety) | 8s |
| `pnpm test` | shared: 359 tests passed, integration: 1 passed + 10 env-gated skipped | 8s |
| `bash -n scripts/smoke/safety-smoke.sh` | syntax OK | < 1s |

Nenhum erro novo. Nenhum teste passou a falhar nesta sessão.

## 6. Smoke Safety contra HML — não executado

A versão hardened do smoke **não foi executada contra HML** nesta sessão. Razão: `TENANT_API_KEY`, `BASE_URL` e `ACTOR_REF_HMAC` precisam ser providos pelo operador, e o escopo da rodada era endurecer + documentar, não rodar. **Próxima sessão pode rodar** o smoke com:
- `BASE_URL=https://wljedzqgprkpqhuazdzv.functions.supabase.co`
- `TENANT_API_KEY=<key de teste em HML>` (não commitar)
- `ACTOR_REF_HMAC=<HMAC opaco>`

POS-4/POS-5 ficarão SKIP a menos que `SAFETY_ALERT_ID` seja exportado. POS-6/POS-7 ficarão SKIP a menos que `SAFETY_CRON_SECRET` seja exportado. **Esses dois últimos exigem autorização explícita.**

## 7. Status Safety HML

| Componente | Status | Observação |
| --- | --- | --- |
| `safety-event-ingest` | ✅ smoke ready | Privacy guard ativo |
| `safety-rule-evaluate` | ✅ smoke ready | Read-only, idempotente |
| `safety-rules-write` | ✅ smoke ready | Override per-tenant; RLS via tenant_id forçado |
| `safety-alert-dispatch` | ⚠ gated em SAFETY_ALERT_ID | Lógica auditada |
| `safety-step-up` | ⚠ gated em SAFETY_ALERT_ID | Lógica auditada; gap S1 (audit_event) e S3 (rate limit) |
| `safety-aggregates-refresh` | ⚠ gated em SAFETY_CRON_SECRET | Depende de RPC `safety_recompute_messages_24h` (gap G6) |
| `safety-retention-cleanup` | ⚠ gated em SAFETY_CRON_SECRET | Legal hold blindado por GUC + filtro + auditoria |
| Privacy Guard `safety_event_v1` | ✅ aplicado | Defesa em profundidade verificada |
| Envelope público minimizado | ✅ aplicado | `content_included=false`, `pii_included=false` |
| RLS multi-tenant | ✅ aplicado | Migration 025 |
| UI admin | ✅ não expõe PII | gaps UI1–UI7 documentados |
| Migrations 024–027 | ✅ em HML | Estáveis |
| Cron schedule Safety | ❌ não existe | gap R1; precisa migration 030 |
| Tests unitários | ✅ 359 passando | Cobertura forte em rule-engine, schemas, privacy guard |

## 8. Status Safety PROD

| Componente | Status |
| --- | --- |
| Migrations Safety em PROD | ❌ não aplicadas |
| Edge Functions Safety em PROD | ❌ não deployadas |
| Feature flag `AGEKEY_SAFETY_SIGNALS_ENABLED` em PROD | `false` (default seguro) — não tocar |
| Workflow PROD para deploy de Edge Functions | ❌ não existe |
| Cron schedule PROD | ❌ não aplicável até migrations rodarem |
| Decisão executiva | ❌ pendente |
| Consent MVP em PROD (pré-requisito) | ❌ ainda não em PROD |

**Veredito:** **NO-GO PROD nesta janela.** Detalhes em `docs/release/prod-safety-signals-release-decision-memo.md`.

## 9. Gaps e próximos PRs recomendados

Lista consolidada de gaps detectados, ordenada por dependência operacional:

| ID | Gap | Onde está descrito | PR sugerido | Severidade |
| --- | --- | --- | --- | --- |
| G6 | Validar existência de `safety_recompute_messages_24h` em HML/PROD | operational §5 | Eng read-only no Studio | Crítica antes de cron |
| R1 | Cron schedule formal Safety (`030_safety_cron_schedule.sql`) | retention §5 | PR: nova migration 030 | Alta |
| S1 | `audit_event` em `safety-step-up` | step-up §5 | PR pequeno backend | Média |
| S3 | Rate limit em `safety-step-up` | step-up §5 | PR pequeno backend | Média |
| C2 | Idempotência de consent existente | consent-check §5 | PR backend | Média |
| C3 | Rebloqueio em consent revoked/expired | consent-check §5 | PR backend + decisão de produto | Alta para regulatório |
| C4 | Snapshot de `consent_text_version_id` no alert | consent-check §5 | PR backend | Alta para regulatório |
| C5 | Teste unitário do helper consent-check | consent-check §5 | PR pequeno | Baixa |
| R3 | Revisar `set_config` em pooler | retention §5 | PR doc + decisão Eng Plataforma | Média |
| R5 | Cleanup expandido para outras tabelas Safety | retention §5 | PR backend + decisão Legal | Média |
| R6 | Dry-run mode em retention-cleanup | retention §5 | PR pequeno | Baixa |
| UI1 | Botões de ação em alert (ack/escalate/resolve/dismiss) | UI §5 | PR frontend | Média |
| UI2 | Toggle legal_hold via UI | UI §5 | PR frontend + backend | Média |
| UI3 | Formulário de override de regra plugado | UI §5 | PR frontend | Média |
| UI4 | Paginação cursor-based | UI §5 | PR frontend | Baixa |
| UI5 | Sanitização de `resolved_note` | UI §5 | PR backend | Média |
| UI6 | Banner de ambiente PROD | UI §5 | PR pequeno frontend | Baixa |
| UI7 | Documentar quotas em `/safety/integration` | UI §5 | PR doc | Baixa |
| G1 | Smoke encadear `alert_id` capturado em POS-1 | operational §5 | PR pequeno scripts | Baixa |
| G4 | Role 'admin' via JWT em `safety-alert-dispatch` | operational §5 | PR backend | Média |
| G5 | Cross-tenant tests rodando em CI | operational §5 | PR config CI | Baixa |
| D6 | Workflow PROD para deploy de Edge Functions | go-no-go §D | PR ops + sign-off | Alta antes de PROD |
| B13 | Sanitizar `resolved_note` server-side | go-no-go §B | mesmo que UI5 | Média |

## 10. Decisões que dependem do usuário

Esta sessão **não tem autoridade** para tomar nenhuma das seguintes decisões. Listadas para visibilidade:

| Decisão | Quem decide |
| --- | --- |
| Aprovar execução de smoke admin em HML (criar alerts reais) | Eng + Produto |
| Aprovar execução de cron Safety em HML | Eng + Ops |
| Compartilhar `SAFETY_ALERT_ID` real em HML | Eng |
| Compartilhar `SAFETY_CRON_SECRET` em HML | Ops + Eng Lead (canal seguro) |
| Aprovar criação da migration 030 cron | Eng Lead |
| Aprovar PRs B6, B7, B11, B13 (hardening backend) | Eng Lead + Backend |
| Aprovar PRs UI1–UI6 (frontend) | Frontend Lead + Produto |
| Aprovar workflow PROD de deploy | Ops + Compliance |
| Aprovar janela executiva Safety PROD | Eng + Produto + Legal + Ops |
| Aplicar migrations Safety em PROD | Eng Lead (com sign-off) |
| Habilitar `AGEKEY_SAFETY_SIGNALS_ENABLED=true` em PROD | Release Manager |

## 11. Confirmação final — PROD não foi tocada

- ❌ Nenhum comando rodado contra PROD.
- ❌ Nenhuma migration aplicada em PROD.
- ❌ Nenhuma `db push`, `migration repair`, `db reset`, `db pull` executada.
- ❌ Nenhum endpoint cron disparado com secret.
- ❌ Nenhum deploy de Edge Function feito.
- ❌ Nenhuma feature flag remota alterada.
- ❌ Nenhum secret tocado.
- ❌ Nenhum workflow PROD criado.
- ❌ Nenhum payload contendo PII produzido nem persistido.
- ❌ Nenhum dado de tenant lido em HML que não fosse strictly metadata.

PROD permanece em **Core + migration 017** como descrito no contexto inicial. Consent PROD permanece em GO WITH CONDITIONS. Safety PROD permanece em NO-GO consolidado.

## 12. Próximos passos sugeridos para a sessão seguinte

1. Decisão executiva sobre quando rodar smoke admin em HML (G1, S1).
2. Aprovação para criação da migration `030_safety_cron_schedule.sql`.
3. Endurecimento de `safety-step-up` com `audit_event` e rate limit (S1, S3).
4. Criação dos PRs UI1, UI2, UI3, UI5, UI6.
5. Decisão sobre cleanup expandido (R5) e snapshot de `consent_text_version_id` (C4).
6. **Em janela separada e com autorização**: execução de Consent MVP em PROD.
7. **Em janela separada subsequente**: Safety PROD pre-flight + execução do runbook em §3 do `prod-safety-signals-release-runbook.md`.

Esta sessão é encerrada com PROD intocada e Safety HML pronto para próxima fase de hardening operacional.
