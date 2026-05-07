# Vercel + Supabase Deploy Readiness Checklist

> **Audit / runbook document.** This checklist supplements `DEPLOY.md`
> (first-time setup) and `infrastructure/vercel-deploy.md`. It targets the
> two existing Supabase projects:
>
> - **HML** — `wljedzqgprkpqhuazdzv` (homologation / staging).
> - **PROD** — `tpdiccnmsnjtjwhardij` (production).
>
> Companion: [`agekey-env-feature-flag-matrix.md`](./agekey-env-feature-flag-matrix.md).
>
> All commands below use **placeholders only** — `<…>`. Never paste real
> secrets into this file or its commits.

---

## 1. Pre-deploy verification (per environment)

Run before promoting any change to HML or PROD.

### 1.1 Repository state

- [ ] Working tree clean: `git status` shows nothing to commit.
- [ ] On the expected branch (`main` for PROD, the release branch for HML).
- [ ] CI green on the latest commit:
  - [ ] `pnpm typecheck`
  - [ ] `pnpm lint`
  - [ ] `pnpm test --filter @agekey/shared`
  - [ ] `pnpm test --filter @agekey/integration-tests`
- [ ] No new secret committed: grep for the patterns below returns 0
  matches in the diff window:
  - `sk_live_`, `sk_test_` (provider key prefixes)
  - `service_role_key` (assigned a non-placeholder value)
  - `eyJ` followed by 80+ chars (potential JWT)
  - `sbp_` (Supabase PAT)
  - `Bearer\s+[A-Za-z0-9._-]{20,}` outside test fixtures

### 1.2 Supabase invariants (PROD only — see matrix §12)

Connect to the project (`supabase link --project-ref <project-ref>`) and
confirm via the dashboard `Functions → Secrets` page or
`supabase secrets list`:

- [ ] `AGEKEY_ENV=production`.
- [ ] `AGEKEY_ALLOWED_ORIGINS` is non-empty, comma-separated, no `*`.
- [ ] All four credential/proof flags are OFF
  (`AGEKEY_CREDENTIAL_MODE_ENABLED`, `AGEKEY_SD_JWT_VC_ENABLED`,
  `AGEKEY_PROOF_MODE_ENABLED`, `AGEKEY_ZKP_BBS_ENABLED`).
- [ ] All three safety sub-flags are OFF
  (`AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED`,
  `AGEKEY_SAFETY_MEDIA_GUARD_ENABLED`,
  `AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED`).
- [ ] `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=false`.
- [ ] `CRON_SECRET` value differs from the HML value (compare hashes
  out-of-band — never paste plaintext).
- [ ] `AGEKEY_ADMIN_API_KEY` for the operator tenant is **not** the
  seeded dev key.

### 1.3 Vercel invariants

In the Vercel dashboard for the `agekey-admin` project:

- [ ] **Production** environment variables list has the 5
  `NEXT_PUBLIC_*` keys + `AGEKEY_ADMIN_API_KEY`.
- [ ] No `NEXT_PUBLIC_*` variable contains the service role key,
  signing key, or HMAC pepper.
- [ ] **Preview** environment points at HML Supabase.
- [ ] Build command: `pnpm --filter @agekey/admin build`
  (matches `vercel.json`).
- [ ] Output directory: `.next` (root-relative, not
  `apps/admin/.next` — see `infrastructure/vercel-deploy.md`).

---

## 2. Snapshot procedures (Supabase)

Take a snapshot **before every PROD deploy** and before any destructive
operation in HML.

### 2.1 Database snapshot — Supabase Dashboard

Step-by-step:

1. Open `https://supabase.com/dashboard/project/<project-ref>/database/backups`.
2. Verify the most recent **Daily backup** is < 24 h old. If not, contact
   support — Pro plan should retain 7 days.
3. For PROD only: trigger a **point-in-time restore checkpoint** by
   running a no-op write so PITR has a fresh marker:
   ```sql
   -- run in SQL editor; replace <slug>
   UPDATE tenants
      SET updated_at = now()
    WHERE slug = '<no-op-tenant-slug>';
   ```
4. Note the timestamp in the deploy ticket.

### 2.2 Schema export (manual, recommended for PROD)

Run from a workstation that already has `supabase login` set up. Never
include the dump in the repo or in a public bucket.

```bash
# Replace placeholders. Output goes to a local secure folder only.
supabase db dump \
  --project-ref <project-ref> \
  --schema public \
  --schema vault \
  > "$HOME/agekey-backups/<env>-$(date -u +%Y%m%dT%H%M%SZ).sql"
```

### 2.3 Edge Function manifest

```bash
supabase functions list --project-ref <project-ref> > \
  "$HOME/agekey-backups/<env>-functions-$(date -u +%Y%m%dT%H%M%SZ).txt"
```

### 2.4 Secrets manifest (names only, never values)

```bash
# Lists secret KEYS only. Safe to keep with the deploy ticket.
supabase secrets list --project-ref <project-ref> | awk '{print $1}' > \
  "$HOME/agekey-backups/<env>-secret-keys-$(date -u +%Y%m%dT%H%M%SZ).txt"
```

### 2.5 Vault snapshot (encrypted)

The Supabase Vault is encrypted at rest. Capture *references* only:

```sql
-- run in the dashboard SQL editor — outputs the names + ids, not values.
SELECT id, name, description, created_at, updated_at
  FROM vault.secrets
 ORDER BY name;
```

Save the output as a CSV next to the snapshot.

---

## 3. Vercel — preview vs production differences

| Aspect | Preview (HML) | Production |
|---|---|---|
| Trigger | Every push to a non-`main` branch | Push/merge to `main` |
| Supabase target | `wljedzqgprkpqhuazdzv` | `tpdiccnmsnjtjwhardij` |
| `AGEKEY_ENV` consumed by Edge | `staging` | `production` |
| Allowed origins | Wildcard tolerated | Wildcard rejected at boot |
| Sample origin allowlist | preview URLs + `https://staging.agekey.com.br` | `https://app.agekey.com.br`, `https://verify.agekey.com.br`, `https://www.agekey.com.br` |
| `AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP` | May be ON for QA — turn OFF before stakeholder demo | Must be OFF |
| Custom domain | `staging.agekey.com.br` (CNAME → `cname.vercel-dns.com.`) | `app.agekey.com.br` (CNAME → `cname.vercel-dns.com.`) |
| Auth Site URL (Supabase) | preview Vercel URL or `staging.agekey.com.br` | `https://app.agekey.com.br` |
| Auth redirect URLs | preview URLs + `http://localhost:3000/callback` | `https://app.agekey.com.br/callback` only |

Promotion rule: a Preview deployment is promoted to PROD only after the
checklist in §1 passes against PROD secrets/flags, not Preview ones.

---

## 4. DNS and proxy considerations

Source: `infrastructure/dns/agekey-dns-plan.md`.

- [ ] Domain `agekey.com.br` is registered at registro.br and DNS is
  controlled by the AgeKey ops team.
- [ ] CNAMEs point to `cname.vercel-dns.com.` for: `www`, `app`, `verify`,
  `docs`, `staging`.
- [ ] `api.agekey.com.br` is **either** a Vercel proxy to
  `<project-ref>.supabase.co/functions/v1` **or** a CNAME to a future
  dedicated gateway — pick one and document it before first PROD deploy.
- [ ] CAA records allow `letsencrypt.org` and `pki.goog`.
- [ ] HSTS is enabled in Vercel only after every host has been validated
  with TLS — once enabled it cannot be undone for `max-age` window.
- [ ] DMARC/SPF/DKIM aligned for `consent@agekey.com.br` if
  `AGEKEY_PARENTAL_CONSENT_OTP_FROM_EMAIL` is on the apex domain.
- [ ] When using the `api` proxy: `NEXT_PUBLIC_AGEKEY_API_BASE` may be
  set to `https://api.agekey.com.br` instead of the raw Supabase URL —
  but the issuer hostname (`AGEKEY_ISSUER`) **must remain stable** since
  it is baked into JWS `iss` claims.

---

## 5. Rollback procedures

### 5.1 Vercel rollback (admin app)

1. Open `https://vercel.com/<team>/agekey-admin/deployments`.
2. Locate the last known-good deployment (use the snapshot timestamp
   captured in §2 to disambiguate).
3. Click the deployment → **`...`** menu → **Promote to Production**.
4. Verify the production URL serves the rolled-back commit
   (`/_next/static/chunks/...` hashes change).
5. Note the rollback in the incident ticket.

### 5.2 Supabase Edge Functions rollback

`supabase functions deploy` always uploads the current local code, so
rollback requires checking out the previous git revision and
re-deploying:

```bash
# Replace <previous-sha> with the last known-good commit.
git fetch origin
git checkout <previous-sha>
supabase functions deploy --project-ref <project-ref>
```

For a single-function rollback:

```bash
supabase functions deploy <function-name> --project-ref <project-ref>
```

### 5.3 Supabase migrations rollback

Migrations are **forward-only** in this repo (numbered 000…N). Rollback
of a destructive migration requires:

1. Restore from the snapshot in §2.1 (PITR or daily backup).
2. Coordinate with operator (downtime banner via admin app).
3. Replay migrations up to but not including the offending one on a
   recovery branch, then forward-fix.

Do **not** attempt manual `DROP`/`ALTER` to "undo" a migration in PROD
without a snapshot.

### 5.4 Secret/flag rollback

To revert a flag flip (e.g. an `_ENABLED` flag accidentally turned ON):

```bash
# Replace placeholders. Value matches the matrix recommendation.
supabase secrets set AGEKEY_<FLAG_NAME>=false --project-ref <project-ref>
```

Edge Functions pick up the new value on next cold start; force a
redeploy to flush warm instances:

```bash
supabase functions deploy --project-ref <project-ref>
```

### 5.5 DNS rollback

Keep TTLs short (300 s) on first cutover. To revert a DNS change at
registro.br: edit the record back to the prior CNAME / A target. Browser
caches honor TTL, so plan a 5–10 min observation window.

---

## 6. Smoke tests per environment

**Placeholders only.** Replace `<…>` from a secure secrets manager — never
paste real values into shared logs.

### 6.1 Common environment exports

```bash
# Pick ONE block per run.

# --- HML ---
export AK_BASE="https://wljedzqgprkpqhuazdzv.supabase.co/functions/v1"
export AK_ADMIN_URL="https://<hml-vercel-host-or-staging.agekey.com.br>"
export AK_API_KEY="<hml-tenant-api-key>"

# --- PROD ---
export AK_BASE="https://tpdiccnmsnjtjwhardij.supabase.co/functions/v1"
export AK_ADMIN_URL="https://app.agekey.com.br"
export AK_API_KEY="<prod-tenant-api-key>"
```

### 6.2 Edge Functions smoke

```bash
# 1. JWKS reachable
curl -fsS "$AK_BASE/jwks" | head -c 200; echo

# 2. Verifications session create
curl -fsS -X POST "$AK_BASE/verifications-session-create" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"policy_slug":"<policy-slug>","client_capabilities":{"platform":"web"}}'

# 3. Token verify (using a token from step 2 once the session completes)
curl -fsS -X POST "$AK_BASE/verifications-token-verify" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token":"<jws-token>"}'

# 4. Disabled-feature honesty (must return CREDENTIAL_FEATURE_DISABLED)
curl -fsS -X POST "$AK_BASE/verifications-token-verify" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token":"<jws-token>","mode":"credential"}' \
  | grep -E 'CREDENTIAL_FEATURE_DISABLED|ZKP_FEATURE_DISABLED'
```

### 6.3 Admin app smoke

```bash
# 1. Public health (must respond 200)
curl -fsS -I "$AK_ADMIN_URL/login" | head -1

# 2. Auth callback path responds (302 expected)
curl -fsS -I "$AK_ADMIN_URL/callback" | head -1

# 3. Static asset reachable (Next.js build hash check)
curl -fsS -I "$AK_ADMIN_URL/_next/static/chunks/main.js" | head -1
```

### 6.4 Cron / retention smoke

```bash
# Trigger the retention job in DRY-RUN mode (HML or PROD with
# AGEKEY_RETENTION_DRY_RUN=true). Replace the secret with the
# environment-specific value, never inline it.
curl -fsS -X POST "$AK_BASE/retention-job" \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 6.5 Parental Consent smoke (only when feature is enabled in env)

```bash
# Guardian start — must return 200 with masked OTP transport (or
# error AGEKEY_PARENTAL_CONSENT_DISABLED if master flag OFF).
curl -fsS -X POST "$AK_BASE/parental-consent-guardian-start" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"<session-id>","guardian_email":"<guardian@example.com>"}'
```

### 6.6 Safety Signals smoke (HML only — keep OFF in PROD until ready)

```bash
curl -fsS -X POST "$AK_BASE/safety-event-ingest" \
  -H "X-AgeKey-API-Key: $AK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"<event-type>","subject_pseudonym_id":"<id>"}]}'
```

---

## 7. Sign-off

- [ ] Ops engineer: `<name>` `<date>` `<env>`
- [ ] Reviewer (security/DPO sign-off for PROD): `<name>` `<date>`
- [ ] Snapshot location recorded: `<path/handle>`
- [ ] Smoke test results attached to the deploy ticket.

> Any failed item in §1 or §6 blocks promotion. Use §5 to roll back if a
> regression surfaces post-deploy.
