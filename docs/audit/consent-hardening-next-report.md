# PR D — Consent Hardening Next (audit report)

Branch: `claude/consent-hardening-next`
Agent: 4 (Consent Hardening)
Date: 2026-05-07

## Scope

Hardening do módulo AgeKey Parental Consent já implantado em HML. Foco em
Privacy Guard, Decision Envelope canônico, OTP, verificação de token,
revogação, vinculação de hash de texto, eventos de auditoria e feature
flags. **Sem migração / sem PROD / sem mudança de schema de DB / sem
quebra de compat.**

## Files reviewed

### Edge Functions (read + tightened)
- `supabase/functions/parental-consent-session/index.ts`
- `supabase/functions/parental-consent-session-get/index.ts`
- `supabase/functions/parental-consent-guardian-start/index.ts`
- `supabase/functions/parental-consent-confirm/index.ts`
- `supabase/functions/parental-consent-revoke/index.ts`
- `supabase/functions/parental-consent-token-verify/index.ts`
- `supabase/functions/parental-consent-text-get/index.ts`

### Shared edge helpers (read + tightened, added 1)
- `supabase/functions/_shared/parental-consent/feature-flags.ts` — added
  `featureDisabledResponse(origin)` que devolve 503 sem tocar DB.
- `supabase/functions/_shared/parental-consent/decision-envelope.ts` —
  novo helper que constrói envelopes canônicos via
  `createDecisionEnvelope` do shared.
- `supabase/functions/_shared/parental-consent/otp.ts` (read only — sem
  alteração; provider abstraction com noop fallback já correto).
- `supabase/functions/_shared/parental-consent/otp-providers/*` (read
  only — registry e providers já enforçam falha eager).
- `supabase/functions/_shared/parental-consent/panel-token.ts` (read only).
- `supabase/functions/_shared/parental-consent/consent-token.ts` (read
  only — issuer, claims, verifier OK).

### Shared schemas (additive, backwards-compatible)
- `packages/shared/src/schemas/parental-consent.ts` — adicionou campo
  opcional `decision_envelope` em 4 schemas de resposta + campo opcional
  `consent_text_hash` em ConfirmResponse. Schemas pré-existentes ainda
  aceitam respostas SEM esses campos (compat HML preservada — testado).

### Shared tests (added 3 new, no existing test modified)
- `packages/shared/__tests__/parental-consent-privacy-guard-public.test.ts`
  (15 testes)
- `packages/shared/__tests__/parental-consent-decision-envelope.test.ts`
  (12 testes)
- `packages/shared/__tests__/parental-consent-token-revocation.test.ts`
  (8 testes)

### Admin (review only — no change)
- `apps/admin/app/parental-consent/*` — fluxo administrativo já filtra
  PII corretamente em UI. Sem alteração.

## Changes by file

### `supabase/functions/_shared/parental-consent/feature-flags.ts`
- Acrescentou `featureDisabledResponse(origin: string | null): Response`
  que retorna **HTTP 503** com `Retry-After: 60` e
  `reason_code: SYSTEM_INVALID_REQUEST`. Não toca DB. Não emite side
  effect. Não importa nem muta `errors.ts` (forbidden).

### `supabase/functions/_shared/parental-consent/decision-envelope.ts` (novo)
- `buildConsentDecisionEnvelope` — constrói envelope canônico com
  `decision_domain: 'parental_consent'`, força
  `content_included: false / pii_included: false` via
  `createDecisionEnvelope`.
- `mapRequestStatusToDecision` — mapeia status interno
  (`awaiting_guardian`, `awaiting_verification`, `approved`, `denied`,
  `revoked`, `expired`) para o status canônico do envelope.

### `supabase/functions/parental-consent-session/index.ts`
- Substituiu `throw new ForbiddenError(...)` da flag por
  `return featureDisabledResponse(origin)` (503).
- Emite `parental_consent_feature_disabled` audit event.
- Adiciona `decision_envelope` ao response (status
  `pending_guardian`, reason `CONSENT_REQUIRED`).

### `supabase/functions/parental-consent-guardian-start/index.ts`
- Mesma troca 403 → 503 para a flag.
- Confirmado: OTP nunca aparece na resposta (apenas `dev_otp` em DEV via
  flag explícita `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP`).
- Confirmado: `otp_hash` persistido em `guardian_verifications.otp_hash`,
  TTL 10min, contato cifrado em Vault via RPC `guardian_contacts_store`.

### `supabase/functions/parental-consent-confirm/index.ts`
- 403 → 503 para a flag.
- Carrega `consent_text_versions.text_hash` e expõe em
  `response.consent_text_hash` (auditor consegue replay sem nova query).
- Adiciona `decision_envelope` (`approved` / `denied`,
  `consent_token_id`, `assurance_level`).

### `supabase/functions/parental-consent-session-get/index.ts`
- 403 → 503 para a flag.
- Adiciona `decision_envelope` derivado de
  `mapRequestStatusToDecision(status)`.

### `supabase/functions/parental-consent-revoke/index.ts`
- 403 → 503 para a flag.
- Adiciona `decision_envelope` com `decision: 'revoked'`,
  `reason_code: CONSENT_REVOKED`.

### `supabase/functions/parental-consent-token-verify/index.ts`
- Adiciona checagem de flag → 503.
- **Eventos de auditoria distintos**: emite
  `parental_consent_token_verified` quando válido e
  `parental_consent_token_rejected` quando inválido/revogado/expirado/
  audience errado.
- Adiciona `decision_envelope` na resposta válida.

### `supabase/functions/parental-consent-text-get/index.ts`
- 403 → 503 para a flag.

### `packages/shared/src/schemas/parental-consent.ts`
- Adiciona import de `DecisionEnvelopeSchema`.
- Estende 4 schemas de response com `decision_envelope:
  DecisionEnvelopeSchema.optional()` (additive — campo OPCIONAL, schemas
  continuam aceitando respostas sem o envelope, compat HML preservada).
- Estende ConfirmResponse com `consent_text_hash: z.string().min(16).optional()`.

## Tests added (35 novos, 0 testes existentes modificados)

| File | Tests | Coverage |
|---|---|---|
| `parental-consent-privacy-guard-public.test.ts` | 15 | Privacy guard rejeita PII em SessionCreate, SessionGet, GuardianStart, Confirm, Revoke, TokenVerify. Cobre name, full_name, first_name, last_name, cpf, document, birthdate, dob, exact_age, guardian_email, phone, raw_text, message_body, image. age_threshold é exceção controlada. |
| `parental-consent-decision-envelope.test.ts` | 12 | Envelope canônico para os 3 estados (pending_guardian, approved, revoked). Schema strict rejeita campos extras. Rejeita pii_included=true / content_included=true. Todos os 5 schemas de response aceitam decision_envelope. RevokeResponse continua aceitando body sem decision_envelope (compat HML). |
| `parental-consent-token-revocation.test.ts` | 8 | Verify response: válido / revogado / expirado / audience errado / signature inválida. Mapeamento canônico de reason_code. RevokeResponse mantém literal `CONSENT_REVOKED`. Privacy guard passa em todos os estados. |
| **Total novo** | **35** | |

Baseline pré-existente: 236 testes. Total após PR D: **271 passed**.

## Issues found

| # | Tipo | Item | Resolução |
|---|---|---|---|
| 1 | Conformidade | Feature flag retornava 403 (Forbidden), spec diz 503 | Helper `featureDisabledResponse` introduzido; 7 funções migradas. Sem leitura/escrita ao DB nesse caminho. |
| 2 | Auditoria | `token-verify` emitia mesmo evento (`parental_consent_token_verified`) para sucesso e falha — auditor não conseguia distinguir | Separado em `parental_consent_token_verified` (sucesso) e `parental_consent_token_rejected` (rejeição). Reason code passa a ser logado também na rejeição. |
| 3 | Decisão canônica | Respostas públicas não emitiam Decision Envelope canônico | Adicionado `decision_envelope` (campo opcional, additive — compat preservada) em SessionCreate, SessionGet, Confirm, Revoke, TokenVerify. |
| 4 | Audit replay | Confirm response não devolvia hash do texto exibido — auditor precisava de nova query | Adicionado `consent_text_hash` opcional. |
| 5 | Audit event | Evento de "feature disabled" não era emitido | Adicionado `parental_consent_feature_disabled` log entry. |

### Issues deferred (com motivo)

| # | Item | Motivo |
|---|---|---|
| D1 | `text_hash` no claim do JWT (binding ao token, não só ao response) | Requer mudar `ParentalConsentTokenClaimsSchema` (forbidden por estar no spec canônico — mudança quebraria compat com tokens já em circulação em HML). Hash já está bound via `consent_text_version_id` no claim, e webhook trigger inclui esse FK. Auditor pode resolver `consent_text_versions.text_hash` por FK. Documentado para Agent 5 ou rodada futura. |
| D2 | Campo `resource` nos claims do consent token | Idem: schema canônico de claims não tem `resource`. O envelope no response carrega `resource` quando aplicável, mas o token em si não. Pode ser endereçado em rodada de evolução do contrato. |
| D3 | Webhook payload de revogação contém o hash do texto | Webhooks são gerados via DB trigger `fan_out_parental_consent_webhooks`, fora do escopo (mudança de migration). |
| D4 | Adição de campo `decision_envelope` em `ParentalConsentTextResponse` | O schema é `.strict()` por design (apenas `text_body`). Não pareceu apropriado romper a forma; o decision envelope já é entregue por SessionGet. |

## Privacy / Compatibility verifications

### Privacy Guard

- **Public response**: cada função chama
  `assertPayloadSafe(response, 'public_api_response')` antes do
  `jsonResponse`. Confirmado em 7 funções.
- **Token claims** (parental_consent_token): `assertPayloadSafe(claims,
  'public_token')` chamado em `consent-token.ts` antes de assinar.
- **Webhook body**: gerado por DB trigger, não pelo código aqui. A
  estrutura do trigger usa apenas IDs/hashes — sem PII (verificado em
  rodada anterior, não tocado nesta PR).
- **Panel URL token**: o `guardian_panel_token` é random opaco (32B
  random + prefixo `pcpt_`). Não codifica PII.
- **`contact_ciphertext` / `contact_hash`**: confirmado que residem
  apenas em colunas internas (`guardian_contacts.contact_hmac`,
  `vault_secret_id` via RPC). Nenhuma das 7 funções inclui esses campos
  na resposta. Cobertura via Privacy Guard test (`parental-consent-
  privacy-guard-public.test.ts`).

### Backwards compatibility

- **Schemas**: todos os campos novos (`decision_envelope`,
  `consent_text_hash`) são `.optional()`. Test
  `parental-consent-decision-envelope.test.ts` valida que respostas SEM
  esses campos ainda parseiam.
- **Status codes**: a única mudança é 403 → 503 para feature flag OFF.
  Como a flag está `true` em HML, o caller real não percebe diferença.
  Ambiente onde a flag é OFF é dev/staging desabilitado, e o cliente
  deve interpretar 5xx como módulo indisponível (intenção semântica
  correta).
- **Audit events**: split de `token_verified` em `verified` +
  `rejected` é additive — a key permanece, novos eventos são
  reconhecíveis pelo nome.
- **Webhook fan-out**: NÃO foi tocado. Triggers DB são fonte da verdade.
- **DB schema**: NENHUMA migration / NENHUM ALTER. Apenas leitura de
  `consent_text_versions.text_hash` (coluna pré-existente).

### Decision Envelope (canônico)

- Construído via `createDecisionEnvelope` (literais
  `content_included: false` / `pii_included: false` forçados em runtime
  e em tipo).
- Campos preenchidos: `decision_id`, `decision_domain`, `decision`,
  `reason_code`, `tenant_id`, `application_id`, `policy_id`,
  `policy_version`, `resource` (quando aplicável), `consent_token_id`,
  `expires_at`, `assurance_level`.

### Audit events (cross-check)

| Evento | Emitido em |
|---|---|
| `parental_consent_session_created` | parental-consent-session |
| `parental_consent_guardian_started` | parental-consent-guardian-start |
| `parental_consent_confirmed` | parental-consent-confirm (decision: granted/denied) |
| `parental_consent_revoked` | parental-consent-revoke |
| `parental_consent_token_verified` | parental-consent-token-verify (sucesso) |
| `parental_consent_token_rejected` | parental-consent-token-verify (falha/revogação) |
| `parental_consent_session_fetched` | parental-consent-session-get |
| `parental_consent_text_fetched` | parental-consent-text-get |
| `parental_consent_feature_disabled` | qualquer fn quando flag OFF |

Cobertura completa das transições de estado.

## Validation results

```
pnpm typecheck   → 6/6 ✓
pnpm lint        → clean (1 warning pré-existente em apps/admin/policies/policy-form.tsx, sem relação)
pnpm test        → 271 passed (236 baseline + 35 novos), 0 falhas
```

## Risks remaining

1. **Token claim binding com `text_hash`** (D1) — auditor depende de FK
   `consent_text_version_id` para resolver o hash. Aceitável: o hash é
   imutável por versão (append-only) e nunca pode contradizer o claim.
   Endereçar em mudança de contrato canônico futuramente.
2. **`expected_resource` em token-verify** (D2) — verifier hoje só
   confere audience. Resource scoping fica a cargo do consumidor do
   token. Aceitável MVP.
3. **OTP delivery em produção** — provider `noop` lança hard error
   quando `DEV_RETURN_OTP=false`. Em prod sem provider configurado, o
   start falha alto (correto). Risco operacional, não de privacy.
4. **Webhook body bloat** — o trigger atual NÃO inclui `text_body`,
   apenas referências (FK + hash via FK). Sem ação necessária.

## Constraints respected

- ✅ No PROD execution
- ✅ No DB migration / no schema change
- ✅ No SD-JWT VC real, no ZKP/BBS+ real, no real OTP gateway (noop +
  supabase-email stubs preservados)
- ✅ No PII em payload público (parental_consent_session response,
  webhook body, panel URL token)
- ✅ No KYC, no civil identifier collection
- ✅ No incompatible API breaking change (todos os campos novos são
  opcionais, status code mudou só em caminho de flag OFF)
- ✅ Forbidden files NÃO tocados:
  - `packages/shared/src/index.ts`
  - `packages/shared/src/taxonomy/reason-codes.ts`
  - `packages/shared/src/privacy/index.ts`
  - `packages/shared/src/privacy-guard.ts`
  - `packages/shared/src/decision/decision-envelope.ts`
  - `packages/shared/src/webhooks/webhook-types.ts`
  - `packages/shared/src/retention/retention-classes.ts`
  - `packages/shared/src/safety/**`
  - `supabase/functions/safety-*/**`

## Files modified (final)

```
M packages/shared/src/schemas/parental-consent.ts
M supabase/functions/_shared/parental-consent/feature-flags.ts
M supabase/functions/parental-consent-confirm/index.ts
M supabase/functions/parental-consent-guardian-start/index.ts
M supabase/functions/parental-consent-revoke/index.ts
M supabase/functions/parental-consent-session-get/index.ts
M supabase/functions/parental-consent-session/index.ts
M supabase/functions/parental-consent-text-get/index.ts
M supabase/functions/parental-consent-token-verify/index.ts
A packages/shared/__tests__/parental-consent-decision-envelope.test.ts
A packages/shared/__tests__/parental-consent-privacy-guard-public.test.ts
A packages/shared/__tests__/parental-consent-token-revocation.test.ts
A supabase/functions/_shared/parental-consent/decision-envelope.ts
A docs/audit/consent-hardening-next-report.md
```
