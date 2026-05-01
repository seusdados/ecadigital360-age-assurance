# AgeKey — Go-live checklist

This file is the single, ordered checklist that must be green before
AgeKey accepts production traffic. Each item points to the document
that owns the detail. No item is a "later" item — every box is a
hard gate.

When using this list:

- Make a copy in the release issue,
- Tick each box with name + date + commit/PR,
- DO NOT mark a section "done" if any single item is open,
- Items that are blocked by external factors (DPA, gateway
  contract, Supabase tier upgrade) must be tracked in
  `docs/implementation/pending-work-backlog.md` and explicitly
  accepted by tech-lead + DPO.

---

## 1. Codebase quality

- [ ] `pnpm install` clean (no lockfile drift)
- [ ] `pnpm typecheck` PASS in 5/5 packages
- [ ] `pnpm lint` PASS with 0 warnings (admin a11y included)
- [ ] `pnpm test` PASS (shared + adapter-contracts vitest suites)
- [ ] No new unjustified runtime dependency in package.json
- [ ] No `// TODO: BBS+ enabled` left without ADR + tracker entry

## 2. Privacy guard

- [ ] `privacy-guard.ts` covers every key in
      `docs/specs/sdk-public-contract.md` §"Categorias proibidas"
- [ ] `assertPublicPayloadHasNoPii` is called in:
  - [ ] `verifications-session-complete` BEFORE `signResultToken(claims)`
  - [ ] `verifications-session-complete` BEFORE returning `responseBody`
  - [ ] `verifications-token-verify` BEFORE returning `responseBody`
  - [ ] `verifications-session-get` (with `allowedKeys: ['name']`)
- [ ] `evidence_json` of recent denied + approved sessions in staging
      contains zero forbidden keys (smoke test PRIV-04)
- [ ] No `birthdate|cpf|selfie|dob|passport|ssn` in last 24h Edge
      Function logs (smoke test PRIV-02)

## 3. Security smoke tests

Every test in `security/pentest/manual-smoke-tests.md` marked
`Crítica` MUST be PASS. Specifically:

- [ ] AUTH-01..06 PASS
- [ ] TENANT-01..05 PASS
- [ ] NONCE-01..04 PASS
- [ ] TOK-01..08 PASS
- [ ] WH-01..05 PASS
- [ ] ST-01..04 PASS
- [ ] PRIV-01..04 PASS
- [ ] SEC-01..03 PASS

## 4. Supabase hardening (`infrastructure/supabase-hardening.md`)

- [ ] Production project SEPARATED from staging
- [ ] RLS enabled on every business table; cross-tenant SELECT
      returns 0 rows (verified via `pnpm test:rls`)
- [ ] Storage bucket `proof-artifacts` is **private**
- [ ] Signed URLs default TTL ≤ 300s
- [ ] Service role secret rotated within 90 days, present ONLY in
      Edge Function env
- [ ] `crypto_keys` rotation cron scheduled and tested
- [ ] JWKS endpoint returns only `kty`, `kid`, `use`, `alg`, `crv`,
      `x`, `y` — NO `d` (private)

## 5. Vercel hardening (`infrastructure/vercel-deploy.md`)

- [ ] Production project keys segregated from Preview / Development
      (rodar `infrastructure/scripts/audit-vercel-env.sh` — ver
      `infrastructure/vercel-deploy.md` § "Auditoria de env vars" e
      a matriz canônica em `infrastructure/secrets.md` § "Matrix
      Vercel envs")
- [ ] `NEXT_PUBLIC_*` audited for any server secret pattern
      (executar o "Bundle leak check" descrito em
      `infrastructure/vercel-deploy.md`)
- [ ] HSTS, CSP, X-Frame-Options (DENY for admin),
      Referrer-Policy, Permissions-Policy headers active
- [ ] Build command pinned: `pnpm install --frozen-lockfile && pnpm build`

## 6. DNS (`infrastructure/dns/agekey-dns-plan.md`)

- [ ] `agekey.com.br` apex resolved (Vercel)
- [ ] `app.agekey.com.br` resolves (admin)
- [ ] `api.agekey.com.br` resolves (proxy → Edge Functions; not
      Supabase domain directly to keep contract stable)
- [ ] `verify.agekey.com.br` resolves (widget host)
- [ ] `docs.agekey.com.br` resolves (Docusaurus or Vercel)
- [ ] `status.agekey.com.br` placeholder (status provider TBD)
- [ ] CAA: `letsencrypt.org`, `pki.goog`
- [ ] SPF, DKIM, DMARC records set (DMARC `p=quarantine` minimum)
- [ ] HSTS preload only after every host validates HTTPS
- [ ] DNSSEC habilitado quando o registrar suportar

## 7. Secrets hygiene (`infrastructure/secrets.md`)

- [ ] No `.env` file committed (verify: `git log --all --diff-filter=A -- '**/.env*'`)
- [ ] No `service_role`, `whsec_`, `sbp_`, `private_key`, `cpf`,
      `birthdate`, `dateofbirth`, `passport` literal in repo
      (only as documented placeholders/examples)
- [ ] Webhook signing secrets rotated within 90 days
- [ ] Per-application `ak_*` rotation covered in admin UI

## 8. Compliance pack

- [ ] `compliance/ripd-agekey.md` reflects current implementation
- [ ] `compliance/subprocessors-register.md` lists current vendors
      with regions and legal basis
- [ ] DPO sign-off on RIPD §13 (transferência internacional)
- [ ] DPA template available for prospective tenants
- [ ] `compliance/incident-response-playbook.md` SEV-1 runbook
      tested in tabletop within last 90 days

## 9. Pentest

- [ ] External pentest concluded (or accepted-with-risk by DPO + CTO)
- [ ] All Crítica findings closed
- [ ] All Alta findings closed or accepted with mitigations documented
- [ ] Reteste passed
- [ ] `security/pentest/remediation-tracker.md` reflects final state

## 10. Observability + ops

- [ ] Edge Function logs streaming to retained log bucket
- [ ] Alert: `signResultToken` failures > 0 / 5min
- [ ] Alert: `assertPublicPayloadHasNoPii` throw > 0 ever
- [ ] Alert: webhook `dead_letter` count
- [ ] Status page wired

## 11. Commercial / launch

- [ ] Pricing & billing flows tested in staging end-to-end
- [ ] Onboarding flow tested for a new tenant from zero
- [ ] Documentation public on `docs.agekey.com.br`
- [ ] `agekey.com.br/legal/subprocessors` and `/legal/dpa` published

## 12. Backout plan

- [ ] DNS TTL ≤ 300 during launch window
- [ ] Vercel Production deployment promoted from a known-good
      Preview, with the previous deployment retained for instant
      promote-back
- [ ] Database migration backout: every migration has a documented
      rollback path or is forward-only with feature flag

---

## Sign-off

| Role | Name | Date | Notes |
|---|---|---|---|
| Tech lead | | | |
| Security | | | |
| DPO | | | |
| Product | | | |
| CTO | | | |

Sem todas as assinaturas, **não é go-live**, é dry-run.
