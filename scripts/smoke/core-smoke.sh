#!/usr/bin/env bash
# ============================================================================
# AgeKey Core — HML smoke test (read-mostly, no destructive ops)
# ----------------------------------------------------------------------------
# Cobertura: applications, policies, audit, verifications-session-* lifecycle
# (create, get, complete, token-verify, token-revoke).
#
# Pré-requisitos (env vars — NUNCA hardcoded):
#   BASE_URL          ex.: https://wljedzqgprkpqhuazdzv.functions.supabase.co
#   TENANT_API_KEY    chave de tenant de TESTE em HML (X-AgeKey-API-Key)
#   ANON_KEY          (opcional) Supabase anon key para chamadas públicas
#   APPLICATION_ID    UUID de uma application de teste já cadastrada
#   USER_REF          referência opaca do usuário (ex.: HMAC ou UUID)
#
# Uso:
#   BASE_URL=... TENANT_API_KEY=... APPLICATION_ID=... USER_REF=... \
#     bash scripts/smoke/core-smoke.sh
#
# Garantias respeitadas:
#   - Nenhum payload contém PII (CPF/RG/data de nascimento/email/telefone).
#   - Apenas referências opacas e operações documentadas pela API canônica.
#   - Nenhum acesso a PROD; ambiente alvo é o HML do tenant.
# ============================================================================
set -euo pipefail

# ---- Sanity check ----------------------------------------------------------
: "${BASE_URL:?BASE_URL is required}"
: "${TENANT_API_KEY:?TENANT_API_KEY is required}"
: "${APPLICATION_ID:?APPLICATION_ID is required}"
: "${USER_REF:?USER_REF is required}"
ANON_KEY="${ANON_KEY:-}"

H_AUTH=(-H "X-AgeKey-API-Key: ${TENANT_API_KEY}")
H_JSON=(-H 'Content-Type: application/json')
H_TRACE=(-H "X-Trace-Id: smoke-core-$(date +%s)")

curl_json() {
  # $1=method $2=path $3=optional body
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "${body}" ]]; then
    curl -sS -X "${method}" "${BASE_URL}${path}" \
      "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}" \
      --data "${body}"
  else
    curl -sS -X "${method}" "${BASE_URL}${path}" \
      "${H_AUTH[@]}" "${H_JSON[@]}" "${H_TRACE[@]}"
  fi
  echo
}

echo "==> [1] applications-list :: lista applications visíveis ao tenant"
# Espera: HTTP 200, array de applications do tenant somente (RLS).
curl_json GET "/applications-list" || true

echo
echo "==> [2] policies-list :: enumera políticas ativas para o tenant"
# Espera: HTTP 200, lista contendo a policy_slug usada nos demais testes.
curl_json GET "/policies-list" || true

echo
echo "==> [3] audit-list :: confirma append-only audit visível"
# Espera: HTTP 200; tabela audit_events particionada por mês acessível.
curl_json GET "/audit-list?limit=5" || true

echo
echo "==> [4] verifications-session-create :: cria sessão de verificação"
# Espera: HTTP 201, retorna session_id, status=pending, available_methods.
SESSION_RESP=$(curl_json POST "/verifications-session-create" \
  "{\"application_id\":\"${APPLICATION_ID}\",\"policy_slug\":\"age-18-br\",\"external_user_ref\":\"${USER_REF}\"}")
echo "${SESSION_RESP}"
SESSION_ID=$(printf '%s' "${SESSION_RESP}" | grep -oE '"session_id":"[^"]+"' | head -1 | cut -d'"' -f4 || echo "")
echo "session_id=${SESSION_ID}"

if [[ -z "${SESSION_ID}" ]]; then
  echo "WARN: session_id ausente — pulando steps 5-8"
else
  echo
  echo "==> [5] verifications-session-get :: estado público da sessão"
  # Espera: HTTP 200, status, available_methods, sem PII.
  curl_json GET "/verifications-session-get?session_id=${SESSION_ID}" || true

  echo
  echo "==> [6] verifications-session-complete :: tentativa de completar (manual)"
  # NOTA: este endpoint exige challenge real; aqui apenas validamos o
  # contrato de erro 400 quando o challenge é inválido — sem PII.
  curl_json POST "/verifications-session-complete" \
    "{\"session_id\":\"${SESSION_ID}\",\"method\":\"document\",\"challenge_token\":\"invalid-smoke-challenge\"}" || true

  echo
  echo "==> [7] verifications-token-verify :: valida JWT via JWKS"
  # Espera: HTTP 400 quando JWT vazio (smoke); a chamada real será feita
  # com result_token retornado por uma sessão completed em ambiente de QA.
  curl_json POST "/verifications-token-verify" \
    '{"jwt":"eyJhbGciOiJFUzI1NiJ9.invalid.smoke"}' || true

  echo
  echo "==> [8] verifications-token-revoke :: revoga JTI"
  # Espera: HTTP 404 quando jti inexistente; valida apenas o contrato.
  curl_json POST "/verifications-token-revoke" \
    '{"jti":"00000000-0000-0000-0000-000000000000","reason":"smoke-test"}' || true
fi

echo
echo "==> [9] jwks :: chave pública corrente para verificação offline"
# Espera: HTTP 200, JWK com kid e alg=ES256. Endpoint público (sem API key).
curl -sS "${BASE_URL}/jwks" "${H_TRACE[@]}" || true
echo

echo
echo "==> [10] applications-rotate-key :: NOOP smoke (somente dry contrato)"
# IMPORTANTE: rotação real só deve ser executada com janela de manutenção.
# Aqui validamos apenas que o endpoint exige confirmação explícita.
curl_json POST "/applications-rotate-key" \
  "{\"application_id\":\"${APPLICATION_ID}\",\"confirm\":false}" || true

echo
echo "==> Core smoke concluído. Verifique manualmente:"
echo "    - Nenhuma resposta contém CPF/RG/birthdate/email/telefone."
echo "    - Apenas o tenant atual aparece nas listas (isolamento por RLS)."
echo "    - HTTP 401/403 são esperados se TENANT_API_KEY for inválida."
