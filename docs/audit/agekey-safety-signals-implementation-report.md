# Relatório de implementação — AgeKey Safety Signals (Rodada 4)

> Branch: `claude/agekey-safety-signals`.
> Base: `main` em `9052bb0` (logo após o merge do PR #51 — Parental Consent).
> Data: 2026-05-07.
> Dependência: Round 3 (Parental Consent) merged em `main`.

## Sumário executivo

Esta rodada entrega o módulo **AgeKey Safety Signals (MVP
metadata-only)** integrado ao Core canônico e ao módulo de consentimento
parental da rodada anterior. O Core não foi duplicado: o módulo cria um
envelope de decisão peer (`SafetyDecisionEnvelope`), reutilizando o
privacy guard, a disciplina de versionamento, o contrato de webhook, os
reason codes (promovidos de RESERVED para LIVE) e as classes de
retenção. O HMAC por-tenant reutiliza exatamente o helper criado no
módulo Consent (`_shared/consent-hmac.ts`).

Não houve interceptação, spyware, conteúdo bruto persistido, KYC,
reconhecimento facial, emotion recognition, ZKP falso ou SD-JWT falso.

## O que foi entregue

### 1. Contratos compartilhados (`packages/shared/src/safety/`)

| Arquivo | Conteúdo |
|---|---|
| `safety-types.ts` | Catálogos fechados (event types, channels, age states, decisions, severity, relationships) |
| `safety-envelope.ts` | `SafetyDecisionEnvelopeSchema` + `assertSafetyEnvelopeIsPublicSafe` |
| `safety-ingest.ts` | Schema público + `rejectForbiddenIngestKeys` (raw content + PII) |
| `safety-rules.ts` | DSL de regras (operadores, action verbs) + 5 system rules canônicas |
| `safety-engine.ts` | `buildSafetyDecisionEnvelope` + `deriveRelationship` |
| `safety-projections.ts` | `audit diff`, `webhook payload`, `payload hash` (SHA-256 canônico) |
| `safety-feature-flags.ts` | Constantes + leitor de flags |
| `index.ts` | Barrel export |

Mudanças no Core canônico para acomodar o módulo:
- `reason-codes.ts` — promoveu **14 SAFETY_*** de RESERVED para LIVE.
- `taxonomy/reason-codes.ts` — `RESERVED_REASON_CODES = {}` (todos os
  namespaces foram promovidos após Round 3 + 4).
- `webhooks/webhook-types.ts` — adicionou 6 eventos `safety.*` ao
  catálogo LIVE + `WebhookSafetyEventSchema` + extensão da
  discriminated union.
- `retention/retention-classes.ts` — promoveu categorias `consent_*`
  e `safety_*` para LIVE; `isReservedRetentionCategory` agora retorna
  `false` (gancho estrutural mantido).

### 2. Migration Supabase (`supabase/migrations/019_safety_signals.sql`)

Oito tabelas:

1. `safety_subjects`
2. `safety_interactions`
3. `safety_events` (APPEND-ONLY)
4. `safety_rules`
5. `safety_alerts`
6. `safety_aggregates`
7. `safety_evidence_artifacts` (APPEND-ONLY)
8. `safety_model_runs` (reservado / governance flag off)

Características:
- Todas tenant-scoped com RLS habilitado.
- CHECK SQL `safety_jsonb_has_no_forbidden_keys` em todos os campos
  JSON (`metadata`, `rule_eval`, `condition_json`, `action_json`).
- `safety_events` tem **CHECK literal**:
  `content_processed = false` e `content_stored = false`.
- `safety_events` e `safety_evidence_artifacts` têm UPDATE/DELETE
  bloqueados (mirror do `prevent_update_delete`).
- Triggers de auditoria (`audit_safety_change`) escrevem em
  `audit_events` para events e alerts.
- Trigger SQL `fan_out_safety_alert_webhooks` enfileira
  `webhook_deliveries` no INSERT/UPDATE de `safety_alerts`, no formato
  canônico de `WebhookSafetyEventSchema`.

### 3. Edge Functions (Deno)

| Função | Endpoint | Auth | Estado |
|---|---|---|---|
| `safety-event-ingest` | `POST /v1/safety/event-ingest` | API key | Implementado completo (rejeita raw content/PII, HMAC, upsert subject, INSERT event, evaluate rules, INSERT alert, audit_events) |
| `safety-rule-evaluate` | `POST /v1/safety/rule-evaluate` | API key | Implementado (não persiste) |
| `safety-step-up` | `POST /v1/safety/step-up` | API key | Implementado (cria verification_session canônica) |
| `safety-alert-dispatch` | `POST /v1/safety/alert-dispatch` | API key | **STUB** documentado — re-emit explícito requer rodada de hardening |
| `safety-aggregates-refresh` | `POST /v1/safety/aggregates-refresh` | cron secret | **STUB** documentado — upsert per-bucket é P3 |
| `safety-retention-cleanup` | `POST /v1/safety/retention-cleanup` | cron secret | dry-run-by-default; expurgo real depende de partition DETACH (P3) |

Helper compartilhado: `supabase/functions/_shared/safety-envelope.ts`
re-exporta o builder canônico.

### 4. Admin UI (Next.js, skeleton)

- `apps/admin/app/(app)/safety/page.tsx` — dashboard listando alertas
  abertos e eventos recentes (sem PII, sem IP, sem refs cruas).
- `apps/admin/components/layout/sidebar.tsx` — entrada "Sinais de
  risco" no menu lateral.

### 5. SDK (`packages/sdk-js/src/safety.ts`)

`AgeKeySafetyClient` com métodos:
- `trackEvent(event)` — chamada server-side ao endpoint de ingest.
- `getDecision(eventId)` — STUB documentado (lookup ainda não exposto).
- `beforeSendMessage(input)` — STUB que **rejeita** `text` argumento.
- `beforeUploadMedia(input)` — STUB que **rejeita** `bytes`/`blob`/`file`.

Objetivo: fixar o contrato metadata-only no SDK para que integradores
não dependam de uma análise de conteúdo que o MVP não faz.

### 6. Documentação (`docs/modules/safety-signals/`)

13 documentos: `README`, `PRD`, `DATA_MODEL`, `API_CONTRACT`, `TAXONOMY`,
`PRIVACY_GUARD`, `RLS_AND_SECURITY`, `RETENTION`, `AI_GOVERNANCE`,
`FRONTEND_SPEC`, `EDGE_FUNCTIONS`, `IMPLEMENTATION_BACKLOG`,
`COMPLIANCE_NOTES`.

### 7. Testes

#### Vitest (corre localmente, gate de CI)

| Arquivo | Testes |
|---|---|
| `packages/shared/src/safety/safety-ingest.test.ts` | 8 |
| `packages/shared/src/safety/safety-engine.test.ts` | 14 |

Total novo: **22 testes** cobrindo:
- privacy guard bloqueia PII no ingest com reason `SAFETY_PII_DETECTED`,
- ingest rejeita raw content (`message`, `image`, `video`, `audio`,
  `attachment`, etc.) com reason `SAFETY_RAW_CONTENT_REJECTED`,
- `content_processed=true` é rejeitado pelo schema literal,
- `content_stored=true` é rejeitado pelo schema literal,
- evento desconhecido é rejeitado,
- metadata limitado em tamanho e número de chaves,
- relationship derivation correta para adult/minor/unknown,
- rule engine: unknown→minor DM gera `step_up_required`,
- rule engine: alta frequência adult→minor gera `rate_limited` + alerta,
- rule engine: media upload to minor gera `soft_block` + needs_review,
- rule engine: repeat-reported actor gera needs_review,
- envelope nunca carrega PII ou refs cruas,
- payload hash determinístico em hex,
- audit diff omite refs HMAC,
- webhook payload satisfaz schema canônico,
- webhook payload não inclui chaves de raw content nem PII.

Atualizei `taxonomy/reason-codes.test.ts` (novo teste para
`SAFETY_RISK_FLAGGED` como LIVE) e `retention/retention-classes.test.ts`
(safety/consent agora não-reservados).

#### Deno (corre no CI Edge Functions)

| Arquivo | Testes |
|---|---|
| `supabase/functions/_tests/safety-envelope.test.ts` | 5 |

Cobertura: relationship derivation, decisão step_up_required,
webhook payload schema, audit diff sem refs, payload hash determinístico.

## Resultado dos comandos

| Comando | Resultado |
|---|---|
| `pnpm install` | OK |
| `pnpm typecheck` | 5/5 packages OK |
| `pnpm test` | 17 test files / **207 testes** OK (185 da rodada anterior + 22 novos do Safety) |
| `pnpm lint` | OK |

`pnpm build` continua com a falha pré-existente em `@agekey/sdk-js`
(não é regressão desta rodada).

## Mapeamento dos critérios da Fase B

| Critério | Status |
|---|---|
| MVP metadata-only implementado | ✅ |
| Eventos mínimos aceitos | ✅ (22 event types canônicos) |
| Conteúdo bruto rejeitado | ✅ (boundary check + Zod literal + CHECK SQL) |
| Privacy guard ativo | ✅ (3 camadas) |
| RLS aplicado | ✅ (8 tabelas) |
| Rule engine inicial | ✅ (5 system rules + DSL com operator allowlist) |
| Alertas criados | ✅ (`safety_alerts` + trigger fan-out) |
| Step-up usa Core verification_session | ✅ (`safety-step-up` chama `resolvePolicy` + INSERT canônico) |
| Consent check usa AgeKey Consent | ✅ (decision `parental_consent_required` + webhook event `safety.parental_consent_check_required`) |
| Webhooks minimizados | ✅ (`WebhookSafetyEventSchema` strict + privacy guard) |
| Retention cleanup existe | ✅ (dry-run-by-default; particionamento real é P3) |
| Testes passando | ✅ |

## Itens declarados como stub honesto

1. **`safety-alert-dispatch`** — re-emit explícito requer chamada
   manual a `webhook_deliveries`; gated atrás da rodada de
   webhooks-hardening.
2. **`safety-aggregates-refresh`** — registra log de tamanho da amostra;
   upsert per-bucket completo é P3.
3. **`safety-retention-cleanup`** — dry-run-by-default; expurgo real
   depende de particionamento mensal de `safety_events` (P3).
4. **Edge Functions content/media analysis** — todas as flags
   `AGEKEY_SAFETY_CONTENT_*` / `MEDIA_GUARD_*` ficam **OFF**.
5. **`safety_model_runs`** — tabela criada, vazia por padrão; ligar
   exige `AGEKEY_SAFETY_MODEL_GOVERNANCE_ENABLED`.
6. **SDK helpers `beforeSendMessage`/`beforeUploadMedia`** —
   honest stubs que **rejeitam** raw content/bytes para fixar o
   contrato metadata-only no integrador.
7. **Aggregates inline no ingest** — MVP usa `count(*)` ad-hoc na hora
   da avaliação; o snapshot de aggregates pré-computados é otimização
   P2.

## Riscos remanescentes

1. **`safety_events` cresce sem particionamento**: até a rodada de
   particionamento mensal entrar, o expurgo real está bloqueado e a
   tabela vai crescer linearmente. Mitigação: dry-run-by-default
   permite acompanhar a contagem.
2. **Aggregates ad-hoc no ingest**: `count(*)` por actor a cada
   ingest pode ficar caro em cargas altas. Index existe
   (`idx_safety_events_actor`); migrar para `safety_aggregates`
   pré-computado é otimização P2.
3. **Sample-only rules**: o motor MVP avalia todas as regras
   linearmente; tenant pode adicionar regras pesadas. Mitigação atual:
   máximo de 32 sub-rules por grupo, validado pelo schema.
4. **HMAC fallback** (herdado do Consent): produção precisa
   provisionar Vault key dedicada antes de subir o flag.
5. **Webhook signature** continua usando `secret_hash` como key (mesmo
   formato do Core e do Consent). Hardening em P4.
6. **Consent interlock automático** (auto-emitir
   `parental-consent-session-create` quando rule pedir) é P3 — produto
   precisa decidir billing.
7. **`pnpm build` pré-existente** em `@agekey/sdk-js` continua
   falhando (não é regressão).

## Confirmações finais

- ❌ **Não houve interceptação** de tráfego TLS ou comunicações.
- ❌ **Não houve spyware** ou monitoramento de dispositivo fora da
  aplicação cliente.
- ❌ **Não houve conteúdo bruto** persistido (3 camadas de defesa).
- ❌ **Não houve KYC** ou identificação civil.
- ❌ **Não houve reconhecimento facial** ou biometria.
- ❌ **Não houve emotion recognition**.
- ❌ **Não houve score universal** cross-tenant
  (`safety_subjects.risk_score` é per-tenant).
- ❌ **Não houve ZKP falso** ou SD-JWT falso.
- ❌ **Não houve duplicação do Core**: privacy guard, decision
  envelope, webhook signer, reason codes e retention vieram do
  canônico.
- ✅ **Houve módulo MVP coeso**, com schemas, migration, edge
  functions, UI skeleton, SDK helper, docs e testes.
