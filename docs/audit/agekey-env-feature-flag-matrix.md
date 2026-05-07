# AgeKey — Environment Variables and Feature Flags Matrix

> **Audit document — read-only.** This file does not change Vercel or Supabase
> remote configuration. It is the single source of truth for *what each variable
> means*, *where it is consumed*, and *what value HML and PROD should hold*.
> Any change to actual values must go through the deploy runbook
> ([`vercel-supabase-deploy-readiness.md`](./vercel-supabase-deploy-readiness.md)).
>
> **Scope:** repo `seusdados/ecadigital360-age-assurance`, branch
> `claude/infra-feature-flags-readiness`, audit baseline date 2026-05-07.
>
> **Targets:**
> - **HML** — Supabase project `wljedzqgprkpqhuazdzv` (homologation /
>   staging), Vercel preview environment.
> - **PROD** — Supabase project `tpdiccnmsnjtjwhardij`, Vercel production
>   environment.
>
> **Conventions:**
> - `<placeholder>` means "set in the dashboard, never commit". Never paste
>   real values into this document.
> - Boolean flags follow `packages/shared/src/feature-flags/feature-flags.ts`
>   normalizer: `true | 1 | on | yes` → ON; everything else → OFF.
> - All `AGEKEY_*_ENABLED` flags default to **OFF** when unset.

---

## 1. Sources audited

| Source | Path |
|---|---|
| Edge runtime env access | `supabase/functions/_shared/env.ts` |
| Canonical feature flags module | `packages/shared/src/feature-flags/feature-flags.ts` |
| Parental Consent runtime flags | `supabase/functions/_shared/parental-consent/feature-flags.ts` |
| Parental Consent OTP provider registry | `supabase/functions/_shared/parental-consent/otp-providers/index.ts` |
| Safety Signals runtime flags | `supabase/functions/_shared/safety/feature-flags.ts` |
| Admin app env contract | `apps/admin/.env.example` |
| Deploy guide | `DEPLOY.md` |
| Secret hygiene rules | `infrastructure/secrets.md` |
| Vercel build config | `vercel.json` |

---

## 2. Legend

| Type | Meaning |
|---|---|
| `secret` | Server-only; never leaves the runtime; never `NEXT_PUBLIC_*`. |
| `public` | Allowed in browser bundle; safe to expose. |
| `flag` | Boolean feature flag; defaults OFF; gates an unfinished module. |
| `url` | Externally visible URL or relay endpoint. |
| `key` | Cryptographic key, signing pepper, or HMAC seed. |
| `config` | Non-secret configuration / tuning knob. |

| Defined in | Meaning |
|---|---|
| **Vercel** | Project Settings → Environment Variables, scoped per environment (Preview / Production). |
| **Supabase Functions Secrets** | `supabase secrets set …` — accessible to Edge Functions through `Deno.env.get`. |
| **Supabase Vault** | `vault.secrets` row referenced by migration 014; only the vault key reference is in code. |
| **`.env.example`** | Local-dev template (`apps/admin/.env.example`) — value must be filled by developer locally. |
| **Postgres GUC** | Set with `ALTER DATABASE … SET app.<name>` (e.g. `app.cron_secret`, `app.functions_url`). |

---

## 3. Core platform

| Env var | Defined in | Used by | Type | HML default | PROD recommended | Notes |
|---|---|---|---|---|---|---|
| `SUPABASE_URL` | Supabase Functions Secrets (auto-injected) | All Edge Functions via `_shared/env.ts` | url | `https://wljedzqgprkpqhuazdzv.supabase.co` | `https://tpdiccnmsnjtjwhardij.supabase.co` | Auto-set by Supabase platform; do not override. |
| `SUPABASE_ANON_KEY` | Supabase Functions Secrets (auto-injected) | Edge Functions (`config.supabaseAnonKey`) | public | `<hml-anon-key>` | `<prod-anon-key>` | Public; mirrored to Vercel as `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Functions Secrets (auto-injected) | Edge Functions for elevated DB access | secret | `<hml-service-role>` | `<prod-service-role>` | NEVER expose to browser. Rotate on incident. |
| `AGEKEY_ENV` | Supabase Functions Secrets | `_shared/env.ts` `validateBootEnv()` | config | `staging` | `production` | When `production`, boot-time validation forbids `*` in `AGEKEY_ALLOWED_ORIGINS`. |
| `AGEKEY_ISSUER` | Supabase Functions Secrets | `_shared/env.ts`, JWS signer | url | `https://staging.agekey.com.br` | `https://app.agekey.com.br` (or canonical issuer host) | Must equal the `iss` claim in JWS tokens. |
| `AGEKEY_ALLOWED_ORIGINS` | Supabase Functions Secrets | `_shared/env.ts`, CORS layer | config | `*` (HML may relax) | comma-separated origin list, **no `*`** | PROD boot fails if wildcard used. |
| `CRON_SECRET` | Supabase Functions Secrets + Postgres GUC `app.cron_secret` | `retention-job`, `safety-retention-cleanup`, `safety-aggregates-refresh`, `key-rotation` | secret | `<hex64-hml>` | `<hex64-prod>` | Generated with `openssl rand -hex 32`. PROD must be a different value. |
| `SUPABASE_DB_URL` | local dev / CI only | Migrations runner | secret | `<dev-only>` | not configured | Only used outside of Edge runtime (CLI); never required at runtime. |
| `SUPABASE_ACCESS_TOKEN` | local dev / CI only | `supabase` CLI auth | secret | `<sbp_…>` | `<sbp_…>` | Personal Access Token — never in the repo, never in Vercel. |

### 3.1 Vercel — admin app (Next.js, monorepo `apps/admin`)

| Env var | Defined in | Used by | Type | HML default (Preview) | PROD recommended | Notes |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Vercel | admin server actions, callbacks | public | `https://<hml-vercel-host>` (or `https://staging.agekey.com.br`) | `https://app.agekey.com.br` | Used to compute auth redirects. |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | admin client SDK | public | `https://wljedzqgprkpqhuazdzv.supabase.co` | `https://tpdiccnmsnjtjwhardij.supabase.co` | Mirror of Supabase URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | admin client SDK | public | `<hml-anon-key>` | `<prod-anon-key>` | |
| `NEXT_PUBLIC_AGEKEY_API_BASE` | Vercel | admin client/server fetch | public | `https://wljedzqgprkpqhuazdzv.supabase.co/functions/v1` | `https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1` (or `https://api.agekey.com.br` if proxy fronted) | Base for Edge Function calls. |
| `NEXT_PUBLIC_AGEKEY_ISSUER` | Vercel | admin display + token verify | public | `https://staging.agekey.com.br` | `https://app.agekey.com.br` (or canonical issuer host) | Must mirror `AGEKEY_ISSUER`. |
| `AGEKEY_ADMIN_API_KEY` | Vercel (server-only, NOT `NEXT_PUBLIC_*`) | admin Server Actions | secret | `<hml-admin-key>` (rotate from dev seed) | `<prod-admin-key>` (issued via `applications-rotate-key`) | Never prefix with `NEXT_PUBLIC_`. Per-tenant, rotatable. |

---

## 4. Parental Consent module

Source: `supabase/functions/_shared/parental-consent/feature-flags.ts`,
`otp-providers/index.ts`, `panel-token.ts`.

| Env var | Defined in | Used by | Type | HML default | PROD recommended | Notes |
|---|---|---|---|---|---|---|
| `AGEKEY_PARENTAL_CONSENT_ENABLED` | Supabase Functions Secrets | All `parental-consent-*` Edge Functions, safety subject resolver | flag | `true` (HML may toggle) | **`false`** until DPA + provider live | Master switch. While OFF, edge functions return `SYSTEM_INVALID_REQUEST`. |
| `AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED` | Supabase Functions Secrets | `parental-consent-guardian-start` (gate) | flag | `false` until provider configured | **`false`** until DPA signed and `supabase_email` (or upgraded provider) configured | Required to actually deliver OTP — independent from master flag. |
| `AGEKEY_CONSENT_OTP_PROVIDER` *(legacy alias)* / `AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER` | Supabase Functions Secrets | `otp-providers/index.ts` `selectProvider()` | config | `noop` (HML smoke) or `supabase_email` (HML with DPA) | `supabase_email` (or future provider) | Values supported today: `noop`, `supabase_email`. Unknown value throws `UnknownOtpProviderError` at boot. |
| `AGEKEY_PARENTAL_CONSENT_OTP_RELAY_URL` | Supabase Functions Secrets | `supabase-email` provider | url | `<hml-relay-endpoint>` | `<prod-relay-endpoint>` | Required when provider = `supabase_email`. |
| `AGEKEY_PARENTAL_CONSENT_OTP_RELAY_TOKEN` | Supabase Functions Secrets | `supabase-email` provider | secret | `<hml-relay-token>` | `<prod-relay-token>` | Bearer token for the relay. Never log raw. |
| `AGEKEY_PARENTAL_CONSENT_OTP_FROM_EMAIL` | Supabase Functions Secrets | `supabase-email` provider | config | `consent@staging.agekey.com.br` | `consent@agekey.com.br` | Must match SPF/DKIM. |
| `AGEKEY_PARENTAL_CONSENT_OTP_FROM_NAME` | Supabase Functions Secrets | `supabase-email` provider | config | `AgeKey HML` | `AgeKey` | Optional. |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | Supabase Functions Secrets | `parental-consent-guardian-start` test path | flag | `true` (HML smoke) → flip OFF before showing demos | **`false`** | When ON, edge returns the OTP to the caller for tests. **Must be OFF in PROD.** |
| `AGEKEY_PARENTAL_CONSENT_PANEL_BASE_URL` | Supabase Functions Secrets | OTP templates / panel link build | url | `https://staging.panel.agekey.com.br/parental-consent` | `https://panel.agekey.com.br/parental-consent` | Must point to the live guardian panel. |
| `AGEKEY_PARENTAL_CONSENT_PANEL_TTL_SECONDS` | Supabase Functions Secrets | Panel link TTL | config | `86400` (default) | `86400` (default) | Increase only with DPO sign-off. |
| `AGEKEY_PARENTAL_CONSENT_TOKEN_TTL_SECONDS` | Supabase Functions Secrets | Consent token TTL | config | `3600` (default) | `3600` (default) | Per-token freshness gate. |
| `AGEKEY_PARENTAL_CONSENT_DEFAULT_EXPIRY_DAYS` | Supabase Functions Secrets | Consent record expiry | config | `365` (default) | `365` (default) | Per-jurisdiction policy may override. |
| `AGEKEY_CONSENT_HMAC_PEPPER` | **Supabase Vault** (preferred) + Functions Secrets fallback | panel token hashing, guardian PII hashing | key | `<hml-pepper>` | `<prod-pepper>` (different value) | Rotation requires re-hashing flow; coordinate with DPO. |
| `AGEKEY_PARENTAL_CONSENT_PANEL_TOKEN_SECRET` *(reserved)* | Supabase Vault | panel-token HMAC | secret | not yet provisioned | not yet provisioned | Reserved name — implementation today reuses `AGEKEY_CONSENT_HMAC_PEPPER`. Track in §6. |

> Webhook variables for parental-consent dispatch are shared with the
> generic webhook subsystem — see §7.

---

## 5. Safety Signals module

Source: `supabase/functions/_shared/safety/feature-flags.ts`,
`safety-event-ingest`, `safety-rule-evaluate`, `safety-retention-cleanup`,
`safety-alert-dispatch`.

| Env var | Defined in | Used by | Type | HML default | PROD recommended | Notes |
|---|---|---|---|---|---|---|
| `AGEKEY_SAFETY_SIGNALS_ENABLED` | Supabase Functions Secrets | `safety-event-ingest` and downstream | flag | `true` (HML can demo) | **`false`** until rule-set hardened and DPA reviewed | Master switch. |
| `AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED` | Supabase Functions Secrets | reserved (content analysis path) | flag | **`false`** | **`false`** | **Must remain OFF.** No real content analyzer is implemented. |
| `AGEKEY_SAFETY_MEDIA_GUARD_ENABLED` | Supabase Functions Secrets | reserved (media guard path) | flag | **`false`** | **`false`** | **Must remain OFF.** No media pipeline. |
| `AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED` | Supabase Functions Secrets | reserved (evidence vault path) | flag | **`false`** | **`false`** | **Must remain OFF.** Vault schema not yet proven. |
| `AGEKEY_SAFETY_DEFAULT_EVENT_RETENTION_CLASS` | Supabase Functions Secrets | `safety-retention-cleanup` | config | `event_90d` (default) | `event_90d` (default) | Allowed values per migrations. |
| `AGEKEY_SAFETY_RETENTION_CLEANUP_BATCH_SIZE` | Supabase Functions Secrets | `safety-retention-cleanup` | config | `500` (default) | `500` (default) | Tune only after observing DB load. |
| `AGEKEY_SAFETY_WEBHOOK_SECRET` *(reserved)* | Supabase Vault | safety alert dispatch | secret | not yet provisioned | not yet provisioned | Tracked but not consumed — current implementation uses generic webhook secret per endpoint. |

---

## 6. Credential / Proof modes (gated, must remain OFF in PROD)

Source: `packages/shared/src/feature-flags/feature-flags.ts` — defaults are
**all `false`**. Reason codes returned when off:
`CREDENTIAL_FEATURE_DISABLED`, `ZKP_FEATURE_DISABLED`.

| Env var | Defined in | Used by | Type | HML default | PROD recommended | Notes |
|---|---|---|---|---|---|---|
| `AGEKEY_CREDENTIAL_MODE_ENABLED` | Supabase Functions Secrets | verifications-token-* paths gated by reason code | flag | `false` (HML may toggle for staged tests with mock issuer) | **`false`** | No real issuer wired in PROD. |
| `AGEKEY_SD_JWT_VC_ENABLED` | Supabase Functions Secrets | SD-JWT VC credential branch | flag | **`false`** | **`false`** | Implementation incomplete; do not enable. |
| `AGEKEY_PROOF_MODE_ENABLED` | Supabase Functions Secrets | proof-artifact-url | flag | **`false`** | **`false`** | Proof flow stub. |
| `AGEKEY_ZKP_BBS_ENABLED` | Supabase Functions Secrets | ZKP BBS+ branch | flag | **`false`** | **`false`** | No BBS+ library shipped. |

> When any of these flags is read as ON without backing implementation,
> the request must short-circuit with the reason code from
> `AGEKEY_FEATURE_DISABLED_REASON_CODES` — never silently approve.

---

## 7. Webhooks subsystem

Source: `supabase/functions/webhooks-worker`, migration `005_webhooks.sql`,
`packages/sdk-js/src/server.ts`.

| Env var | Defined in | Used by | Type | HML default | PROD recommended | Notes |
|---|---|---|---|---|---|---|
| `WEBHOOK_SIGNING_SECRET` | per-endpoint row in `webhook_endpoints.secret_hash` | tenant webhooks | secret | `<rotated-per-endpoint>` | `<rotated-per-endpoint>` | Stored as SHA-256 hash; raw value visible to operator only at creation. |
| `AGEKEY_WEBHOOK_SECRET_HASH` | Supabase Functions Secrets (admin write path) | `applications-write` ingestion | secret | `<hash-only>` | `<hash-only>` | Hash, not raw secret. |

---

## 8. Gateway providers (server-only)

All values are **placeholders** in this matrix. Real values live only in
Supabase Functions Secrets. None of these is `NEXT_PUBLIC_*`.

| Env var | Type | HML default | PROD recommended | Notes |
|---|---|---|---|---|
| `GATEWAY_YOTI_API_KEY` | secret | `<hml-yoti-key>` (sandbox) | `<prod-yoti-key>` | Provider sandbox in HML. |
| `GATEWAY_VERIFF_API_KEY` | secret | `<hml-veriff-key>` | `<prod-veriff-key>` | |
| `GATEWAY_IDWALL_API_KEY` | secret | `<hml-idwall-key>` | `<prod-idwall-key>` | |
| `GATEWAY_SERPRO_CLIENT_SECRET` | secret | `<hml-serpro-secret>` | `<prod-serpro-secret>` | Brazilian gov ID gateway. |
| `AGEKEY_CONSENT_GATEWAY_PROVIDERS_ENABLED` | flag | `false` | **`false`** until each gateway DPA is signed | Master gate referenced in canonical PRD. |

When the corresponding gateway flag is OFF or the key is missing, the
adapter must return `GATEWAY_PROVIDER_NOT_CONFIGURED` — never approve.

---

## 9. Cron / retention

| Env var | Defined in | Used by | Type | HML default | PROD recommended | Notes |
|---|---|---|---|---|---|---|
| `CRON_SECRET` | Supabase Functions Secrets + Postgres GUC `app.cron_secret` | `retention-job`, `safety-retention-cleanup`, `key-rotation`, `safety-aggregates-refresh`, `trust-registry-refresh` | secret | `<hex64-hml>` | `<hex64-prod>` | Different values per env. |
| `AGEKEY_CRON_SECRET` *(legacy alias documented in `DEPLOY.md`)* | local-dev export only | `setup-staging.sh` | secret | local-dev only | local-dev only | Bootstrap helper; renamed to `CRON_SECRET` once `supabase secrets set` runs. |
| `AGEKEY_RETENTION_DRY_RUN` | Supabase Functions Secrets | `retention-job` | flag | `true` (HML safe default) | `false` once retention is reviewed by DPO | When ON, retention writes a dry-run report instead of deleting. |

---

## 10. Test / CI-only (never in PROD)

| Env var | Type | Notes |
|---|---|---|
| `SUPABASE_TEST_URL` | url | Used by `packages/integration-tests`. |
| `SUPABASE_TEST_SERVICE_ROLE_KEY` | secret | Test project only. Not configured in HML/PROD. |
| `AGEKEY_TEST_TENANT_A_ID`, `AGEKEY_TEST_TENANT_B_ID` | config | UUIDs for cross-tenant integration suite. |
| `AGEKEY_PRIVACY_GUARD_FORBIDDEN_CLAIM` | reason code (constant) | Not a runtime env; reason-code identifier only. |

---

## 11. Audit / placement summary

| Where | Variables (high level) |
|---|---|
| **Vercel — Production** | `NEXT_PUBLIC_*` (5), `AGEKEY_ADMIN_API_KEY` |
| **Vercel — Preview** | Same set as Production, pointing to HML Supabase. |
| **Supabase Functions Secrets — `tpdiccnmsnjtjwhardij` (PROD)** | `AGEKEY_ENV=production`, `AGEKEY_ISSUER`, `AGEKEY_ALLOWED_ORIGINS` (no wildcard), `CRON_SECRET`, all `AGEKEY_PARENTAL_CONSENT_*` (master OFF until ready), all `AGEKEY_SAFETY_*` (3 sub-flags OFF, master OFF until ready), all 4 credential/proof flags **OFF**, `GATEWAY_*` keys (only after each DPA), `AGEKEY_RETENTION_DRY_RUN=false` (post DPO review). |
| **Supabase Functions Secrets — `wljedzqgprkpqhuazdzv` (HML)** | Same set, with HML values; master flags may be ON for demos but `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` must be OFF before any external demo. |
| **Supabase Vault — both projects** | `AGEKEY_CONSENT_HMAC_PEPPER`, signing keys (managed by `key-rotation`), reserved `AGEKEY_PARENTAL_CONSENT_PANEL_TOKEN_SECRET`, reserved `AGEKEY_SAFETY_WEBHOOK_SECRET`. |
| **Postgres GUC** | `app.cron_secret`, `app.functions_url`. |
| **`apps/admin/.env.example`** | Mirror of public + `AGEKEY_ADMIN_API_KEY` placeholder, for local dev only. |

---

## 12. Required PROD invariants (must hold before each release)

1. `AGEKEY_ENV=production` set on PROD Supabase project.
2. `AGEKEY_ALLOWED_ORIGINS` is a non-empty comma-separated list and does
   not contain `*`.
3. `AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED=false`.
4. `AGEKEY_SAFETY_MEDIA_GUARD_ENABLED=false`.
5. `AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED=false`.
6. `AGEKEY_CREDENTIAL_MODE_ENABLED=false`.
7. `AGEKEY_SD_JWT_VC_ENABLED=false`.
8. `AGEKEY_PROOF_MODE_ENABLED=false`.
9. `AGEKEY_ZKP_BBS_ENABLED=false`.
10. `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=false`.
11. `CRON_SECRET` is unique to PROD (not equal to HML value).
12. No `NEXT_PUBLIC_*` variable contains a service role key, signing
    key, or HMAC pepper.
13. `AGEKEY_ADMIN_API_KEY` is a freshly issued PROD key, not the seeded
    `ak_dev_sk_test_*` value.

If any invariant fails, deployment is **blocked**. See companion runbook
for verification commands.
