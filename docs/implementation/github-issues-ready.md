# GitHub issues ready — copy/paste

These are the GitHub issues to open when the operator decides to
break the backlog into the project board. Each entry below maps 1:1
to a row in `docs/implementation/pending-work-backlog.md`. Do NOT
open them automatically — they require human triage of priority,
sprint, owner and dependencies.

To open them by hand:

1. Pick a row.
2. Copy the title + body from this file.
3. Apply the labels listed.
4. Assign owner + sprint.
5. Mark the matching backlog row in `pending-work-backlog.md` with
   the issue number under "Status".

---

## P0 — Bloqueadores de go-live

### Issue: [P0] Separate Supabase staging and production projects

**Labels:** `priority/P0`, `area/infra`, `compliance`, `go-live-blocker`
**ID:** AK-P0-01

Currently the AgeKey monorepo points to a single Supabase project.
Production traffic shares storage and DB with staging. This must be
split before GA: any incident in staging (test data, broken
migration, leaked service role) would compromise production.

**Acceptance criteria**
- [ ] Two Supabase projects exist (`agekey-staging`, `agekey-production`)
- [ ] All migrations run cleanly in both
- [ ] Cron jobs (retention, key rotation) scheduled in both
- [ ] Service role keys are distinct
- [ ] `infrastructure/environments.md` updated with both project ids
- [ ] Deploy runbook updated

Refs: `infrastructure/environments.md`, `infrastructure/supabase-hardening.md`.

---

### Issue: [P0] Configure DNS for agekey.com.br (apex, subdomains, CAA, SPF/DKIM/DMARC)

**Labels:** `priority/P0`, `area/infra`, `go-live-blocker`
**ID:** AK-P0-02

**Acceptance criteria**
- [ ] `agekey.com.br`, `app.agekey.com.br`, `api.agekey.com.br`,
      `verify.agekey.com.br`, `docs.agekey.com.br`,
      `status.agekey.com.br` resolve via HTTPS
- [ ] CAA record limits to `letsencrypt.org` and `pki.goog`
- [ ] SPF record published
- [ ] DMARC `p=quarantine` minimum, `rua` reporting active
- [ ] HSTS preload only after every host validates HTTPS
- [ ] DNSSEC enabled when registrar supports

Refs: `infrastructure/dns/agekey-dns-plan.md`.

---

### Issue: [P0] Stable proxy: api.agekey.com.br → Edge Functions

**Labels:** `priority/P0`, `area/infra`
**ID:** AK-P0-03

The public contract (JWKS, token verify, session create) currently
points to the Supabase functions URL. This couples our public
contract to a third-party domain — we cannot migrate provider without
breaking clients.

**Acceptance criteria**
- [ ] `api.agekey.com.br` resolves to a proxy that forwards to the
      current Supabase Edge Functions URL
- [ ] Public docs reference only `api.agekey.com.br`
- [ ] JWKS is reachable at `https://api.agekey.com.br/.well-known/jwks.json`
- [ ] Latency budget: < 50ms added vs direct
- [ ] Rollback path documented

---

### Issue: [P0] Cross-tenant RLS test suite + CI gate

**Labels:** `priority/P0`, `area/security`, `go-live-blocker`
**ID:** AK-P0-04

**Acceptance criteria**
- [ ] `pnpm test:rls` covers at least 6 cross-tenant breakout
      attempts (sessions, results, tokens, applications, policies,
      issuers)
- [ ] CI fails the merge if any cross-tenant SELECT returns ≥ 1 row
- [ ] Tests use two real tenants, not mocks
- [ ] Documented in `security/pentest/manual-smoke-tests.md` §B

---

### Issue: [P0] Privacy guard automated payload scan in CI

**Labels:** `priority/P0`, `area/privacy`, `area/ci`
**ID:** AK-P0-05

**Acceptance criteria**
- [ ] CI step runs the existing privacy-guard tests on every PR
- [ ] CI also runs a 100-session staging fuzz weekly that exercises
      every Edge Function and asserts no `FORBIDDEN_PUBLIC_KEYS`
      key appears in any response
- [ ] Failure blocks merge

---

### Issue: [P0] Validate external_user_ref shape (reject email/CPF/trivial values)

**Labels:** `priority/P0`, `area/privacy`
**ID:** AK-P0-06

**Acceptance criteria**
- [ ] `verifications-session-create` rejects or normalizes inputs
      matching email regex, BR CPF mask, or 11-digit numerical
      sequence
- [ ] Reason code surfaced is `INVALID_REQUEST` with detail
      `external_user_ref_must_be_opaque`
- [ ] Documented in `docs/specs/sdk-public-contract.md`
- [ ] Privacy-guard tests extended for the new check

---

### Issue: [P0] Audit Vercel env vars (Production vs Preview vs Development)

**Labels:** `priority/P0`, `area/infra`, `area/security`
**ID:** AK-P0-07

**Acceptance criteria**
- [ ] No server-only secret (`SUPABASE_SERVICE_ROLE_KEY`,
      `WEBHOOK_SIGNING_SECRET`, gateway secrets) appears in
      `Preview` or `Development` env scope
- [ ] No `NEXT_PUBLIC_*` carries a service-role-shaped string
- [ ] `infrastructure/secrets.md` reflects the audit outcome
- [ ] Vercel project settings screenshot archived in the issue

---

### Issue: [P0] Confirm key rotation cron + JWKS stability

**Labels:** `priority/P0`, `area/security`
**ID:** AK-P0-08

**Acceptance criteria**
- [ ] `key-rotation` Edge Function scheduled
- [ ] JWKS contains only public material (`d` field absent)
- [ ] Smoke test TOK-05 / TOK-06 PASS

---

### Issue: [P0] SEV-1 incident-response tabletop

**Labels:** `priority/P0`, `area/compliance`, `area/security`
**ID:** AK-P0-09

**Acceptance criteria**
- [ ] SEV-1 tabletop exercise executed within last 90 days for at
      least one runbook (signing key compromise OR service role
      leak)
- [ ] Lessons-learned committed to
      `compliance/incident-response-playbook.md`

---

### Issue: [P0] External pentest before GA

**Labels:** `priority/P0`, `area/security`, `go-live-blocker`
**ID:** AK-P0-10

**Acceptance criteria**
- [ ] Vendor selected, scope signed against
      `security/pentest/scope.md`
- [ ] Pentest concluded; report archived
- [ ] All `Crítica` findings closed; `Alta` closed or accepted
      with mitigation
- [ ] Reteste passed
- [ ] `security/pentest/remediation-tracker.md` reflects final state

---

## P1 — Enterprise readiness (resumido)

Para AK-P1-01..10, copiar do backlog e aplicar:

- **Labels:** `priority/P1`, `area/<sdk|infra|admin|integration>`
- **Body:** descrição curta + critério de aceite copiado do
  backlog.

Exemplo título: `[P1] Mobile SDK v0.1 secure model (no API key in app)`

## P2 / P3

Copiar igual, ajustando label `priority/P2` ou `priority/P3`.

---

## Etiquetas (labels) sugeridas

Criar no repositório se ainda não existirem:

- `priority/P0`, `priority/P1`, `priority/P2`, `priority/P3`
- `area/infra`, `area/security`, `area/privacy`, `area/sdk`,
  `area/admin`, `area/integration`, `area/compliance`, `area/ci`
- `go-live-blocker`
- `compliance`
- `dependency/external` (para itens bloqueados por DPA / vendor)
