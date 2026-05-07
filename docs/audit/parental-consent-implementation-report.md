# AgeKey Consent — Relatório de Implementação MVP

> Branch: `claude/agekey-parental-consent-module`.
> Base: `claude/agekey-canonical-modular-architecture` (HEAD após merge dos PRs #34 e #35).
> Rodada: **3 — Consent**, sobre a camada canônica das Rodadas 1+2.
> Data: 2026-05-04.

## 1. Sumário

Implementado o MVP do **AgeKey Consent** como extensão do AgeKey Core. O módulo entrega o ciclo completo de consentimento parental auditável — solicitação, OTP do responsável, decisão versionada, emissão de token, webhook, revogação — sem criar KYC, sem persistir PII em token público, sem implementar SD-JWT VC real, sem alterar triggers SQL do Core.

**Reusa**, conforme arquitetura canônica:

- ✅ Decision Envelope canônico (`decision_domain: 'parental_consent'`).
- ✅ Privacy Guard canônico (perfis `public_token`, `webhook`, `public_api_response`, `guardian_contact_internal`).
- ✅ Webhook Contract canônico (`parental_consent.*` events; novo trigger sem alterar Core).
- ✅ Reason Codes canônicos (`CONSENT_*`).
- ✅ Retention Classes canônicas.
- ✅ Policy Engine canônico (bloco `consent`).
- ✅ `crypto_keys` ES256 + JWKS público comuns ao Core.
- ✅ `audit_events` particionado do Core.
- ✅ `webhook_deliveries` + `webhooks-worker` do Core.

## 2. Arquivos criados

### Migrations (não-destrutivas; nenhuma `ALTER` em tabela existente do Core)

| Arquivo | Conteúdo |
|---|---|
| `supabase/migrations/020_parental_consent_core.sql` | Enums + 5 tabelas: `consent_text_versions`, `parental_consent_requests`, `parental_consents`, `parental_consent_tokens`, `parental_consent_revocations`. |
| `supabase/migrations/021_parental_consent_guardian.sql` | `guardian_contacts` + `guardian_verifications` + 3 RPCs Vault (`guardian_contacts_store`, `_load`, `_purge_vault`). |
| `supabase/migrations/022_parental_consent_rls.sql` | RLS em todas as 7 tabelas + triggers append-only em `parental_consents` e `parental_consent_revocations`. |
| `supabase/migrations/023_parental_consent_webhooks.sql` | Trigger novo `fan_out_parental_consent_webhooks` (não toca o Core). |

### Schemas + helpers compartilhados (`packages/shared/`)

| Arquivo | Conteúdo |
|---|---|
| `packages/shared/src/schemas/parental-consent.ts` | Zod schemas para todos os 6 endpoints + claims do token + tipos públicos. |
| `packages/shared/src/parental-consent/otp-utils.ts` | `generateOtp`, `hashOtp`, `hmacContact`, `maskContact`, `normalizeContact`, `constantTimeEqual` — pure crypto, testáveis. |
| `packages/shared/src/parental-consent/panel-token.ts` | `generatePanelToken`, `hashPanelToken`, `constantTimeEqualString`. |
| `packages/shared/src/parental-consent/index.ts` | Re-exports. |

### Edge Function helpers (`supabase/functions/_shared/parental-consent/`)

| Arquivo | Conteúdo |
|---|---|
| `feature-flags.ts` | `readParentalConsentFlags()` — leitura de envs com defaults canônicos. |
| `otp.ts` | Re-export dos helpers do shared + `deliverOtp` (stub noop com falha explícita em prod sem provider real). |
| `panel-token.ts` | Re-export do shared. |
| `consent-token.ts` | `issueParentalConsentToken` (assina via `signResultToken`) + `verifyParentalConsentToken` (via `verifyResultToken` + checagem de `decision_domain`). |

### 6 Edge Functions

| Path | Endpoint |
|---|---|
| `supabase/functions/parental-consent-session/index.ts` | `POST /v1/parental-consent/session` |
| `supabase/functions/parental-consent-guardian-start/index.ts` | `POST /v1/parental-consent/:id/guardian/start` |
| `supabase/functions/parental-consent-confirm/index.ts` | `POST /v1/parental-consent/:id/confirm` |
| `supabase/functions/parental-consent-session-get/index.ts` | `GET /v1/parental-consent/session/:id` |
| `supabase/functions/parental-consent-revoke/index.ts` | `POST /v1/parental-consent/:id/revoke` |
| `supabase/functions/parental-consent-token-verify/index.ts` | `POST /v1/parental-consent/token/verify` |

### Admin app (`apps/admin/`)

- `apps/admin/app/(app)/consents/page.tsx` — lista filtrada por status.
- `apps/admin/app/(app)/consents/[id]/page.tsx` — detalhe com solicitação, registro, token e trilha de revogações.
- `apps/admin/components/layout/sidebar.tsx` — entrada nova "Consentimentos".

### Painel parental público (rota fora do `(app)` group)

- `apps/admin/app/parental-consent/[id]/page.tsx` — server component, sem auth, valida `?token=`.
- `apps/admin/app/parental-consent/[id]/form.tsx` — client component com state machine: `collect_contact → collect_otp → done|error`.

### Tests vitest

| Arquivo | Casos |
|---|---|
| `packages/shared/__tests__/parental-consent-otp.test.ts` | 14 — generateOtp, hashOtp, constantTimeEqual, maskContact, normalizeContact, hmacContact (sal por tenant). |
| `packages/shared/__tests__/parental-consent-panel-token.test.ts` | 4 — generate/hash/comparison. |
| `packages/shared/__tests__/parental-consent-schemas.test.ts` | 11 — request schemas, token claims (decision_domain enforced), privacy guard validation. |

**Total: +29 casos. Acumulado R1+R2+R3: 155/155 passando.**

### Documentação

- `docs/modules/parental-consent/README.md` — overview, fluxo, tabelas, token, feature flags, retention.
- `docs/modules/parental-consent/flow-diagram.md` — sequence diagram Mermaid.
- `docs/modules/parental-consent/integration-guide.md` — guia para integradores.
- `docs/audit/parental-consent-implementation-report.md` — este arquivo.

## 3. Arquivos alterados (não-Consent)

- `packages/shared/src/index.ts` — re-exporta novo subpacote `parental-consent`.
- `packages/shared/src/schemas/index.ts` — re-exporta `parental-consent.ts`.
- `packages/shared/package.json` — novo entry `./parental-consent`.
- `apps/admin/components/layout/sidebar.tsx` — adiciona ícone + entrada de menu.

## 4. Coisas que NÃO foram alteradas (intencional)

- Trigger SQL `fan_out_verification_webhooks` (Core).
- Função SQL `build_verification_event_payload` (Core).
- Schema legado `ResultTokenClaimsSchema`.
- Adapters do Core (`fallback`, `gateway`, `vc`, `zkp`).
- SDK browser/server.
- Migrations 000-019.

## 5. Conformidade com proibições do prompt

| Proibição | Estado |
|---|---|
| Não criar KYC | ✅ Sem documento, sem foto, sem nome civil. Apenas referência opaca + contato cifrado. |
| Não pedir documento direto | ✅ |
| Não armazenar data de nascimento | ✅ |
| Não armazenar idade exata | ✅ |
| Não armazenar nome civil | ✅ |
| Não armazenar CPF/RG/passaporte | ✅ |
| Não implementar SD-JWT VC real | ✅ Token é JWT ES256 idêntico ao `result_token`; VC mode permanece atrás de feature flag desligada. |
| SD-JWT VC em feature flag | ✅ `AGEKEY_SD_JWT_VC_ENABLED=false` (R2). |

## 6. Validação

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | **5/5** OK (`@agekey/shared`, `@agekey/sdk-js`, `@agekey/widget`, `@agekey/admin`, `@agekey/adapter-contracts`). |
| `pnpm lint` | Sem regressão nova. 1 warning preexistente em `apps/admin/app/(app)/policies/policy-form.tsx:473` (`jsx-a11y/role-supports-aria-props`). |
| `pnpm test` | **155/155** vitest. |
| `pnpm build` | **Não executado** — admin Next.js depende de envs Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_AGEKEY_API_BASE`, `AGEKEY_ADMIN_API_KEY`). Pendência registrada. |

## 7. Riscos remanescentes

1. **OTP delivery é stub.** Provider `noop` retorna OTP cleartext em dev. Produção precisa configurar provider real OU desabilitar `AGEKEY_PARENTAL_CONSENT_ENABLED` até existir provider. Documentado em `feature-flags.ts` e no integration-guide.
2. **Painel parental usa client fetch** para chamar Edge Functions. Em produção, configurar CORS no panel para aceitar `panel.agekey.com.br`. O `corsHeaders` em `_shared/cors.ts` deve ser revisado quando endpoints rodarem fora do mesmo domínio.
3. **`Database` types do admin** não inclui as 7 novas tabelas — pages usam `as never` cast. Após primeira aplicação das migrations em staging, regenerar via `supabase gen types typescript` e remover os casts.
4. **Texto do consentimento** não é exibido no painel parental nesta rodada — o painel mostra `purpose_codes` + `data_categories` + `text_hash`. Para exibir o texto completo, criar endpoint público adicional `/parental-consent-text/:id?token=<panel>` em rodada futura. Documentado no painel.
5. **Retention cleanup** não foi implementado — apenas as classes estão declaradas. Cron job de cleanup vai em rodada própria.
6. **Cross-tenant tests** não foram executados (não há banco real no sandbox). Recomendado rodar `pnpm test:rls` em staging antes de habilitar a flag em produção.
7. **Webhook payload** do trigger SQL `fan_out_parental_consent_webhooks` usa `payload_hash: 'pending'` — placeholder. Migrar para hash real do raw body em rodada de migração SQL canônica.

## 8. Próximos passos

Esta rodada deixa pronto:

- ✅ Modelo de dados completo (7 tabelas + Vault + RLS).
- ✅ Edge Functions completas (6 endpoints).
- ✅ Token assinado idêntico ao Core, com `decision_domain` correto.
- ✅ Webhooks `parental_consent.*` via trigger novo.
- ✅ UI admin (lista + detalhe) e painel parental público.
- ✅ Tests vitest dos helpers puros + schemas.

Para próxima rodada (ordem sugerida):

1. **Provider OTP real** (`claude/agekey-parental-consent-otp-provider`) — integração com Supabase Auth email ou Twilio/SendGrid.
2. **Endpoint público de texto** (`claude/agekey-parental-consent-text-public`) — exibir text_body completo no painel.
3. **Retention job** (`claude/agekey-retention-cron`) — cron que apaga consents expirados conforme classes canônicas.
4. **Tests cross-tenant Consent** — em ambiente staging com `pnpm test:rls`.
5. **Safety Signals MVP** (`claude/agekey-safety-signals`) — pré-requisitos canônicos + Consent prontos.

## 9. Confirmação expressa

Esta rodada **não**:

- ❌ implementou Consent como módulo completo de KYC.
- ❌ persistiu cleartext de e-mail/telefone/OTP em coluna comum.
- ❌ alterou trigger SQL `fan_out_verification_webhooks` do Core.
- ❌ implementou SD-JWT VC real.
- ❌ implementou ZKP/BBS+ real.
- ❌ implementou gateway externo real.
- ❌ criou cadastro civil de criança ou responsável.
- ❌ criou interceptação ou vigilância.

A rodada **sim**:

- ✅ aproveitou a camada canônica do PRs #34 e #35 sem duplicação.
- ✅ entregou ciclo completo de consentimento auditável e revogável.
- ✅ usou Vault para cifragem de contato + HMAC para lookup.
- ✅ documentou claramente as pendências (OTP real, retention cron, texto completo no painel).
- ✅ executou typecheck (5/5), lint (sem regressão) e test (155/155).
