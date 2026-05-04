#!/usr/bin/env bash
# deploy-functions.sh — re-deploy de todas as 21 Edge Functions.
# Use após editar uma função; o setup-staging.sh já faz isso na primeira vez.

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI not installed" >&2
  exit 1
fi
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: export SUPABASE_ACCESS_TOKEN=<seu PAT>" >&2
  exit 1
fi

cd "$(dirname "$0")/../.."

FUNCTIONS=(
  verifications-session-create
  verifications-session-get
  verifications-session-complete
  verifications-token-verify
  verifications-token-revoke
  verifications-list
  issuers-register
  issuers-list
  policies-list
  policies-write
  applications-list
  applications-write
  applications-rotate-key
  tenant-bootstrap
  audit-list
  proof-artifact-url
  jwks
  key-rotation
  webhooks-worker
  retention-job
  trust-registry-refresh
)

for fn in "${FUNCTIONS[@]}"; do
  echo "→ deploy: $fn"
  supabase functions deploy "$fn" --no-verify-jwt
done

echo "✓ ${#FUNCTIONS[@]} functions deployadas"
