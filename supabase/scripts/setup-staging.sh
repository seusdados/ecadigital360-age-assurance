#!/usr/bin/env bash
# setup-staging.sh — aplica TODA a Fase 2 no projeto Supabase staging.
#
# Pré-requisitos:
#   - supabase CLI 1.180+ instalada
#   - SUPABASE_ACCESS_TOKEN exportada (PAT da org "eca digital")
#   - AGEKEY_CRON_SECRET exportada (gere com: openssl rand -hex 32)
#   - pg_cron, pgsodium, pg_net habilitadas no Dashboard
#
# Uso:
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   export AGEKEY_CRON_SECRET=$(openssl rand -hex 32)
#   bash supabase/scripts/setup-staging.sh
#
# Idempotente: pode rodar várias vezes — comandos de seed usam ON CONFLICT,
# functions deploy sobrescrevem, secrets set não dão erro se já existem.

set -euo pipefail

PROJECT_REF="tpdiccnmsnjtjwhardij"
PROJECT_URL="https://${PROJECT_REF}.supabase.co"
FUNCTIONS_BASE="${PROJECT_URL}/functions/v1"

# ---------- pré-checks ----------
if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI not installed" >&2
  exit 1
fi
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: export SUPABASE_ACCESS_TOKEN=<seu PAT>" >&2
  exit 1
fi
if [[ -z "${AGEKEY_CRON_SECRET:-}" ]]; then
  echo "ERROR: export AGEKEY_CRON_SECRET=\$(openssl rand -hex 32)" >&2
  exit 1
fi

cd "$(dirname "$0")/../.."
echo "→ Working in: $(pwd)"

# ---------- 1. link ----------
echo
echo "═══════════════════════════════════════════════════"
echo "  Passo 1/8 — Link CLI ao projeto $PROJECT_REF"
echo "═══════════════════════════════════════════════════"
supabase link --project-ref "$PROJECT_REF"

# ---------- 2. push migrations ----------
echo
echo "═══════════════════════════════════════════════════"
echo "  Passo 2/8 — Aplicar migrations 000–014"
echo "═══════════════════════════════════════════════════"
supabase db push

# ---------- 3. seeds ----------
echo
echo "═══════════════════════════════════════════════════"
echo "  Passo 3/8 — Aplicar seeds"
echo "═══════════════════════════════════════════════════"
DB_URL=$(supabase status -o json | grep -o '"DB_URL":"[^"]*"' | cut -d'"' -f4)
if [[ -z "$DB_URL" ]]; then
  echo "→ supabase status não retornou DB_URL — pulando seeds remotos"
  echo "  Aplique manualmente via SQL Editor do Dashboard:"
  echo "    supabase/seed/01_jurisdictions.sql"
  echo "    supabase/seed/02_trust_registry.sql"
  echo "    supabase/seed/03_policies_default.sql"
  echo "    supabase/seed/04_dev_tenant.sql"
else
  for s in 01_jurisdictions 02_trust_registry 03_policies_default 04_dev_tenant; do
    echo "→ seed: $s"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "supabase/seed/${s}.sql"
  done
fi

# ---------- 4. settings runtime para crons ----------
echo
echo "═══════════════════════════════════════════════════"
echo "  Passo 4/8 — Configurar app.cron_secret e app.functions_url"
echo "═══════════════════════════════════════════════════"
cat <<SQL > /tmp/agekey-settings.sql
ALTER DATABASE postgres SET app.cron_secret = '${AGEKEY_CRON_SECRET}';
ALTER DATABASE postgres SET app.functions_url = '${FUNCTIONS_BASE}';
SELECT pg_reload_conf();
SQL
if [[ -n "${DB_URL:-}" ]]; then
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f /tmp/agekey-settings.sql
else
  echo "→ Aplique manualmente no SQL Editor:"
  cat /tmp/agekey-settings.sql
fi
rm -f /tmp/agekey-settings.sql

# ---------- 5. secrets ----------
echo
echo "═══════════════════════════════════════════════════"
echo "  Passo 5/8 — supabase secrets set"
echo "═══════════════════════════════════════════════════"
supabase secrets set \
  CRON_SECRET="$AGEKEY_CRON_SECRET" \
  AGEKEY_ALLOWED_ORIGINS="https://staging.agekey.com.br,http://localhost:3000" \
  AGEKEY_ISSUER="https://staging.agekey.com.br" \
  AGEKEY_ENV="staging"

# ---------- 6. deploy das 21 Edge Functions ----------
echo
echo "═══════════════════════════════════════════════════"
echo "  Passo 6/8 — Deploy de 21 Edge Functions"
echo "═══════════════════════════════════════════════════"
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

# ---------- 7. bootstrap da primeira chave de assinatura ----------
echo
echo "═══════════════════════════════════════════════════"
echo "  Passo 7/8 — Bootstrap da primeira crypto_key (vault)"
echo "═══════════════════════════════════════════════════"
sleep 5  # pequeno delay para a função estar disponível
HTTP_CODE=$(curl -s -o /tmp/keyrot.json -w "%{http_code}" \
  -X POST "$FUNCTIONS_BASE/key-rotation" \
  -H "Authorization: Bearer $AGEKEY_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source":"setup-staging"}')
if [[ "$HTTP_CODE" =~ ^2 ]]; then
  echo "→ key-rotation OK (HTTP $HTTP_CODE)"
  cat /tmp/keyrot.json
  echo
else
  echo "→ key-rotation falhou (HTTP $HTTP_CODE):"
  cat /tmp/keyrot.json
  echo
  echo "  Reexecute manualmente:"
  echo "  curl -X POST '$FUNCTIONS_BASE/key-rotation' -H 'Authorization: Bearer \$AGEKEY_CRON_SECRET'"
fi
rm -f /tmp/keyrot.json

# ---------- 8. gerar tipos para o admin ----------
echo
echo "═══════════════════════════════════════════════════"
echo "  Passo 8/8 — Gerar tipos TS reais para apps/admin"
echo "═══════════════════════════════════════════════════"
supabase gen types typescript --project-id "$PROJECT_REF" \
  > apps/admin/types/database.ts.new
if [[ -s apps/admin/types/database.ts.new ]]; then
  mv apps/admin/types/database.ts.new apps/admin/types/database.ts
  echo "→ apps/admin/types/database.ts atualizado"
  echo "  Rode 'pnpm --filter @agekey/admin typecheck' para confirmar."
else
  rm -f apps/admin/types/database.ts.new
  echo "→ supabase gen types não retornou conteúdo — mantendo placeholder"
fi

cat <<EOF

═══════════════════════════════════════════════════════════
  ✓ Setup staging concluído
═══════════════════════════════════════════════════════════

  Project URL:    $PROJECT_URL
  Functions base: $FUNCTIONS_BASE
  JWKS público:   $FUNCTIONS_BASE/jwks

  Smoke test (deve retornar JSON):
    curl -X POST "$FUNCTIONS_BASE/verifications-session-create" \\
      -H "X-AgeKey-API-Key: ak_dev_sk_test_0123456789abcdef" \\
      -H "Content-Type: application/json" \\
      -d '{"policy_slug":"dev-18-plus","client_capabilities":{"platform":"web"}}'

  Próximo passo: Vercel (ver DEPLOY.md PASSO 4).

EOF
