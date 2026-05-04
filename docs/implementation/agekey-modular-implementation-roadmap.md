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

## P1 — Core Readiness Final (próxima rodada)

Branch sugerida: `claude/agekey-core-readiness-canonical-alignment`.

- [ ] Alinhar `result_token` claims ao envelope canônico (sem quebrar contrato existente — adicionar `decision_domain`, `decision_id` como claim opcional).
- [ ] Alinhar payload de `webhook_deliveries.payload` para incluir `AgeKeyWebhookPayload` canônico (inserindo o envelope canônico como `decision`).
- [ ] Atualizar `audit_events` para registrar `decision_id` quando aplicável.
- [ ] Atualizar `billing_events` para incluir `decision_domain` opcional.
- [ ] Adicionar feature flags formais para `credential_mode` e `proof_mode`, com defaults `disabled`.
- [ ] Atualizar admin labels para refletir taxonomia canônica (sem KYC).
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
