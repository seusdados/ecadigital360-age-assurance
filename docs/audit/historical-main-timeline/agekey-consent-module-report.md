# Relatório de implementação — AgeKey Parental Consent (Rodada 3)

> Branch: `claude/open-agekey-consent-vdiRw` (designada pela sessão; equivalente
> conceitual à branch `claude/agekey-consent-module` mencionada na descrição
> da tarefa).
> Base: `main` em `a86d495` (logo após o merge do PR #50 — Decision Envelope
> runtime).
> Data: 2026-05-07.

## Sumário executivo

Esta rodada entrega o módulo **AgeKey Parental Consent (MVP)** integrado ao
Core canônico publicado nas rodadas 2.5/2.b. O Core não é duplicado: o
módulo cria um envelope de decisão peer (`ConsentDecisionEnvelope`),
reutilizando o privacy guard, a disciplina de versionamento, o assinador
JWS, o contrato de webhook, os reason codes (promovidos de RESERVED para
LIVE) e as classes de retenção.

Não houve KYC, não houve coluna de PII, não houve provedor real
falsamente declarado, não houve SD-JWT VC produção e não houve
emissão de eventos consent.* fora do schema canônico.

## O que foi entregue

### 1. Contratos compartilhados (`packages/shared/src/consent/`)

| Arquivo | Conteúdo |
|---|---|
| `consent-types.ts` | Enums e domínio (status, métodos, purpose codes, data categories, risk tier) |
| `consent-envelope.ts` | `ConsentDecisionEnvelopeSchema` + `assertConsentEnvelopeIsPublicSafe` |
| `consent-token.ts` | `ParentalConsentTokenClaimsSchema` + `envelopeToConsentTokenClaims` |
| `consent-engine.ts` | `evaluateConsent` puro + `buildConsentDecisionEnvelope` |
| `consent-api.ts` | Schemas Zod para 6 endpoints públicos |
| `consent-projections.ts` | `audit diff`, `webhook payload`, `payload hash` (SHA-256 canônico) |
| `consent-feature-flags.ts` | Constantes + leitor de flags |
| `index.ts` | Barrel export consumido por edge functions e admin |

Adições no Core canônico para suportar o módulo:
- `packages/shared/src/reason-codes.ts` — promove `CONSENT_GRANTED`,
  `CONSENT_DENIED`, `CONSENT_EXPIRED`, `CONSENT_REVOKED`,
  `CONSENT_GUARDIAN_NOT_VERIFIED`, `CONSENT_OTP_INVALID`,
  `CONSENT_OTP_EXPIRED`, `CONSENT_TEXT_VERSION_MISMATCH`,
  `CONSENT_RESOURCE_NOT_AUTHORIZED`, `CONSENT_NEEDS_REVIEW`,
  `CONSENT_BLOCKED_BY_POLICY`, `CONSENT_PII_DETECTED`,
  `CONSENT_NOT_GIVEN`, `CONSENT_PROOF_MISSING` para LIVE.
- `packages/shared/src/taxonomy/reason-codes.ts` — reduz
  `RESERVED_REASON_CODES` (apenas Safety codes ainda reservados).
- `packages/shared/src/webhooks/webhook-types.ts` — adiciona oito eventos
  `parental_consent.*` à tabela LIVE + schema
  `WebhookParentalConsentEventSchema` + função
  `isParentalConsentEventType` + extensão da
  `WebhookEventPayloadSchema` (discriminated union).
- `packages/shared/src/jws.ts` — adiciona `signJwsClaims` genérico que o
  módulo usa para assinar o token de consentimento (ES256, mesma chave
  da rodada do Core, com `typ='agekey-parental-consent+jwt'`).
  `signResultToken` continua funcionando (passa por `signJwsClaims`).

### 2. Migration Supabase (`supabase/migrations/018_parental_consent.sql`)

Sete tabelas:

1. `parental_consent_requests`
2. `guardian_contacts`
3. `guardian_verifications`
4. `consent_text_versions`
5. `parental_consents`
6. `parental_consent_tokens`
7. `parental_consent_revocations` (APPEND-ONLY)

Características:
- Tudo `tenant_id`-scoped com RLS habilitado.
- Service-role bypass para edge functions; tenant-side `WITH CHECK (false)`
  em writes que não devem vir do PostgREST público.
- CHECK constraints contra colunas com hash em formato hex 64-char.
- CHECK contra PII em `client_context_json` e `evidence_json` via
  `consent_jsonb_has_no_forbidden_keys()`.
- Triggers de auditoria escrevendo `audit_events` no formato canônico do
  domínio Consent (action `parental_consent.created/status_changed/revoked`).
- Trigger SQL de fan-out para `webhook_deliveries`, mirror exato do
  `fan_out_verification_webhooks` mas para o domínio Consent.
- `parental_consent_revocations` imutável (UPDATE/DELETE bloqueados);
  `parental_consents` com DELETE bloqueado.
- Sem migração destrutiva. Migration é aditiva e idempotente nos enums
  (DO blocks com EXCEPTION).

### 3. Edge Functions (Deno)

| Função | Endpoint | Auth | Comportamento |
|---|---|---|---|
| `parental-consent-session-create` | `POST /v1/parental-consent/session` | API key | Cria request, hash do subject_ref, status=pending_guardian, redirect_url |
| `parental-consent-guardian-start` | `POST /v1/parental-consent/:id/guardian/start` | API key | Hash do contato, OTP digest, persistência sem expor contato; dispatch real gated pela flag |
| `parental-consent-confirm` | `POST /v1/parental-consent/:id/confirm` | API key | Valida OTP, calcula hashes, monta envelope, assina token, INSERT parental_consents, audit_events |
| `parental-consent-session-get` | `GET /v1/parental-consent/session/:id` | API key | Lê status mínimo |
| `parental-consent-revoke` | `POST /v1/parental-consent/:consent_token_id/revoke` | API key | Marca token e consent revoked, INSERT em revocations |
| `parental-consent-token-verify` | `POST /v1/parental-consent/token/verify` | público | verifyJws + checagem de revogação + minimização |

Helpers compartilhados em `supabase/functions/_shared/`:
- `consent-envelope.ts` — adapter para `buildConsentDecisionEnvelope`.
- `consent-hmac.ts` — HMAC por-tenant com purpose binding e fallback de
  bootstrap via `AGEKEY_CONSENT_HMAC_PEPPER`.

### 4. Admin UI (Next.js, skeleton)

- `apps/admin/app/(app)/consent/page.tsx` — painel administrativo
  listando pedidos recentes e versões de texto publicadas.
- `apps/admin/app/parental-consent/[id]/page.tsx` — página pública minimal
  para o responsável aterrissar (não coleta dado nesta rodada).
- `apps/admin/components/layout/sidebar.tsx` — entrada
  "Consentimento parental" no menu lateral.

A coleta interativa de OTP/aceite e o painel parental ficam para rodadas
seguintes (declarado em `docs/modules/parental-consent/backlog.md`).

### 5. Documentação (`docs/modules/parental-consent/`)

- `README.md` — visão geral + mapa do módulo.
- `prd.md` — problema, solução, escopo MVP, restrições, KPIs.
- `architecture.md` — diagrama de integração + decisões + ponto de
  extensão futura.
- `data-model.md` — tabelas, colunas proibidas, padrões cross-tabela,
  retention.
- `api.md` — corpo + resposta + erros de cada endpoint, formato do token.
- `security.md` — modelo de ameaças, HMAC, OTP, RLS, feature flags.
- `privacy-by-design.md` — LGPD, GDPR, COPPA, dados que NÃO coletamos.
- `audit-evidence.md` — cadeia de evidência reproduzível matematicamente.
- `ux-copy.md` — copy PT-BR + linguagem proibida.
- `backlog.md` — P1–P4 priorizados.
- `sd-jwt-vc-profile.md` — perfil reservado, requisitos para virar prod.

### 6. Testes

#### Vitest (corre localmente, gate de CI)

| Arquivo | Testes |
|---|---|
| `packages/shared/src/consent/consent-envelope.test.ts` | 7 |
| `packages/shared/src/consent/consent-token.test.ts` | 3 |
| `packages/shared/src/consent/consent-api.test.ts` | 8 |
| `packages/shared/src/consent/consent-projections.test.ts` | 4 |

Total novo: **22 testes** (cobrindo: envelope build pending/approved/denied/needs_review/blocked, refusal sem hashes, privacy guard, token claims schema, token sem PII, schemas API rejeitando PII smuggling, schema response rejeitando `pii_included=true`, payload hash determinístico, audit diff sem refs HMAC, webhook payload satisfazendo o schema canônico).

Atualizei `taxonomy/reason-codes.test.ts` (CONSENT_NOT_GIVEN saiu de
`RESERVED`; novo teste valida que `CONSENT_GRANTED` é `live` e categoria
`consent`).

#### Deno (corre no CI Edge Functions)

| Arquivo | Testes |
|---|---|
| `supabase/functions/_tests/consent-envelope.test.ts` | 6 |

Cobertura: envelope pending, envelope approved → token claims canônicos,
webhook payload satisfaz schema canônico, audit diff omite refs HMAC,
recusa de envelope approved sem proof, payload hash determinístico hex.

## Resultado dos comandos

| Comando | Resultado |
|---|---|
| `pnpm install` | OK |
| `pnpm typecheck` | 5/5 packages OK |
| `pnpm test` | 15 test files / **185 testes** OK (162 pré-existentes + 23 novos no shared) |
| `pnpm lint` | OK |

`pnpm build` continua com a falha pré-existente em `@agekey/sdk-js`
(documentada na rodada 2.5; não é regressão desta rodada).

## Mapeamento dos critérios da Fase A

| Critério | Status |
|---|---|
| Consent implementado como módulo MVP | ✅ |
| Usar contratos canônicos | ✅ (envelope peer reutilizando guard, signer, webhook contract, retention) |
| Não duplicar Core | ✅ (sem privacy guard paralelo, sem signer paralelo, sem webhook signer paralelo) |
| RLS em todas as tabelas | ✅ (sete tabelas multi-tenant) |
| Privacy guard em pontos públicos | ✅ (toda saída pública, schema strict, CHECK SQL em JSON) |
| Token minimizado | ✅ (claims listadas, sem PII, schema strict, guard re-aplicado antes de assinar) |
| Webhook assinado | ✅ (HMAC SHA-256 via trigger SQL com `webhook_endpoints.secret_hash`) |
| Revogação | ✅ (`/revoke` endpoint + tabela append-only + status update + webhook) |
| Auditoria | ✅ (`audit_events` minimizado por trigger + linha explícita do envelope) |
| Testes passando | ✅ |

## Itens declarados como stub honesto

1. **Provedor de OTP** — `parental-consent-guardian-start` calcula e
   persiste o digest mas não envia o e-mail/SMS. O log
   `parental_consent_otp_dispatch_pending` registra que falta integração.
   Gate por `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED`.
2. **SD-JWT VC** — coluna existe; INSERT é gated por flag e o handler de
   confirm só emite `agekey_jws`. Detalhes em
   `docs/modules/parental-consent/sd-jwt-vc-profile.md`.
3. **Painel do responsável** — apenas a página pública minimal; o painel
   com login social e listagem por `guardian_ref_hmac` está no backlog
   P2.
4. **Provedor gateway de verificação parental** — gated pela flag
   `AGEKEY_CONSENT_GATEWAY_PROVIDERS_ENABLED`; nenhum provedor real
   implementado.
5. **Retention enforcement automatizado** — as classes de retenção foram
   declaradas (`docs/modules/parental-consent/data-model.md` §Retention)
   mas o `retention-job` ainda não enxerga as categorias `consent_*` —
   plug no job é P3.
6. **HMAC por-tenant via Vault** — RPC `consent_hmac_key_load` é o caminho
   ideal, mas o helper aceita o fallback `AGEKEY_CONSENT_HMAC_PEPPER` para
   ambientes que ainda não provisionaram a chave dedicada. A migration
   não cria a RPC porque ela depende de Vault setup específico do
   ambiente; o setup é parte do deploy.

## Riscos remanescentes

1. **Fallback de HMAC vs chave por-tenant**: o fallback é determinístico
   por tenant, mas reutiliza o mesmo pepper de ambiente. Se o pepper
   vazar, é possível recomputar `subject_ref_hmac` para qualquer
   `external_user_ref`. Mitigação: provisionar Vault key per tenant antes
   da release. Documentado em `security.md`.
2. **Trigger de webhook usa `webhook_endpoints.secret_hash` como key**:
   o consenting design herdou do trigger de verification. O cliente
   verifica computando HMAC com `sha256(raw_secret)`. Não é PII, mas é
   menos forte que assinar com o raw secret diretamente. Hardening em P4.
3. **`payload_hash` no webhook SQL difere ligeiramente do TS**: a função
   SQL gera `SHA-256(proof_hash || consent_text_hash || status)` — mais
   simples que o canônico calculado pelo edge function ao mintar (que
   usa `stableStringify` do envelope inteiro). Os dois são âncoras
   válidas de tampering, mas não são iguais. Documentar este detalhe
   para clientes que fizerem cross-check é parte do hardening de
   webhooks (P4).
4. **`pnpm build` continua falhando em `@agekey/sdk-js`** (herdado da
   rodada 2.b/2.5). Não é regressão.
5. **`assurance_level` do guardian é fixo em `low`** quando o método é
   `otp_email`/`otp_phone`. A elevação para `substantial`/`high` só
   acontece com SSO/gateway, ambos gated por flag.

## Confirmações finais

- ❌ **Não houve KYC**: nenhum campo de identidade civil persistido.
- ❌ **Não houve PII pública**: schemas strict, privacy guard,
  CHECK constraints, `pii_included=false` em toda resposta.
- ❌ **Não houve documento, idade exata ou data de nascimento** em
  qualquer coluna, claim, log, webhook ou audit_diff.
- ❌ **Não houve SD-JWT VC falso**: gated por flag, documentado como
  reservado, sem código de produção.
- ❌ **Não houve gateway provider falso**: gated por flag, sem
  integração real.
- ❌ **Não houve duplicação do Core**: privacy guard, decision envelope,
  webhook signer, reason codes e retention vieram do canônico.
- ✅ **Houve módulo MVP coeso**, com schemas, migration, edge functions,
  UI skeleton, docs e testes.
