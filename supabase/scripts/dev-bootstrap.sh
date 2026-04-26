#!/usr/bin/env bash
# dev-bootstrap.sh — applies all migrations + seeds locally and prints the
# dev API key so you can run end-to-end smoke tests against
# `supabase functions serve`.
#
# Usage:
#   ./supabase/scripts/dev-bootstrap.sh
#
# Prerequisites:
#   - Docker running
#   - supabase CLI v1.180+ (`supabase --version`)
#   - Run from the repo root.

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI not found. Install via https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

echo "→ Starting Supabase local stack..."
supabase start

echo
echo "→ Resetting database (applies migrations 000–012 + seeds 01–04)..."
supabase db reset --no-seed
psql "$(supabase status -o json | jq -r .DB_URL)" \
  -v ON_ERROR_STOP=1 \
  -f supabase/seed/01_jurisdictions.sql \
  -f supabase/seed/02_trust_registry.sql \
  -f supabase/seed/03_policies_default.sql \
  -f supabase/seed/04_dev_tenant.sql

echo
echo "→ Bootstrap initial signing key (POST /functions/v1/key-rotation)..."
echo "  IMPORTANT: this requires \`supabase functions serve\` running in another terminal,"
echo "  with CRON_SECRET set in supabase/.env.local. Skipping the call here."

cat <<'INFO'

═══════════════════════════════════════════════════════════════════════════
  AgeKey dev environment — ready
═══════════════════════════════════════════════════════════════════════════

  Tenant slug      : dev
  Application slug : dev-app
  Available policies (clones of BR templates):
    - dev-13-plus
    - dev-16-plus
    - dev-18-plus

  Raw API key       : ak_dev_sk_test_0123456789abcdef
  Raw webhook secret: whsec_dev_0123456789abcdef

  STAGING ONLY — these credentials are public knowledge in the seed file.
  Rotate via the admin UI before any live traffic.

  Smoke test:

    export AK_BASE=http://127.0.0.1:54321/functions/v1
    export AK_API_KEY=ak_dev_sk_test_0123456789abcdef

    # 1) Start function runtime in another terminal:
    #    supabase functions serve --env-file supabase/.env.local

    # 2) Bootstrap initial signing key:
    curl -X POST "$AK_BASE/key-rotation" \
      -H "Authorization: Bearer $CRON_SECRET"

    # 3) Create a session and complete via fallback:
    curl -X POST "$AK_BASE/verifications-session-create" \
      -H "X-AgeKey-API-Key: $AK_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"policy_slug":"dev-18-plus"}'

═══════════════════════════════════════════════════════════════════════════
INFO
