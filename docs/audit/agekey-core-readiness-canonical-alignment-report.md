# AgeKey — Relatório Core Readiness Canonical Alignment

> Branch: `claude/agekey-core-readiness-canonical-alignment`.
> Base: `claude/agekey-canonical-modular-architecture` (HEAD do PR #34).
> Data: 2026-05-04.
> Tipo: rodada incremental, **stacked PR** sobre PR #34 — não duplica artefatos da Rodada 1.

## 1. Branch e base

- Branch criada: `claude/agekey-core-readiness-canonical-alignment`.
- Base: `claude/agekey-canonical-modular-architecture` (HEAD `e61f5d4`).
- Estado da base: PR #34 aberto, draft, status `success`, `mergeable_state: clean`.
- Alvo do PR: branch do PR #34 (stacked). Quando PR #34 for mergeado em `agekey/production-readiness-20260429`, este PR pode ser rebased ou ter seu alvo redirecionado.

## 2. Escopo executado

Esta rodada **integrou gradualmente** a camada canônica criada em R1 (PR #34) ao Core real do AgeKey, **sem** quebrar compatibilidade pública e **sem** alterar formatos de wire.

### 2.1 Pontos legados encontrados e sua estratégia

| Ponto | Estado encontrado | Estratégia | Status |
|---|---|---|---|
| `assertPublicPayloadHasNoPii` | **0 callers reais**; só auto-referência em `agekey-claims.ts` | Delegar internamente ao canônico (perfil `public_api_response`) | ✅ |
| `REASON_CODES` legado | Usado em SDK, adapters, `verifications-session-complete`, `_shared/errors.ts` | Bridge em `_shared/errors.ts` re-exportando `CANONICAL_REASON_CODES` | ✅ |
| `ResultTokenClaimsSchema` | Schema fixo, sem `decision_id`/`decision_domain` | Adicionar `ResultTokenClaimsCanonicalSchema` opcional, compat 100% | ✅ |
| Webhook signature | Computada em SQL trigger `fan_out_verification_webhooks` | Não alterar SQL. Worker envia headers canônicos em paralelo | ✅ (parcial — migração SQL pendente) |
| Webhook payload | Construído em SQL `build_verification_event_payload` | Não alterar SQL. Mapper TS disponível para consumidores | ✅ (parcial — migração SQL pendente) |
| Decision shape em `session-complete` | Custom (snake_case) | Mapper `toCanonicalEnvelope` para consumidores novos | ✅ |
| Token signing path | Sem privacy guard explícito | Aplicar `assertPayloadSafe(claims, 'public_token')` defensivo | ✅ |
| Feature flags | Inexistentes | Criar `feature-flags` em `@agekey/shared` com defaults `false` | ✅ |
| Admin labels problemáticas (`KYC`, `idade real`, `verificar identidade`) | **0 ocorrências** | Sem ação | N/A |
| SDK `AgeKeyWebhookPayload` local | Definido em `packages/sdk-js/src/server.ts` | Sem alteração nesta rodada (compat) | adiado |

## 3. Arquivos alterados

### `packages/shared/src/`

| Arquivo | Mudança |
|---|---|
| `privacy-guard.ts` | Delega para o guard canônico (`./privacy/privacy-guard.ts`) preservando assinatura pública e a lista `FORBIDDEN_PUBLIC_KEYS` legada. Comportamento estritamente igual ou mais restritivo. |
| `feature-flags/feature-flags.ts` | **Novo**. 6 flags canônicas + helpers `isFlagOn`, `readFeatureFlags`, `AGEKEY_FEATURE_DISABLED_REASON_CODES`. |
| `feature-flags/index.ts` | **Novo**. Re-export. |
| `decision/legacy-mapper.ts` | **Novo**. `toCanonicalEnvelope`, `mapLegacyDecisionStatus`, `LegacyVerificationLike`. |
| `decision/index.ts` | Re-exporta `legacy-mapper.ts`. |
| `schemas/tokens-canonical.ts` | **Novo**. `ResultTokenClaimsCanonicalSchema`, `hasCanonicalAgekeyExtensions`. |
| `schemas/index.ts` | Re-exporta `tokens-canonical.ts`. |
| `index.ts` | Re-exporta `feature-flags/`. |

### `packages/shared/__tests__/`

| Arquivo | Casos |
|---|---|
| `feature-flags-canonical.test.ts` | **21 casos** — defaults, parsing de env, mapeamento de reason code de fallback. |
| `decision-legacy-mapper.test.ts` | **6 casos** — mapping fiel, status desconhecido vira `error`, envelope passa pelo privacy guard. |
| `tokens-canonical.test.ts` | **6 casos** — schema canônico aceita extensões, schema legado tolera, privacy guard valida claims. |
| `privacy-guard-legacy-delegation.test.ts` | **5 casos** — chaves legadas continuam bloqueadas; chaves canônicas adicionais agora também são; reason code presente na mensagem do `Error`. |

Total: **+38 casos** (R1 tinha 88 → R2 tem **126/126** passando).

### `packages/shared/package.json`

- Adiciona export `./feature-flags`.

### `supabase/functions/_shared/errors.ts`

- Adiciona bridge re-exportando `CANONICAL_REASON_CODES`, `FORBIDDEN_REASON_CODE_TERMS`, `AgeKeyReasonCode`, `CanonicalReasonCode` ao lado do `REASON_CODES` legado.

### `supabase/functions/webhooks-worker/index.ts`

- Importa `WEBHOOK_HEADERS` e `payloadHash` do `@agekey/shared/webhooks`.
- Envia headers canônicos **em paralelo** aos legados:
  - Mantém `X-AgeKey-Event-Type`, `X-AgeKey-Delivery-Id`, `X-AgeKey-Signature`.
  - Adiciona `X-AgeKey-Webhook-Timestamp`, `X-AgeKey-Payload-Hash`, `X-AgeKey-Event-Id`, `X-AgeKey-Idempotency-Key` (espelha o legado), `X-AgeKey-Event-Type` canônico.
- **Não altera** o trigger SQL nem o formato da assinatura — receivers existentes continuam validando exatamente como antes.

### `supabase/functions/verifications-session-complete/index.ts`

- Adiciona import de `assertPayloadSafe` e `PrivacyGuardForbiddenClaimError`.
- Aplica `assertPayloadSafe(claims, 'public_token')` antes de `signResultToken`. Se um adapter futuro defeituoso tentar emitir token com PII (documento, e-mail, idade exata), o token é rejeitado e a sessão termina com `InternalError` + log defensivo. Em condições normais, **isto nunca dispara**.

### `docs/`

| Arquivo | Mudança |
|---|---|
| `docs/specs/agekey-feature-flags.md` | **Novo**. Spec das 6 flags canônicas, defaults, regras de ativação. |
| `docs/specs/agekey-token.md` | Acrescenta seção "Claims canônicas opcionais" (decision_id, decision_domain, reason_codes). |
| `docs/specs/agekey-webhook-contract.md` | Acrescenta seção §10 documentando estado atual da migração e pendências SQL. |
| `docs/specs/sdk-public-contract.md` | Acrescenta tabela de headers de webhook recebidos + nota sobre `ResultTokenClaimsCanonicalSchema` e `toCanonicalEnvelope`. |
| `docs/implementation/agekey-modular-implementation-roadmap.md` | Atualiza P1 para refletir progresso desta rodada. |
| `docs/audit/agekey-core-readiness-canonical-alignment-report.md` | **Este arquivo**. |

## 4. Pontos que permaneceram legados por compatibilidade

Foram **deliberadamente não migrados** nesta rodada porque a migração seria destrutiva ou quebraria consumidores externos. Cada item está claramente documentado:

1. **Trigger SQL `fan_out_verification_webhooks`** (`012_webhook_enqueue.sql`) — formato de assinatura `HMAC(secret_hash, payload_text)` permanece. Migração para `HMAC(secret, ${ts}.${nonce}.${body})` exige nova migration + atualização do SDK + janela de compat. Documentado em `docs/specs/agekey-webhook-contract.md` §10.2.
2. **Função SQL `build_verification_event_payload`** — payload do webhook continua sem `decision_domain`/`decision_id`/`payload_hash`/`content_included`. Migração descrita em §10.3 do mesmo doc.
3. **Schema legado `ResultTokenClaimsSchema`** — não usa `.strict()`, então campos extras são tolerados; permanece o contrato público mínimo. Tokens novos podem usar `ResultTokenClaimsCanonicalSchema` opcionalmente.
4. **Adapters (`fallback`, `gateway`, `vc`, `zkp`)** — continuam usando `REASON_CODES` legado. Bridge no `errors.ts` permite migração futura sem alteração emergencial.
5. **SDK `AgeKeyWebhookPayload`** — interface restritiva continua exportada; consumidores ainda validam apenas eventos `verification.*`. Convivência com canônico `@agekey/shared/webhooks` documentada.
6. **`apps/admin/types/database.ts` e demais tipos derivados de Supabase** — não tocados; refletem o schema atual.

## 5. Testes executados

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | **5/5** pacotes OK (`@agekey/shared`, `@agekey/sdk-js`, `@agekey/widget`, `@agekey/admin`, `@agekey/adapter-contracts`). |
| `pnpm lint` | OK. 1 warning preexistente em `apps/admin/app/(app)/policies/policy-form.tsx:473` — **não introduzido**. |
| `pnpm test` | **126/126** vitest em `@agekey/shared` (88 de R1 + 38 novos). |
| `pnpm build` | **Não executado** — admin Next.js depende de envs Supabase não disponíveis no sandbox. Mesma pendência declarada em R1. |

Nenhuma falha. Nenhuma regressão.

## 6. Riscos remanescentes

1. **Receivers do webhook não validam ainda os headers canônicos.** Se um receiver começar a exigir `X-AgeKey-Webhook-Timestamp` antes de migrar a infra de assinatura, ele aceitará entregas, mas a janela de 5 minutos não terá garantia formal — porque o timestamp atual reflete o instante de envio do worker, não o momento da emissão. Para receivers críticos, recomendar continuar usando `X-AgeKey-Signature` legado até a migração SQL.
2. **`PrivacyGuardForbiddenClaimError` em `verifications-session-complete`** é um caminho defensivo nunca testado em integração. Se um adapter introduzir PII por engano em produção, o token será rejeitado com `InternalError` (sem leak). O log gerado (`privacy_guard_blocked_token`) é a única pista — recomendar alerta SIEM nessa string.
3. **`webhooks-worker` adiciona um `payloadHash` SHA-256 por delivery em runtime.** Custo desprezível (1 hash/delivery), mas em volumes muito altos pode aparecer em latência P99. Métricas existentes não cobrem isso — adicionar em rodada futura.
4. **`feature flags`** ainda não são lidas por nenhum caminho real do Core (gateway/zkp/credential adapters continuam usando seu próprio caminho de "unsupported"). A integração exige passagem por `_shared/env.ts` em rodada própria. Os flags estão prontos; a leitura ainda não.
5. **Audit events com `decision_id`** exige migration aditiva ou uso de `diff_json` — nenhum dos dois feito nesta rodada.
6. **Billing events com `decision_domain`** idem — exige migration aditiva.

## 7. Próximos passos para Consent

Branch sugerida: `claude/agekey-parental-consent-module`.

Pré-requisitos prontos nesta rodada:

- ✅ Decision Envelope canônico com `decision_domain: 'parental_consent'`.
- ✅ Reason codes `CONSENT_*` no catálogo canônico.
- ✅ Privacy Guard com perfil `guardian_contact_internal` (única classe que tolera `guardian_email`/`guardian_phone`/`guardian_name`).
- ✅ Webhook contract com eventos `parental_consent.*`.
- ✅ Retention classes `consent_active_until_expiration` e `consent_expired_audit_window`.
- ✅ Policy engine com bloco `consent` (purpose codes, data categories, AAL-C).
- ✅ Feature flag `AGEKEY_PARENTAL_CONSENT_ENABLED` (default `false`).
- ✅ Schema canônico de token (`ResultTokenClaimsCanonicalSchema`) pronto para emitir `parental_consent_token` com mesmas claims base + `decision_domain: 'parental_consent'`.

Falta na rodada própria: migrations Consent (tabelas listadas em `docs/architecture/agekey-canonical-data-model.md` §3), Edge Functions, painel parental backend, Edge Functions, integração com `webhook_deliveries`.

## 8. Próximos passos para Safety Signals

Branch sugerida: `claude/agekey-safety-signals`.

Pré-requisitos prontos nesta rodada:

- ✅ Decision Envelope canônico com `decision_domain: 'safety_signal'`, suporte a `severity`, `risk_category`, `actions`, `step_up_required`, `parental_consent_required`.
- ✅ Reason codes `SAFETY_*` no catálogo canônico.
- ✅ Privacy Guard com perfil `safety_event_v1` (rejeita `message`/`raw_text`/`image`/`video`/`audio`).
- ✅ Webhook contract com eventos `safety.*`.
- ✅ Retention classes `event_*`, `aggregate_12m`, `alert_12m`, `case_24m`, `legal_hold` (este último blindado contra cleanup automático).
- ✅ Policy engine com bloco `safety` (interaction_ruleset_id, require_step_up_on_unknown_age, require_parental_consent_check).
- ✅ Feature flag `AGEKEY_SAFETY_SIGNALS_ENABLED` (default `false`).
- ✅ Mapper legado→envelope para gerar decisões `safety_signal` a partir do estado existente.

Falta na rodada própria: migrations Safety (tabelas listadas em `docs/architecture/agekey-canonical-data-model.md` §4), Edge Functions de ingest/alerts/ack/escalate, rule engine canônico, step-up via Core, parental consent check via Consent.

## 9. Confirmação expressa de não-objetivos

Esta rodada **não**:

- ❌ implementou Consent completo.
- ❌ implementou Safety completo.
- ❌ alterou formato público de token (claims novas são opcionais).
- ❌ alterou formato público de webhook (payload e signature legados intocados; novos headers são aditivos).
- ❌ quebrou SDK ou widget.
- ❌ implementou gateway real sem credenciais.
- ❌ implementou SD-JWT VC real.
- ❌ implementou ZKP/BBS+ real.
- ❌ criou KYC.
- ❌ persistiu PII em token público, webhook ou resposta pública.
- ❌ criou interceptação, vigilância ou spyware.
- ❌ criou migrations destrutivas.
- ❌ alterou trigger SQL `fan_out_verification_webhooks`.
- ❌ alterou função SQL `build_verification_event_payload`.

A rodada **sim**:

- ✅ aproveitou a camada canônica do PR #34 sem duplicar.
- ✅ delegou o privacy guard legado ao canônico (estritamente mais seguro).
- ✅ trouxe headers canônicos para a entrega de webhook em paralelo aos legados.
- ✅ disponibilizou `ResultTokenClaimsCanonicalSchema` e `toCanonicalEnvelope` para consumidores novos.
- ✅ aplicou `assertPayloadSafe` defensivo em `verifications-session-complete`.
- ✅ formalizou 6 feature flags canônicas com defaults `false`.
- ✅ documentou 3 pendências SQL destrutivas para rodada própria.
- ✅ executou typecheck (5/5), lint (sem regressão) e test (126/126).
