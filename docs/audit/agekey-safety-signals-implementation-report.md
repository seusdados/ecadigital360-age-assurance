# AgeKey Safety Signals — Relatório de Implementação MVP

> Branch: `claude/agekey-safety-signals` (R4).
> Base: `claude/agekey-parental-consent-module` (HEAD do PR #36).
> Data: 2026-05-04.
> Tipo: rodada incremental sobre R3, MVP metadata-only.

## 1. Sumário

Implementado o **AgeKey Safety Signals MVP metadata-only** como extensão do AgeKey Core, integrado ao AgeKey Consent. Subordinado ao Core, sem duplicar contratos.

**Reusa, conforme arquitetura canônica:**
- ✅ Decision Envelope (`decision_domain: 'safety_signal'`)
- ✅ Privacy Guard canônico (perfil `safety_event_v1` rejeita conteúdo bruto)
- ✅ Webhook Contract (`safety.*` events, novo trigger sem alterar Core/Consent)
- ✅ Reason Codes (`SAFETY_*`)
- ✅ Retention Classes (`event_90d` default; `legal_hold` blindado)
- ✅ Policy Engine canônico (block `safety`)
- ✅ `audit_events` particionado do Core
- ✅ `webhook_deliveries` + `webhooks-worker` do Core
- ✅ `verification_sessions` do Core (step-up)
- ✅ `parental_consent_requests` do Consent (consent check)
- ✅ Feature flag `AGEKEY_SAFETY_SIGNALS_ENABLED` (R2)

## 2. Arquivos criados

### Migrations (não-destrutivas; 024–027)

- `024_safety_signals_core.sql` — enums + 8 tabelas + 1 view (`safety_webhook_deliveries`).
- `025_safety_signals_rls.sql` — RLS em todas + triggers append-only e legal_hold.
- `026_safety_signals_webhooks.sql` — `fan_out_safety_alert_webhooks` (INSERT) + `fan_out_safety_alert_status_change` (UPDATE).
- `027_safety_signals_seed_rules.sql` — seed das 5 regras globais.

### packages/shared

- `schemas/safety.ts` — schemas Zod + tipos.
- `safety/relationship.ts` — derivação de relationship pure (testável).
- `safety/rule-engine.ts` — 5 regras hardcoded + agregação.
- `safety/index.ts` — re-exports.

### supabase/functions/_shared/safety

- `feature-flags.ts` — `readSafetyFlags` com defaults canônicos.
- `subject-resolver.ts` — `upsertSafetySubject`.
- `aggregates.ts` — `incrementAggregate` + `readAggregate`.
- `step-up.ts` — `createStepUpSession` (cria `verification_sessions` no Core).
- `consent-check.ts` — `requestParentalConsentCheck` (cria `parental_consent_requests`).
- `payload-hash.ts` — SHA-256 helper.

### 6 Edge Functions

| Path | Endpoint |
|---|---|
| `safety-event-ingest/` | `POST /v1/safety/event` (principal) |
| `safety-rule-evaluate/` | `POST /v1/safety/rule-evaluate` (read-only) |
| `safety-alert-dispatch/` | `POST /v1/safety/alert/:id/dispatch` (admin) |
| `safety-step-up/` | `POST /v1/safety/step-up` |
| `safety-aggregates-refresh/` | cron Bearer CRON_SECRET |
| `safety-retention-cleanup/` | cron — bloqueia legal_hold via GUC |

### SDK (`packages/sdk-js/`)

- `src/safety.ts` — `AgeKeySafetyClient` com `trackEvent`, `getDecision`, `beforeSendMessage`, `beforeUploadMedia`.
- `package.json` — novo entry `./safety`.

### Admin pages (14)

Todas em `apps/admin/app/(app)/safety/`:

1. `layout.tsx` — sub-nav.
2. `page.tsx` — overview com 4 cards (eventos, sujeitos, alertas, abertos).
3. `events/page.tsx` — lista de eventos.
4. `alerts/page.tsx` — lista de alertas com tone por status/severidade.
5. `alerts/[id]/page.tsx` — detalhe do alerta com sujeitos, eventos disparadores, links para step-up/consent.
6. `rules/page.tsx` — lista de regras.
7. `rules/new/page.tsx` — placeholder com SQL para override.
8. `rules/[id]/page.tsx` — detalhe da regra com config_json.
9. `subjects/page.tsx` — lista de sujeitos.
10. `interactions/page.tsx` — lista de pares actor/counterparty.
11. `evidence/page.tsx` — lista de evidências (hash + path), legal_hold visual.
12. `retention/page.tsx` — distribuição por classe + contagem legal_hold.
13. `settings/page.tsx` — variáveis de ambiente do módulo.
14. `integration/page.tsx` — guia de integração com snippets.
15. `reports/page.tsx` — alertas por severidade e por regra.

Sidebar atualizada (entrada "Safety Signals").

### Tests vitest (+27 casos)

- `safety-relationship.test.ts` (9) — derivação + predicates.
- `safety-rule-engine.test.ts` (9) — 5 regras hardcoded + composição + disabled.
- `safety-schemas.test.ts` (9) — schemas + privacy guard `safety_event_v1` (bloqueio de message/raw_text/image/video/audio/birthdate).

**Total cumulativo R1+R2+R3+R4: 182/182 passando.**

### Docs

- `docs/modules/safety-signals/README.md`
- `docs/modules/safety-signals/rules.md`
- `docs/modules/safety-signals/integration-guide.md`
- `docs/audit/agekey-safety-signals-implementation-report.md` (este).

## 3. Arquivos alterados (não-Safety)

- `packages/shared/src/schemas/index.ts` — re-exporta `safety.ts`.
- `packages/shared/src/index.ts` — re-exporta `safety/`.
- `packages/shared/package.json` — entry `./safety`.
- `packages/sdk-js/package.json` — entry `./safety`.
- `apps/admin/components/layout/sidebar.tsx` — entrada "Safety Signals".

## 4. Conformidade com proibições

| Regra | Estado |
|---|---|
| Safety v1 não recebe conteúdo bruto | ✅ Privacy guard `safety_event_v1` rejeita message, raw_text, image, video, audio (e _data variants) — testado. |
| Não interceptar tráfego / TLS / dispositivo | ✅ Apenas POST de metadata pelo cliente. Sem captura. |
| Não usar LLM externo para conteúdo de menor | ✅ Tabela `safety_model_runs` existe mas não é alimentada no MVP. |
| Não criar reconhecimento facial / emotion recognition | ✅ Sem módulo desse tipo. |
| Não criar score universal cross-tenant | ✅ Aggregates são por (tenant + application + subject); nada compartilha entre tenants. RLS bloqueia leitura cross-tenant. |
| Não declarar crime comprovado | ✅ Reason codes não usam termos proibidos (testado em R1). |
| Regras geram reason_code, severity, risk_category, action | ✅ Implementado no rule-engine. |
| Decisão de alto impacto exige revisão humana | ✅ Severity ≥ high inclui `escalate_to_human_review` ou `notify_safety_team`. |
| Step-up cria verification_session do Core | ✅ `_shared/safety/step-up.ts`. |
| Consent check usa AgeKey Consent | ✅ `_shared/safety/consent-check.ts`. |
| Webhook minimizado e assinado | ✅ Trigger SQL reusa fluxo do Core; payload sem PII. |
| Retention cleanup não apaga legal_hold | ✅ Trigger SQL + check de coluna na Edge Function. |

## 5. Validação

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | **5/5** OK. |
| `pnpm lint` | Sem regressão nova. |
| `pnpm test` | **182/182** vitest. |
| `pnpm build` | Não executado (admin Next.js depende de envs Supabase). |

## 6. Riscos remanescentes

1. **`Database` types** do admin não inclui as 9 novas tabelas — pages usam `as never` cast. Após primeira aplicação das migrations em staging, regenerar via `supabase gen types typescript` e remover os casts.
2. **`safety_recompute_messages_24h` RPC** referenciada em `safety-aggregates-refresh` ainda não existe — função SQL precisa ser adicionada em rodada futura para o cron rodar sem fallback. MVP funciona porque aggregates são incrementados em-line no ingest.
3. **Rule editor UI** não foi implementado — overrides per-tenant via SQL apenas.
4. **`safety-alert-dispatch`** usa `X-AgeKey-API-Key`. Para roles admin específicas, migrar para auth-jwt em rodada futura.
5. **`safety_model_runs`** existe mas governança de classificadores é stub — nenhum modelo é executado em V1.
6. **Cross-tenant tests** em staging real ficam para rodada R8 (já planejada).
7. **Resolver `subject_ref_hmac` real do counterparty** quando criando consent check pelo Safety: estamos usando `counterparty.id` como fallback (ID interno) em vez do HMAC do tenant — funcional para correlação, mas idealmente o tenant deveria gerar o HMAC client-side e Safety preservar.

## 7. Próximas rodadas (mantém roteiro do projeto)

| # | Branch | Escopo |
|---|---|---|
| **R5** | `claude/agekey-parental-consent-otp-provider` | Provider real de OTP (SMTP/SMS) para Consent. |
| R6 | `claude/agekey-parental-consent-text-public` | Endpoint público de texto integral no painel. |
| R7 | `claude/agekey-retention-cron` | Cron de cleanup geral (Core + Consent + Safety unificado). |
| R8 | `claude/agekey-cross-tenant-tests` | Tests cross-tenant em staging real. |
| R9 | `claude/agekey-safety-rule-editor` | UI de edição/override de regras. |
| R10 | `claude/agekey-credential-mode` | SD-JWT VC com biblioteca real, issuer, test vectors. |
| R11 | `claude/agekey-proof-mode-zkp` | ZKP/BBS+ idem. |

## 8. Confirmação expressa

Esta rodada **não**:

- ❌ implementou interceptação, vigilância ou spyware.
- ❌ persistiu conteúdo bruto (message, raw_text, image, video, audio).
- ❌ implementou reconhecimento facial.
- ❌ implementou emotion recognition.
- ❌ criou score universal cross-tenant.
- ❌ usou LLM externo para conteúdo de menor.
- ❌ declarou crime comprovado.
- ❌ alterou trigger SQL `fan_out_verification_webhooks` (Core).
- ❌ alterou trigger SQL `fan_out_parental_consent_webhooks` (Consent).
- ❌ implementou SD-JWT VC, ZKP/BBS+ ou gateway real.
- ❌ apagou legal_hold.

A rodada **sim**:

- ✅ entregou metadata-only ingest com privacy guard `safety_event_v1`.
- ✅ entregou 5 regras sistêmicas + composição correta.
- ✅ entregou step-up via Core e consent check via Consent.
- ✅ entregou retention cleanup respeitando legal_hold (trigger + GUC).
- ✅ entregou SDK com stubs honestos que **não recebem conteúdo**.
- ✅ entregou 14 admin pages para visibilidade do tenant.
- ✅ documentou pendências (rule editor, SD-JWT VC, score universal NÃO planejado).
- ✅ executou typecheck (5/5), lint (sem regressão) e test (182/182).
