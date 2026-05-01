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

# Variáveis que DEVEM existir em Production Vercel (✓ na matriz).
#
# Apenas NEXT_PUBLIC_* são consumidas em build/runtime do admin Next.js
# em Vercel. Os secrets server-only (SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET,
# CRON_SECRET, WEBHOOK_SIGNING_SECRET, AGEKEY_ADMIN_API_KEY, GATEWAY_*)
# vivem em Supabase Edge Functions secrets (`supabase secrets set
# --project-ref`) e NÃO devem ser duplicados em Vercel — duplicar amplia a
# superfície de exposição sem benefício. Eles aparecem APENAS na lista
# FORBIDDEN_ANY como red-team check.
REQUIRED_PROD=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "NEXT_PUBLIC_AGEKEY_API_BASE"
  "NEXT_PUBLIC_AGEKEY_ISSUER"
  "NEXT_PUBLIC_APP_URL"
)

# Secrets server-only que NÃO PODEM existir em NENHUM scope Vercel
# (Production, Preview, Development). O admin app não os consome — eles
# vivem em Supabase Edge Functions secrets. Se o audit encontrar qualquer
# um em qualquer scope, é drift de segurança.
#
# Nota: o nome canônico do segredo de webhook é WEBHOOK_SIGNING_SECRET
# (sem sufixo) — confirmar em infrastructure/secrets.md.
FORBIDDEN_ANY=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "SUPABASE_JWT_SECRET"
  "AGEKEY_ADMIN_API_KEY"
  "WEBHOOK_SIGNING_SECRET"
  "CRON_SECRET"
  "GATEWAY_YOTI_API_KEY"
  "GATEWAY_VERIFF_API_KEY"
  "GATEWAY_ONFIDO_API_KEY"
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
# Regra 1: nenhum secret server-only em QUALQUER scope Vercel
# (drift detection — esses secrets vivem em Supabase, nunca em Vercel)
# ---------------------------------------------------------------------------

echo "==> Checando Production contra lista de secrets server-only proibidos…"
for key in "${FORBIDDEN_ANY[@]}"; do
  if contains "$key" "${PROD_KEYS[@]}"; then
    echo "FAIL [production] secret server-only NÃO deveria estar em Vercel: $key (mover para Supabase Edge Functions secrets)"
    FAIL=1
  fi
done

echo "==> Checando Preview contra lista de secrets server-only proibidos…"
for key in "${FORBIDDEN_ANY[@]}"; do
  if contains "$key" "${PREVIEW_KEYS[@]}"; then
    echo "FAIL [preview] secret server-only presente: $key"
    FAIL=1
  fi
done

echo "==> Checando Development contra lista de secrets server-only proibidos…"
for key in "${FORBIDDEN_ANY[@]}"; do
  if contains "$key" "${DEV_KEYS[@]}"; then
    echo "FAIL [development] secret server-only presente: $key"
    FAIL=1
  fi
done

# ---------------------------------------------------------------------------
# Regra 2: todas as NEXT_PUBLIC_* obrigatórias presentes em Production
# ---------------------------------------------------------------------------

echo "==> Checando Production contra lista de NEXT_PUBLIC_* obrigatórias…"
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
