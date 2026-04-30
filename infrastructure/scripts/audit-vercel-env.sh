#!/usr/bin/env bash
#
# audit-vercel-env.sh
#
# Audita env vars do projeto Vercel contra a matriz canônica
# definida em infrastructure/secrets.md § "Matrix Vercel envs".
#
# Uso:
#   ./infrastructure/scripts/audit-vercel-env.sh
#
# Requisitos:
#   - bash
#   - jq
#   - vercel CLI (autenticada e linkada via `vercel link`)
#
# Saída:
#   - 0 quando tudo PASS
#   - 1 quando alguma regra FALHA
#
# AK-P0-07 — auditoria trimestral de env vars Vercel.

set -euo pipefail

# ---------------------------------------------------------------------------
# Matriz canônica
# ---------------------------------------------------------------------------

# Variáveis que DEVEM existir em Production (✓ na matriz).
REQUIRED_PROD=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "NEXT_PUBLIC_AGEKEY_API_BASE"
  "NEXT_PUBLIC_AGEKEY_ISSUER"
  "NEXT_PUBLIC_APP_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "SUPABASE_JWT_SECRET"
  "AGEKEY_ADMIN_API_KEY"
  "WEBHOOK_SIGNING_SECRET_DEFAULT"
  "GATEWAY_YOTI_API_KEY"
  "GATEWAY_VERIFF_API_KEY"
  "GATEWAY_ONFIDO_API_KEY"
  "CRON_SECRET"
)

# Variáveis que NÃO PODEM existir em Preview/Development (✗ na matriz).
FORBIDDEN_NON_PROD=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "SUPABASE_JWT_SECRET"
  "AGEKEY_ADMIN_API_KEY"
  "WEBHOOK_SIGNING_SECRET_DEFAULT"
  "CRON_SECRET"
)

FAIL=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

die() {
  echo "ERROR: $*" >&2
  exit 2
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "comando '$1' não encontrado no PATH"
}

require_cmd jq
require_cmd vercel

# Lista as variáveis de um scope. `vercel env ls --json <scope>` devolve
# um array de objetos; pegamos só o `key`.
list_env_keys() {
  local scope="$1"
  if ! vercel env ls --json "$scope" 2>/dev/null \
      | jq -r '.[].key' 2>/dev/null; then
    die "falha ao executar 'vercel env ls --json $scope' (CLI logada? projeto linkado?)"
  fi
}

contains() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

# ---------------------------------------------------------------------------
# Coleta
# ---------------------------------------------------------------------------

echo "==> Listando env vars (production / preview / development)…"

mapfile -t PROD_KEYS    < <(list_env_keys production)
mapfile -t PREVIEW_KEYS < <(list_env_keys preview)
mapfile -t DEV_KEYS     < <(list_env_keys development)

# ---------------------------------------------------------------------------
# Regra 1: nenhum secret server-only em Preview
# ---------------------------------------------------------------------------

echo "==> Checando Preview contra lista de variáveis proibidas…"
for key in "${FORBIDDEN_NON_PROD[@]}"; do
  if contains "$key" "${PREVIEW_KEYS[@]}"; then
    echo "FAIL [preview] secret server-only presente: $key"
    FAIL=1
  fi
done

# ---------------------------------------------------------------------------
# Regra 2: nenhum secret server-only em Development
# ---------------------------------------------------------------------------

echo "==> Checando Development contra lista de variáveis proibidas…"
for key in "${FORBIDDEN_NON_PROD[@]}"; do
  if contains "$key" "${DEV_KEYS[@]}"; then
    echo "FAIL [development] secret server-only presente: $key"
    FAIL=1
  fi
done

# ---------------------------------------------------------------------------
# Regra 3: todas as variáveis marcadas ✓ presentes em Production
# ---------------------------------------------------------------------------

echo "==> Checando Production contra lista de variáveis obrigatórias…"
for key in "${REQUIRED_PROD[@]}"; do
  if ! contains "$key" "${PROD_KEYS[@]}"; then
    echo "FAIL [production] variável obrigatória ausente: $key"
    FAIL=1
  fi
done

# ---------------------------------------------------------------------------
# Resultado
# ---------------------------------------------------------------------------

if [[ "$FAIL" -ne 0 ]]; then
  echo ""
  echo "=== AUDITORIA FALHOU — corrigir o(s) item(ns) acima antes de promover. ==="
  exit 1
fi

echo ""
echo "=== AUDITORIA OK — matriz Vercel envs em conformidade com infrastructure/secrets.md. ==="
exit 0
