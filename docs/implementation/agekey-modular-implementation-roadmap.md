# AgeKey — Modular Implementation Roadmap

> Status: roadmap canônico da Rodada 1.
> Atualiza (não substitui) `docs/implementation/pending-work-backlog.md`.

## P0 — Canonical Foundation (esta rodada — Rodada 1)

Branch: `claude/agekey-canonical-modular-architecture`.

- [x] Decision envelope (`packages/shared/src/decision/`).
- [x] Privacy guard canônico com perfis (`packages/shared/src/privacy/`).
- [x] Reason codes canônicos por grupo (`packages/shared/src/taxonomy/reason-codes.ts`).
- [x] Webhook signer + tipos (`packages/shared/src/webhooks/`).
- [x] Retention classes (`packages/shared/src/retention/`).
- [x] Policy engine canonical (tipos + helpers puros) (`packages/shared/src/policy/`).
- [x] Age taxonomy (`packages/shared/src/taxonomy/age-taxonomy.ts`).
- [x] Atualização de `packages/shared/src/index.ts` exportando tudo.
- [x] Testes mínimos da camada canônica via `vitest` em `packages/shared/__tests__/`.
- [x] Documentação canônica em `docs/architecture/`, `docs/specs/` e `docs/audit/`.

## P1 — Core Readiness Final (rodada em andamento)

Branch: `claude/agekey-core-readiness-canonical-alignment` (PR empilhado sobre PR #34).

- [x] Adicionar schema canônico opcional ao `result_token` (`decision_id`, `decision_domain`, `reason_codes`) preservando o legado — `ResultTokenClaimsCanonicalSchema`.
- [x] Adicionar headers canônicos em paralelo aos legados no `webhooks-worker` (`X-AgeKey-Webhook-Timestamp`, `X-AgeKey-Payload-Hash`, `X-AgeKey-Event-Id`, `X-AgeKey-Idempotency-Key`).
- [x] Bridge canônica em `_shared/errors.ts` re-exportando `CANONICAL_REASON_CODES` ao lado do legado.
- [x] Mapper legado→canônico em `@agekey/shared/decision` (`toCanonicalEnvelope`).
- [x] Privacy Guard legado delegando ao canônico (estritamente mais seguro).
- [x] `assertPayloadSafe(claims, 'public_token')` defensivo antes de assinar token em `verifications-session-complete`.
- [x] Feature flags canônicas (`AGEKEY_CREDENTIAL_MODE_ENABLED`, `AGEKEY_SD_JWT_VC_ENABLED`, `AGEKEY_PROOF_MODE_ENABLED`, `AGEKEY_ZKP_BBS_ENABLED`, `AGEKEY_SAFETY_SIGNALS_ENABLED`, `AGEKEY_PARENTAL_CONSENT_ENABLED`) — `packages/shared/src/feature-flags/`.
- [x] Testes (vitest): 38 novos casos cobrindo feature flags, mapper, schema canônico, delegação de privacy guard.
- [ ] Migração SQL do trigger `fan_out_verification_webhooks` para gerar payload canônico (`decision_domain`, `decision_id`, `payload_hash`, `content_included: false`, `pii_included: false`) — **destrutivo, fica para rodada própria**.
- [ ] Migração da assinatura HMAC para o formato canônico `${timestamp}.${nonce}.${rawBody}` — **destrutivo, fica para rodada própria**.
- [ ] Atualizar `audit_events.diff_json` para registrar `decision_id` quando aplicável (não-destrutivo, próxima rodada).
- [ ] Atualizar `billing_events` para incluir `decision_domain` opcional (requer migration aditiva).
- [x] Auditar admin labels para "KYC", "verificar identidade", "idade real" — **zero ocorrências encontradas**, sem ação necessária.
- [ ] Tests cross-tenant + privacy tests rodando no CI como gate (atualmente em `pnpm test:rls`).

## P2 — AgeKey Consent MVP

Branch sugerida: `claude/agekey-parental-consent-module`.

- [ ] Migrations Consent (tabelas listadas em `docs/architecture/agekey-canonical-data-model.md` §3).
- [ ] Edge Functions:
  - `parental-consent-request-create`
  - `parental-consent-request-get`
  - `parental-consent-guardian-verify`
  - `parental-consent-approve`
  - `parental-consent-deny`
  - `parental-consent-revoke`
  - `parental-consent-token-verify`
- [ ] Painel parental backend (token curto e escopado).
- [ ] Texto de consentimento versionado e referenciado por hash.
- [ ] Token de consentimento usando o mesmo `crypto_keys` ES256 + JWKS comum.
- [ ] Webhooks `parental_consent.*` via `webhook_deliveries`.
- [ ] Dashboard admin de consentimentos.
- [ ] Testes RLS Consent + privacy tests Consent.

## P3 — AgeKey Safety Signals MVP (metadata-only)

Branch sugerida: `claude/agekey-safety-signals`.

- [ ] Migrations Safety (tabelas listadas em `docs/architecture/agekey-canonical-data-model.md` §4).
- [ ] Schemas Zod Safety em `packages/shared/src/schemas/safety.ts`.
- [ ] Privacy guard perfil `safety_event_v1` aplicado em ingestão.
- [ ] Edge Functions:
  - `safety-event-ingest`
  - `safety-alerts-list`
  - `safety-alert-ack`
  - `safety-alert-escalate`
- [ ] Rule engine canônico (configurável por tenant).
- [ ] Step-up via abertura de `verification_session` no Core.
- [ ] Parental consent check via Consent (ou exigência via policy.safety).
- [ ] Webhooks `safety.*` via `webhook_deliveries`.
- [ ] Retention cleanup (cron) usando classes canônicas.
- [ ] Dashboard admin Safety.
- [ ] Testes RLS Safety + privacy tests Safety + testes de bloqueio de conteúdo bruto.

## P4 — Advanced

- [ ] SDK `beforeSendMessage` (hook opcional client-side, sem capturar conteúdo no servidor).
- [ ] SDK `beforeUploadMedia` (idem).
- [ ] Transient content classification (apenas client-side, respondendo `eligible_under_policy` sem retorno de classificação ao servidor).
- [ ] Model governance (registro de versão de modelo, entrada hashada).
- [ ] Evidence vault (separado, sob legal hold, com RLS própria).
- [ ] Legal hold workflow.
- [ ] SIEM/SOAR integration via webhook signed.
- [ ] **SD-JWT VC** — somente com biblioteca real, issuer real, test vectors e revisão criptográfica externa. Branch sugerida: `claude/agekey-credential-mode`.
- [ ] **ZKP/BBS+** — idem, com revisão externa. Branch sugerida: `claude/agekey-proof-mode-zkp`.
