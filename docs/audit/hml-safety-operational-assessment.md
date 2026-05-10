# HML Safety Signals — Operational Assessment

**Branch:** `claude/safety-signals-operational-hardening`
**Base SHA:** `0cd4d8e` (origin/main, fix(website): SVG motion + render polish, #84)
**Data:** 2026-05-10
**Escopo:** apenas Safety Signals em HML, em modo read-only/análise. PROD intocada. Nenhuma migration aplicada, nenhum schema remoto alterado, nenhuma feature flag remota mudada.

---

## 1. TL;DR

- Safety HML está com **núcleo metadata-only operacional**: ingest, rule-evaluate, rules-write e privacy guard negativo passam.
- **4 endpoints permanecem em SKIP** por dependência de credenciais ou contexto: `safety-alert-dispatch`, `safety-step-up`, `safety-aggregates-refresh`, `safety-retention-cleanup`.
- Privacy Guard `safety_event_v1` e envelope público minimizado (`content_included=false`, `pii_included=false`) estão aplicados em todas as funções públicas.
- Não há regressão em typecheck (7/7), lint (2/2) ou test (359 shared + 1 cross-tenant; 10 cross-tenant gated por env).
- Veredito: **Safety HML pronto para a próxima fase de hardening operacional** (alert real metadata-only e cron com autorização). **NÃO está pronto para PROD ainda** — depende de Consent ir antes e de uma janela própria.

## 2. Inventário canônico

### 2.1 Edge Functions

| Function | Path | Auth | Classe | Status HML |
| --- | --- | --- | --- | --- |
| safety-event-ingest | `supabase/functions/safety-event-ingest/index.ts` (460 linhas) | `X-AgeKey-API-Key` | Public/API-key | ✅ smoke OK; privacy guard ativo |
| safety-rule-evaluate | `supabase/functions/safety-rule-evaluate/index.ts` (182) | `X-AgeKey-API-Key` | Public/API-key | ✅ smoke OK |
| safety-rules-write | `supabase/functions/safety-rules-write/index.ts` (230) | `X-AgeKey-API-Key` (admin do tenant) | Public/API-key (escopo admin) | ✅ smoke OK; bloqueia edição global; força tenant_id |
| safety-alert-dispatch | `supabase/functions/safety-alert-dispatch/index.ts` (125) | `X-AgeKey-API-Key` | Admin/Alert-dependent | ⚠ SKIP — exige `SAFETY_ALERT_ID` |
| safety-step-up | `supabase/functions/safety-step-up/index.ts` (135) | `X-AgeKey-API-Key` | Admin/Alert-dependent | ⚠ SKIP — exige `SAFETY_ALERT_ID` |
| safety-aggregates-refresh | `supabase/functions/safety-aggregates-refresh/index.ts` (73) | `Authorization: Bearer ${CRON_SECRET}` | Cron/privileged | ⚠ SKIP — exige `SAFETY_CRON_SECRET` |
| safety-retention-cleanup | `supabase/functions/safety-retention-cleanup/index.ts` (215) | `Authorization: Bearer ${CRON_SECRET}` | Cron/privileged | ⚠ SKIP — exige `SAFETY_CRON_SECRET` |

### 2.2 Helpers compartilhados (`supabase/functions/_shared/safety/`)

| Arquivo | Responsabilidade |
| --- | --- |
| `feature-flags.ts` (25 linhas) | `enabled`, `parentalConsentEnabled`, retention class default, batch size |
| `payload-hash.ts` | SHA-256 do raw body (auditoria sem persistir conteúdo) |
| `subject-resolver.ts` | Upsert idempotente em `safety_subjects` (só upgrade `unknown→known`) |
| `aggregates.ts` | Increment + read de `safety_aggregates` |
| `step-up.ts` (49 linhas) | Cria `verification_session` no Core (reusa contrato do Core) |
| `consent-check.ts` (80 linhas) | Cria `parental_consent_request` direto na tabela quando regra exige |

### 2.3 Pure libs (`packages/shared/src/safety/`)

| Arquivo | Responsabilidade | Cobertura de testes |
| --- | --- | --- |
| `relationship.ts` | `deriveRelationship(actor, counterparty)` | `safety-relationship.test.ts` (9) |
| `rule-engine.ts` | 5 regras hardcoded + agregação | `safety-rule-engine.test.ts` (9) + `safety-rule-engine-severity-action.test.ts` (9) |
| `index.ts` | re-exports | — |

Schemas (`packages/shared/src/schemas/safety.ts`) cobertos por `safety-schemas.test.ts` (9), `safety-rule-write-schema.test.ts` (8) e `safety-privacy-guard-rejects-raw.test.ts` (66 — defesa em profundidade contra raw_text/PII em todos os campos).

### 2.4 Migrations Safety (apenas leitura — não rodar)

| Migration | Conteúdo | Status |
| --- | --- | --- |
| `024_safety_signals_core.sql` | Enums + 8 tabelas + view `safety_webhook_deliveries` | ✅ aplicada em HML |
| `025_safety_signals_rls.sql` | RLS em todas as tabelas + triggers append-only e legal_hold | ✅ aplicada em HML |
| `026_safety_signals_webhooks.sql` | `fan_out_safety_alert_*` triggers | ✅ aplicada em HML |
| `027_safety_signals_seed_rules.sql` | Seed das 5 regras globais | ✅ aplicada em HML |
| `028_retention_cron_schedule.sql` | pg_cron para `agekey-retention-job` (Core) — não cobre Safety retention separadamente | ✅ aplicada em HML; Safety retention precisa de schedule próprio |

### 2.5 Routes admin (`apps/admin/app/(app)/safety/`)

| Rota | Função | Linhas | Observações |
| --- | --- | --- | --- |
| `/safety` | Visão geral | 47 | 4 cards: events, subjects, alerts, open alerts |
| `/safety/events` | Lista de eventos | 63 | Mostra: id, event_type, occurred_at, retention_class, legal_hold, payload_hash |
| `/safety/alerts` | Lista de alertas | 100 | severity/status com tons; reason_codes |
| `/safety/alerts/[id]` | Detalhe de alerta | 151 | Mostra subjects via HMAC encurtado, step_up/consent links |
| `/safety/rules` | Lista de regras | 65 | Distingue global (tenant_id null) de override per-tenant |
| `/safety/rules/new` | Criar regra | 34 | Hoje só placeholder com SQL — ver gap §5 |
| `/safety/rules/[id]` | Detalhe regra | 64 | Read-only |
| `/safety/rules/actions.ts` | Server actions | 62 | POST/PATCH/DELETE via `safety-rules-write` |
| `/safety/subjects` | Sujeitos | 59 | HMAC encurtado, age_state, counters |
| `/safety/interactions` | Interações | 62 | relationship + counters |
| `/safety/evidence` | Evidência | 73 | Hash + mime + size; nunca conteúdo |
| `/safety/retention` | Retention | 64 | Eventos por classe + legal_hold count |
| `/safety/integration` | Integração | 55 | Snippets de SDK e proxy server-side |
| `/safety/settings` | Configurações | 40 | Lista de feature flags (read-only via env) |
| `/safety/reports` | Relatórios | 56 | Alertas por severidade e por regra |

### 2.6 Smoke script

`scripts/smoke/safety-smoke.sh` (versão hardened, 353 linhas):

- Separa **3 classes** de teste (Public/API-key, Admin/Alert-dependent, Cron/Bearer).
- **PASS / FAIL / SKIP** com contadores e resumo final.
- **Exit 0** se PASS+SKIP cobrem; **exit 1** se houver qualquer FAIL.
- Valida explicitamente `content_included=false` e `pii_included=false` no envelope público (POS-1, POS-2, POS-5).
- 9 testes negativos do Privacy Guard cobrindo `raw_text`, `message`, `image`, `video`, `audio`, `birthdate`, `email`, `phone` e `raw_text` em raiz.
- Nunca ecoa `TENANT_API_KEY` nem `SAFETY_CRON_SECRET` no stdout.
- Subject refs via HMAC opaco; nenhum payload contém PII.

## 3. Privacy invariants — verificação cruzada

Confirmado em código:

- `safety-event-ingest` chama `assertPayloadSafe(body, 'safety_event_v1')` antes do Zod (linha 96), depois novamente em `metadata` (linha 124), e finalmente em `response` no perfil `public_api_response` (linha 438).
- `safety-rule-evaluate` aplica `safety_event_v1` no body (linha 60) e `public_api_response` na resposta (linha 167).
- `safety-step-up` aplica `public_api_response` na resposta (linha 120) e nunca expõe PII do alert.
- `safety-rules-write` aplica `admin_minimized_view` no body POST/PATCH (linhas 67/166) e `public_api_response` na resposta.
- `safety-alert-dispatch` aplica `admin_minimized_view` no body (linha 62).
- `safety-retention-cleanup` opera por `retention_class`, com filtro explícito `legal_hold = false` (linha 113) e count separado de skips por legal hold (linhas 79–107) com auditoria.
- Nenhuma function persiste `raw_text`, `message`, `image`, `video`, `audio`, `birthdate`, `exact_age`, `email`, `phone`, IP, GPS, biometric, civil_name, document. Privacy Guard `forbidden-claims.ts` rejeita ao nível do schema (case-insensitive, normaliza `_`/`-`).

## 4. Aderência aos princípios não negociáveis (1–14)

| # | Princípio | Status |
| --- | --- | --- |
| 1 | Metadata-only no MVP | ✅ |
| 2 | Não armazena conteúdo bruto | ✅ |
| 3 | Não aceita raw_text/message/image/video/audio em payload público v1 | ✅ rejeição com HTTP 400 e `PRIVACY_CONTENT_NOT_ALLOWED_IN_V1` |
| 4 | Não intercepta tráfego | ✅ Safety só recebe metadata via API key do tenant |
| 5 | Não monitora dispositivo fora da aplicação | ✅ |
| 6 | Não declara crime/culpa/conclusão jurídica | ✅ vocabulário do dashboard usa "alerta", "evento", "sinal", "interação" — ver §6 da UI readiness |
| 7 | Sinais proporcionais + reason codes + severidade + ações + auditoria | ✅ envelope `decision`, `severity`, `risk_category`, `reason_codes[]`, `actions[]`, `step_up_required`, `parental_consent_required` |
| 8 | High/critical exigem revisão humana, step-up ou consent | ✅ rule-engine força `severity ↔ action` invariant |
| 9 | Não existe score universal cross-tenant | ✅ todas as queries são RLS-gated por `tenant_id` |
| 10 | RLS em todas as multi-tenant | ✅ migration 025 |
| 11 | service_role somente server-side | ✅ admin actions usam server-side fetch com `agekeyEnv.adminApiKey()` |
| 12 | `content_included=false` + `pii_included=false` em respostas públicas | ✅ assertado pelo smoke |
| 13 | Reason codes canônicos | ✅ `SAFETY_*` em `packages/shared/src/taxonomy/reason-codes.ts` |
| 14 | Privacy Guard em `safety_event_v1` | ✅ aplicado em event-ingest e rule-evaluate |

## 5. Gaps conhecidos (HML)

### G1 — Smoke não consegue gerar alert de teste sozinho
A regra mais leve para disparar alert é `UNKNOWN_TO_MINOR_PRIVATE_MESSAGE` (severity baixa). O smoke já manda evento que satisfaz a regra; o que ele não faz é capturar `alert_id` da resposta para encadear POS-4/POS-5. **Próximo PR opcional**: extrair `alert_id` da resposta do POS-1 e usá-lo como fallback para o SAFETY_ALERT_ID. Não fazer ainda — exige aprovação para criar alert real em HML.

### G2 — Cron não tem schedule dedicado para Safety
Migration `028_retention_cron_schedule.sql` agenda apenas o `agekey-retention-job` do Core. Safety `safety-retention-cleanup` e `safety-aggregates-refresh` não têm schedule próprio. **Decisão pendente**: criar migration `030_safety_cron_schedule.sql`? Sim, porém só em janela própria com aprovação.

### G3 — UI de override de regra é placeholder
`/safety/rules/new` mostra apenas SQL e diz que "Edição via UI será adicionada em rodada futura". `actions.ts` já tem `createRuleOverride/patchRuleOverride/deleteRuleOverride`, mas não há formulário plugado. **Não bloqueia HML operacional** (admin pode usar o endpoint diretamente), mas é debt para o pacote PROD.

### G4 — Safety não cobre `safety-alert-dispatch` quando o operador é JWT
Comentário no código `safety-alert-dispatch/index.ts:6-7`: "auth: X-AgeKey-API-Key (admin do tenant via api_key dedicada — em rodada futura, exigir role 'admin' via auth-jwt)". Hoje qualquer api_key válida do tenant pode despachar; deveria ser uma key dedicada de admin. **Mitigação atual**: tenant emite key separada para admin no console. **Hardening futuro**: validar role.

### G5 — Smoke não roda tests cross-tenant em CI
`packages/integration-tests` tem `__tests__/safety-cross-tenant.test.ts` (4 testes) e `consent-cross-tenant.test.ts` (3) ambos `skipped` por env. CI executa `vitest run` sem credenciais; tests são gated. **Não é bloqueador** (cobertura está nos schemas), mas o status de skip merece destaque no relatório final.

### G6 — `safety-aggregates-refresh` depende de função SQL `safety_recompute_messages_24h`
Linha 51 invoca `client.rpc('safety_recompute_messages_24h')`. **A migration que cria essa função não está no histórico canônico Safety** (024–028). Pode ser que ela viva em uma migration anterior ou esteja faltando. **Ação**: verificar antes de executar o cron com secret. Se não existir, será necessária migration de criação (bloqueada por escopo desta sessão).

## 6. Riscos atuais

| Risco | Severidade | Mitigação atual |
| --- | --- | --- |
| Cron secret vazar em smoke público | Crítico | Smoke nunca ecoa o secret, e POS-6/POS-7 estão SKIP por padrão |
| Tenant API key reutilizada em múltiplos contextos | Médio | Recomendar key dedicada para admin (G4) |
| Aggregate desincronizado com events apagados pelo retention | Médio | Aggregates idempotentes via `safety-aggregates-refresh` (depende de G6) |
| Legal hold ignorado em DELETE | Crítico | GUC `agekey.retention_cleanup` + filtro explícito + auditoria de skip (já implementado) |
| UI exibir PII via campo errado | Crítico | UI lê apenas colunas seguras (HMAC encurtado, retention_class, severity); auditoria em §6 da UI readiness |
| PROD receber Safety por engano | Crítico | Workflow `deploy-hml-edge-functions.yml` é manual e hardcoded em HML; PROD exige decisão executiva separada |

## 7. Próximos passos recomendados

| ID | Ação | Quem decide | Bloqueador |
| --- | --- | --- | --- |
| N1 | Validar G6 — existência de `safety_recompute_messages_24h` em HML | Eng | nenhum (read-only via Studio ou `list_migrations`) |
| N2 | Decidir se geramos alert real metadata-only em HML para encadear POS-4/POS-5 | Eng + Produto | autorização explícita |
| N3 | Decidir se rodamos `safety-aggregates-refresh` em HML com o cron secret | Eng + Ops | autorização explícita; G6 deve estar resolvido |
| N4 | Decidir se rodamos `safety-retention-cleanup` em HML com o cron secret | Eng + Ops | autorização explícita |
| N5 | UI de override de regra (G3) | Produto | depende de tela aprovada |
| N6 | Criar migration `030_safety_cron_schedule.sql` (apenas para HML, depois para PROD) | Eng | aprovação para tocar schema; **NÃO nesta sessão** |
| N7 | PROD Safety release pack — apenas documentação | Eng | já feito nesta sessão |

## 8. Confirmação de não-execução em PROD

- Nenhuma migration foi rodada.
- Nenhuma feature flag remota foi alterada.
- Nenhum `db push`, `migration repair`, `db reset` ou `db pull` foi executado.
- Nenhum endpoint cron foi disparado com o secret.
- PROD está intacta — Core + migration 017 apenas, conforme estado anterior à sessão.
- Esta sessão tocou exclusivamente: `scripts/smoke/safety-smoke.sh` (hardening do existente) e `docs/audit/*` + `docs/release/*` (criação de relatórios).
